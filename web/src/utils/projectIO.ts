import JSZip from 'jszip';
import { nanoid } from 'nanoid/non-secure';
import type { GraphComment, GraphDocument, GraphEdge, GraphNode } from '../types/node';
import { GRAPH_SCHEMA_VERSION } from '../types/node';
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORY_DEFINITIONS,
  PROJECT_MANIFEST_VERSION,
  type ProjectDocument,
  type ProjectManifest,
  type ProjectManifestGraph,
  type ProjectManifestGroup,
} from '../types/project';
import {
  buildGraphPath,
  createEmptyProjectDocument,
  createProjectId,
  deriveGroupNameFromSlug,
  parseGraphPath,
  resolveGraphLocation,
  sanitizeName,
  slugifyGroupName,
  ensureManifestGroups,
  upsertManifestGroup,
} from './project';
import { graphDocumentSchema } from './validation';

const cloneNode = (node: GraphNode): GraphNode => ({
  ...node,
  position: { ...node.position },
  data: node.data
    ? {
        overrides: node.data.overrides ? { ...node.data.overrides } : undefined,
        controls: node.data.controls ? { ...node.data.controls } : undefined,
      }
    : undefined,
});

const cloneEdge = (edge: GraphEdge): GraphEdge => ({
  ...edge,
  source: { ...edge.source },
  target: { ...edge.target },
});

const cloneGraphDocument = (doc: GraphDocument): GraphDocument => ({
  schemaVersion: GRAPH_SCHEMA_VERSION,
  name: doc.name,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  nodes: doc.nodes.map(cloneNode),
  edges: doc.edges.map(cloneEdge),
  comments: doc.comments
    ? doc.comments.map((comment) => ({
        id: comment.id ?? nanoid(),
        nodeId: comment.nodeId,
        position: comment.position ? { ...comment.position } : undefined,
        text: comment.text ?? '',
        pinned: Boolean(comment.pinned),
        collapsed: Boolean(comment.collapsed),
      }))
    : undefined,
});

const sanitizeManifestGraph = (
  graphId: string,
  entry: Partial<ProjectManifestGraph>,
  document: ProjectDocument,
) => {
  const graphDoc = document.graphs[graphId];
  const fallbackName = graphDoc ? graphDoc.name : '未命名节点图';
  const resolved = resolveGraphLocation(graphId, entry.path, {
    groupNameHint: entry.groupName ?? DEFAULT_GROUP_NAME,
  });
  ensureManifestGroups(document.manifest);
  upsertManifestGroup(document.manifest, {
    topFolder: resolved.location.topFolder,
    categoryKey: resolved.location.categoryKey,
    groupSlug: resolved.location.groupSlug,
    groupName: resolved.location.groupName,
  });

  const normalized: ProjectManifestGraph = {
    graphId,
    name: sanitizeName(entry.name ?? fallbackName, fallbackName),
    path: resolved.normalizedPath,
    groupName: entry.groupName ?? resolved.location.groupName,
    createdAt: entry.createdAt ?? graphDoc?.createdAt,
    updatedAt: entry.updatedAt ?? graphDoc?.updatedAt,
  };
  return normalized;
};

export interface NormalizeProjectResult {
  document: ProjectDocument;
  warnings: string[];
}

export const normalizeProjectDocument = (document: ProjectDocument): NormalizeProjectResult => {
  const warnings: string[] = [];
  const normalized: ProjectDocument = {
    manifest: {
      manifestVersion: document.manifest.manifestVersion ?? PROJECT_MANIFEST_VERSION,
      appVersion: document.manifest.appVersion,
      project: {
        id: document.manifest.project.id,
        name: sanitizeName(document.manifest.project.name, '未命名项目'),
      },
      graphs: [],
      groups: [],
    },
    graphs: {},
  };

  if (Array.isArray(document.manifest.groups)) {
    document.manifest.groups.forEach((group) => {
      upsertManifestGroup(normalized.manifest, group);
    });
  }
  ensureManifestGroups(normalized.manifest);

  for (const [graphId, graphDoc] of Object.entries(document.graphs)) {
    normalized.graphs[graphId] = cloneGraphDocument(graphDoc);
  }

  const seen = new Set<string>();
  for (const manifestEntry of document.manifest.graphs) {
    if (!manifestEntry?.graphId) continue;
    if (!normalized.graphs[manifestEntry.graphId]) {
      warnings.push(`节点图 ${manifestEntry.graphId} 缺少对应的 JSON 数据，已跳过。`);
      continue;
    }
    const sanitized = sanitizeManifestGraph(manifestEntry.graphId, manifestEntry, normalized);
    normalized.manifest.graphs.push(sanitized);
    seen.add(manifestEntry.graphId);
  }

  for (const graphId of Object.keys(normalized.graphs)) {
    if (seen.has(graphId)) continue;
    const sanitized = sanitizeManifestGraph(graphId, {}, normalized);
    normalized.manifest.graphs.push(sanitized);
  }

  ensureManifestGroups(normalized.manifest);

  return { document: normalized, warnings };
};

export interface LoadProjectOptions {
  fallbackAppVersion: string;
}

export interface LoadProjectResult {
  document: ProjectDocument;
  warnings: string[];
}

export const loadProjectFromZip = async (
  blob: Blob,
  options: LoadProjectOptions,
): Promise<LoadProjectResult> => {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(blob);

  let manifestData: Partial<ProjectManifest> | null = null;
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    try {
      const content = await manifestFile.async('string');
      manifestData = JSON.parse(content) as Partial<ProjectManifest>;
    } catch (error) {
      warnings.push(`读取 manifest.json 失败：${String(error)}`);
    }
  } else {
    warnings.push('压缩包缺少 manifest.json，将尝试自动构建。');
  }

  const baseDocument = createEmptyProjectDocument({
    projectId: manifestData?.project?.id,
    name: manifestData?.project?.name ?? '未命名项目',
    appVersion: manifestData?.appVersion ?? options.fallbackAppVersion,
  });
  const document: ProjectDocument = {
    manifest: {
      ...baseDocument.manifest,
      manifestVersion: manifestData?.manifestVersion ?? PROJECT_MANIFEST_VERSION,
      appVersion: manifestData?.appVersion ?? options.fallbackAppVersion,
    },
    graphs: {},
  };
  if (Array.isArray(manifestData?.groups)) {
    (manifestData.groups as ProjectManifestGroup[]).forEach((group) => {
      upsertManifestGroup(document.manifest, group);
    });
  }
  ensureManifestGroups(document.manifest);

  const manifsetEntries: Array<Partial<ProjectManifestGraph>> = Array.isArray(
    manifestData?.graphs,
  )
    ? manifestData?.graphs ?? []
    : [];

  const availableGraphFiles = new Map<
    string,
    {
      path: string;
      locationPath: string;
      groupName: string;
      document: GraphDocument;
    }
  >();

  const fileEntries = Object.entries(zip.files);
  for (const [rawPath, zipObject] of fileEntries) {
    if (zipObject.dir) continue;
    const normalizedPath = rawPath.replace(/^\/+/, '');
    if (normalizedPath === 'manifest.json') continue;
    if (!normalizedPath.endsWith('.json')) continue;
    if (!normalizedPath.startsWith('server/') && !normalizedPath.startsWith('client/')) {
      continue;
    }

    try {
      const content = await zipObject.async('string');
      const parsed = graphDocumentSchema.parse(JSON.parse(content));
      const normalizedComments: GraphComment[] = [];
      if (Array.isArray(parsed.comments)) {
        for (const comment of parsed.comments) {
          const nodeId = (comment.nodeId ?? '').trim();
          if (!nodeId) continue;
          const commentId =
            comment.id && comment.id.trim().length > 0 ? comment.id : nanoid();
          normalizedComments.push({
            id: commentId,
            nodeId,
            text: comment.text ?? '',
            pinned: Boolean(comment.pinned),
            collapsed: Boolean(comment.collapsed),
          });
        }
      }
      const graphDocument: GraphDocument = {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        name: parsed.name,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
        nodes: parsed.nodes.map(cloneNode),
        edges: parsed.edges.map(cloneEdge),
        comments: normalizedComments,
      };
      const parsedPath = parseGraphPath(normalizedPath);
      let graphId: string;
      let locationPath: string;
      let groupName = DEFAULT_GROUP_NAME;
      if (parsedPath) {
        graphId = parsedPath.fileStem;
        groupName = parsedPath.location.groupName;
        locationPath = buildGraphPath(parsedPath.location, graphId);
        upsertManifestGroup(document.manifest, {
          topFolder: parsedPath.location.topFolder,
          categoryKey: parsedPath.location.categoryKey,
          groupSlug: parsedPath.location.groupSlug,
          groupName: parsedPath.location.groupName,
        });
      } else {
        graphId = createProjectId();
        const fallbackLocation = resolveGraphLocation(graphId, undefined);
        locationPath = fallbackLocation.normalizedPath;
        warnings.push(`文件路径 ${normalizedPath} 无法识别，已自动放入 ${fallbackLocation.normalizedPath}`);
      }
      availableGraphFiles.set(graphId, {
        path: normalizedPath,
        locationPath,
        groupName,
        document: graphDocument,
      });
    } catch (error) {
      warnings.push(`解析 ${normalizedPath} 时出错：${String(error)}`);
    }
  }

  ensureManifestGroups(document.manifest);

  const assignedGraphIds = new Set<string>();

  for (const entry of manifsetEntries) {
    let graphId = typeof entry.graphId === 'string' && entry.graphId.trim().length > 0
      ? entry.graphId.trim()
      : undefined;

    if (!graphId && typeof entry.path === 'string') {
      const parsed = parseGraphPath(entry.path);
      if (parsed) {
        graphId = parsed.fileStem;
      }
    }

    if (!graphId) {
      graphId = createProjectId();
      warnings.push('manifest.json 中存在缺少 graphId 的记录，已自动分配新的 graphId。');
    }

    const available = availableGraphFiles.get(graphId);
    if (!available) {
      warnings.push(`manifest.json 中的节点图 ${graphId} 在压缩包中找不到对应的 JSON 文件，已跳过。`);
      continue;
    }
    assignedGraphIds.add(graphId);
    document.graphs[graphId] = cloneGraphDocument(available.document);
    const sanitized = sanitizeManifestGraph(graphId, entry, document);
    document.manifest.graphs.push(sanitized);
  }

  for (const [graphId, payload] of availableGraphFiles.entries()) {
    if (assignedGraphIds.has(graphId)) continue;
    document.graphs[graphId] = cloneGraphDocument(payload.document);
    const sanitized = sanitizeManifestGraph(graphId, { path: payload.locationPath, groupName: payload.groupName }, document);
    document.manifest.graphs.push(sanitized);
  }

  const { document: normalizedDocument, warnings: normalizeWarnings } =
    normalizeProjectDocument(document);

  return {
    document: normalizedDocument,
    warnings: warnings.concat(normalizeWarnings),
  };
};

export interface SaveProjectOptions {
  pretty?: boolean;
  timestamp?: string;
}

export interface SaveProjectResult {
  blob: Blob;
  document: ProjectDocument;
  warnings: string[];
}

export const saveProjectToZip = async (
  document: ProjectDocument,
  options: SaveProjectOptions = {},
): Promise<SaveProjectResult> => {
  const { document: normalized, warnings } = normalizeProjectDocument(document);
  const outputZip = new JSZip();

  for (const definition of PROJECT_CATEGORY_DEFINITIONS) {
    outputZip.folder(
      `${definition.topFolder}/${definition.directory}/${DEFAULT_GROUP_SLUG}/`,
    );
  }

  const timestamp = options.timestamp ?? new Date().toISOString();

  for (const entry of normalized.manifest.graphs) {
    const graphDoc = normalized.graphs[entry.graphId];
    if (!graphDoc) {
      warnings.push(`节点图 ${entry.graphId} 缺少 JSON 数据，未导出。`);
      continue;
    }
    const serialized = JSON.stringify(
      {
        ...graphDoc,
        schemaVersion: GRAPH_SCHEMA_VERSION,
        updatedAt: graphDoc.updatedAt ?? timestamp,
      },
      null,
      options.pretty === false ? undefined : 2,
    );
    outputZip.file(entry.path, serialized);
  }

  const manifestPayload: ProjectManifest = {
    manifestVersion: normalized.manifest.manifestVersion ?? PROJECT_MANIFEST_VERSION,
    appVersion: normalized.manifest.appVersion,
    project: normalized.manifest.project,
    graphs: normalized.manifest.graphs.map((entry) => ({
      ...entry,
      groupName:
        entry.groupName ??
        deriveGroupNameFromSlug(
          entry.path.split('/')[2] ?? slugifyGroupName(DEFAULT_GROUP_NAME),
        ),
    })),
    groups: normalized.manifest.groups,
  };

  outputZip.file(
    'manifest.json',
    JSON.stringify(manifestPayload, null, options.pretty === false ? undefined : 2),
  );

  const blob = await outputZip.generateAsync({ type: 'blob' });
  return {
    blob,
    document: normalized,
    warnings,
  };
};
