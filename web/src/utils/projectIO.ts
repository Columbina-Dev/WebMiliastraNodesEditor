import JSZip from 'jszip';
import { nanoid } from 'nanoid/non-secure';
import VERSION_INFO from '../config/version';
import type {
  GraphComment,
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphEnvironment,
} from '../types/node';
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
import type { StructDocument, StructManifestEntry, StructManifestGroup, StructKind } from '../types/struct';
import {
  DEFAULT_STRUCT_GROUP_NAME,
  DEFAULT_STRUCT_GROUP_SLUG,
  DEFAULT_STRUCT_KIND,
} from '../types/struct';
import {
  buildGraphPath,
  createEmptyProjectDocument,
  createProjectId,
  createStructId,
  deriveGroupNameFromSlug,
  parseGraphPath,
  resolveGraphLocation,
  sanitizeName,
  slugifyGroupName,
  ensureManifestGroups,
  upsertManifestGroup,
  buildStructPath,
  ensureStructManifestGroups,
  parseStructPath,
  resolveStructLocation,
  upsertStructManifestGroup,
  deriveStructGroupNameFromSlug,
  slugifyStructGroupName,
} from './project';
import { graphDocumentSchema } from './validation';
import {
  clientKindFromEnvironment,
  getDefaultExecutionInterval,
  getEnvironmentTopFolder,
  isGraphEnvironmentValue,
  normalizeGraphEnvironment,
  resolveEnvironmentFromLocation,
  sanitizeExecutionInterval,
} from '../utils/graphEnvironment';
import { t as translateText } from './i18n';
import { loadEditorSettings } from './storage';

const translateUi = (key: string, params?: Record<string, string | number>) => {
  const settings = loadEditorSettings();
  return translateText(key, settings.uiPrimaryLanguage, settings.uiSecondaryLanguage, params);
};

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
  environment: doc.environment,
  executionIntervalSeconds: doc.executionIntervalSeconds,
});

const cloneStructDocument = (doc: StructDocument): StructDocument => ({
  type: 'Struct',
  struct_type: doc.struct_type ?? doc.struct_ype ?? DEFAULT_STRUCT_KIND,
  struct_ype: doc.struct_ype ?? doc.struct_type ?? DEFAULT_STRUCT_KIND,
  name: sanitizeName(doc.name, translateUi('struct.defaultName')),
  config_id: doc.config_id,
  value: Array.isArray(doc.value)
    ? doc.value.map((entry) => ({
        key: sanitizeName(entry.key, translateUi('struct.field.defaultKey')),
        param_type: entry.param_type,
        value: entry.value ? JSON.parse(JSON.stringify(entry.value)) : { param_type: entry.param_type, value: null },
      }))
    : [],
});

const sanitizeManifestGraph = (
  graphId: string,
  entry: Partial<ProjectManifestGraph>,
  document: ProjectDocument,
) => {
  const graphDoc = document.graphs[graphId];
  const fallbackName = graphDoc ? graphDoc.name : translateUi('graph.defaultName');
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

const sanitizeStructManifest = (
  structId: string,
  entry: Partial<StructManifestEntry>,
  document: ProjectDocument,
) => {
  const structDoc = document.structs?.[structId];
  const fallbackName = structDoc ? structDoc.name : translateUi('struct.defaultName');
  const resolved = resolveStructLocation(structId, entry.path, {
    groupNameHint: entry.groupName ?? entry.groupSlug,
    preferredGroupSlug: entry.groupSlug,
    structType: entry.structType ?? structDoc?.struct_type ?? structDoc?.struct_ype ?? DEFAULT_STRUCT_KIND,
  });
  ensureStructManifestGroups(document.manifest);
  upsertStructManifestGroup(document.manifest, {
    groupSlug: resolved.groupSlug,
    groupName: resolved.groupName,
    structType: resolved.structType,
  });
  const normalized: StructManifestEntry = {
    structId,
    name: sanitizeName(entry.name ?? fallbackName, fallbackName),
    path: resolved.normalizedPath,
    groupName: entry.groupName ?? resolved.groupName,
    groupSlug: entry.groupSlug ?? resolved.groupSlug,
    structType: resolved.structType,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
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
        name: sanitizeName(document.manifest.project.name, translateUi('project.defaultName')),
      },
      graphs: [],
      groups: [],
      structGroups: [],
      structures: [],
    },
    graphs: {},
    structs: {},
  };

  if (Array.isArray(document.manifest.groups)) {
    document.manifest.groups.forEach((group) => {
      upsertManifestGroup(normalized.manifest, group);
    });
  }
  ensureManifestGroups(normalized.manifest);
  if (Array.isArray(document.manifest.structGroups)) {
    (document.manifest.structGroups as StructManifestGroup[]).forEach((group) => {
      upsertStructManifestGroup(normalized.manifest, group);
    });
  }
  ensureStructManifestGroups(normalized.manifest);

  for (const [graphId, graphDoc] of Object.entries(document.graphs)) {
    normalized.graphs[graphId] = cloneGraphDocument(graphDoc);
  }
  if (document.structs) {
    for (const [structId, structDoc] of Object.entries(document.structs)) {
      normalized.structs![structId] = cloneStructDocument(structDoc);
    }
  }

  const seen = new Set<string>();
  for (const manifestEntry of document.manifest.graphs) {
    if (!manifestEntry?.graphId) continue;
    if (!normalized.graphs[manifestEntry.graphId]) {
      warnings.push(
        translateUi('projectIO.warning.graphMissingJson', { graphId: manifestEntry.graphId }),
      );
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

  const seenStructs = new Set<string>();
  for (const entry of document.manifest.structures ?? []) {
    if (!entry?.structId) continue;
    if (normalized.structs && !normalized.structs[entry.structId]) {
      warnings.push(translateUi('projectIO.warning.structMissingJson', { structId: entry.structId }));
      continue;
    }
    const sanitized = sanitizeStructManifest(entry.structId, entry, normalized);
    normalized.manifest.structures?.push(sanitized);
    seenStructs.add(entry.structId);
  }

  for (const structId of Object.keys(normalized.structs ?? {})) {
    if (seenStructs.has(structId)) continue;
    const sanitized = sanitizeStructManifest(structId, {}, normalized);
    normalized.manifest.structures?.push(sanitized);
  }

  ensureManifestGroups(normalized.manifest);
  ensureStructManifestGroups(normalized.manifest);

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
      warnings.push(
        translateUi('projectIO.warning.manifestReadFailed', { error: String(error) }),
      );
    }
  } else {
    warnings.push(translateUi('projectIO.warning.manifestMissing'));
  }

  const baseDocument = createEmptyProjectDocument({
    projectId: manifestData?.project?.id,
    name: manifestData?.project?.name ?? translateUi('project.defaultName'),
    appVersion: manifestData?.appVersion ?? options.fallbackAppVersion,
  });
  const document: ProjectDocument = {
    manifest: {
      ...baseDocument.manifest,
      manifestVersion: manifestData?.manifestVersion ?? PROJECT_MANIFEST_VERSION,
      appVersion: manifestData?.appVersion ?? options.fallbackAppVersion,
    },
    graphs: {},
    structs: {},
  };
  if (Array.isArray(manifestData?.groups)) {
    (manifestData.groups as ProjectManifestGroup[]).forEach((group) => {
      upsertManifestGroup(document.manifest, group);
    });
  }
  ensureManifestGroups(document.manifest);
  if (Array.isArray(manifestData?.structGroups)) {
    (manifestData.structGroups as StructManifestGroup[]).forEach((group) => {
      upsertStructManifestGroup(document.manifest, group);
    });
  }
  ensureStructManifestGroups(document.manifest);

  const manifsetEntries: Array<Partial<ProjectManifestGraph>> = Array.isArray(
    manifestData?.graphs,
  )
    ? manifestData?.graphs ?? []
    : [];
  const manifestStructEntries: Array<Partial<StructManifestEntry>> = Array.isArray(
    manifestData?.structures,
  )
    ? (manifestData?.structures as StructManifestEntry[])
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
  const availableStructFiles = new Map<
    string,
    {
      path: string;
      locationPath: string;
      groupSlug: string;
      groupName: string;
      structType: StructKind;
      document: StructDocument;
    }
  >();

  const fileEntries = Object.entries(zip.files);
  for (const [rawPath, zipObject] of fileEntries) {
    if (zipObject.dir) continue;
    const normalizedPath = rawPath.replace(/^\/+/, '');
    if (normalizedPath === 'manifest.json') continue;
    if (!normalizedPath.endsWith('.json')) continue;
    const isGraphPath =
      normalizedPath.startsWith('server/') || normalizedPath.startsWith('client/');
    const isStructPath = normalizedPath.startsWith('struct/');
    if (!isGraphPath && !isStructPath) continue;

    try {
      const content = await zipObject.async('string');
      if (isStructPath) {
        const parsed = JSON.parse(content) as StructDocument;
        if (!parsed || parsed.type !== 'Struct') {
          throw new Error('文件不是有效的结构体 JSON');
        }
        const parsedPath = parseStructPath(normalizedPath);
        let structId: string;
        let locationPath: string;
        let groupSlug = DEFAULT_STRUCT_GROUP_SLUG;
        let groupName = DEFAULT_STRUCT_GROUP_NAME;
        let structType = DEFAULT_STRUCT_KIND;
        if (parsedPath) {
          structId = parsedPath.fileStem;
          groupSlug = parsedPath.groupSlug;
          groupName = parsedPath.groupName;
          structType = parsedPath.structType;
          locationPath = buildStructPath(structType, parsedPath.groupSlug, structId);
          upsertStructManifestGroup(document.manifest, {
            groupSlug: parsedPath.groupSlug,
            groupName: parsedPath.groupName,
            structType,
          });
        } else {
          structId = createStructId();
          const fallback = resolveStructLocation(structId, undefined, { structType });
          groupSlug = fallback.groupSlug;
          groupName = fallback.groupName;
          structType = fallback.structType;
          locationPath = fallback.normalizedPath;
          warnings.push(
            translateUi('projectIO.warning.unknownFilePathMoved', {
              path: normalizedPath,
              target: fallback.normalizedPath,
            }),
          );
        }
        const structDocument: StructDocument = cloneStructDocument(parsed);
        availableStructFiles.set(structId, {
          path: normalizedPath,
          locationPath,
          groupSlug,
          groupName,
          structType,
          document: structDocument,
        });
      } else {
        const parsed = graphDocumentSchema.parse(JSON.parse(content));
        const declaredEnvironment = isGraphEnvironmentValue(parsed.environment)
          ? normalizeGraphEnvironment(parsed.environment)
          : undefined;
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
        const parsedPath = parseGraphPath(normalizedPath);
        let graphId: string;
        let locationPath: string;
        let groupName = DEFAULT_GROUP_NAME;
        let location: ReturnType<typeof resolveGraphLocation>['location'];
        if (parsedPath) {
          graphId = parsedPath.fileStem;
          groupName = parsedPath.location.groupName;
          locationPath = buildGraphPath(parsedPath.location, graphId);
          location = parsedPath.location;
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
          groupName = fallbackLocation.location.groupName;
          location = fallbackLocation.location;
          warnings.push(
            translateUi('projectIO.warning.unknownFilePathMoved', {
              path: normalizedPath,
              target: fallbackLocation.normalizedPath,
            }),
          );
        }
        const environmentFromLocation = resolveEnvironmentFromLocation(location);
        const fallbackKind = clientKindFromEnvironment(environmentFromLocation) ?? undefined;
        const normalizedDeclared =
          declaredEnvironment && getEnvironmentTopFolder(declaredEnvironment) === location.topFolder
            ? normalizeGraphEnvironment(declaredEnvironment, { fallbackClientKind: fallbackKind })
            : null;
        const effectiveEnvironment: GraphEnvironment =
          normalizedDeclared ?? environmentFromLocation;
        const defaultInterval = getDefaultExecutionInterval(effectiveEnvironment);
        const executionIntervalSeconds =
          defaultInterval !== undefined
            ? sanitizeExecutionInterval(
                parsed.executionIntervalSeconds ?? defaultInterval,
                defaultInterval,
              )
            : 0;
        const graphDocument: GraphDocument = {
          schemaVersion: GRAPH_SCHEMA_VERSION,
          name: parsed.name,
          createdAt: parsed.createdAt,
          updatedAt: parsed.updatedAt,
          nodes: parsed.nodes.map(cloneNode),
          edges: parsed.edges.map(cloneEdge),
          comments: normalizedComments,
          environment: effectiveEnvironment,
          executionIntervalSeconds,
        };

        availableGraphFiles.set(graphId, {
          path: normalizedPath,
          locationPath,
          groupName,
          document: graphDocument,
        });
      }
    } catch (error) {
      warnings.push(
        translateUi('projectIO.warning.parseFailed', { path: normalizedPath, error: String(error) }),
      );
    }
  }

  ensureManifestGroups(document.manifest);
  ensureStructManifestGroups(document.manifest);

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
      warnings.push(translateUi('projectIO.warning.manifestMissingGraphId'));
    }

    const available = availableGraphFiles.get(graphId);
    if (!available) {
      warnings.push(translateUi('projectIO.warning.manifestGraphFileMissing', { graphId }));
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

  const assignedStructIds = new Set<string>();

  for (const entry of manifestStructEntries) {
    let structId = typeof entry.structId === 'string' && entry.structId.trim().length > 0
      ? entry.structId.trim()
      : undefined;
    if (!structId && typeof entry.path === 'string') {
      const parsed = parseStructPath(entry.path);
      if (parsed) {
        structId = parsed.fileStem;
      }
    }
    if (!structId) {
      structId = createStructId();
      warnings.push(translateUi('projectIO.warning.manifestMissingStructId'));
    }
    const available = availableStructFiles.get(structId);
    if (!available) {
      warnings.push(translateUi('projectIO.warning.manifestStructFileMissing', { structId }));
      continue;
    }
    assignedStructIds.add(structId);
    document.structs![structId] = cloneStructDocument(available.document);
    const sanitized = sanitizeStructManifest(structId, entry, document);
    document.manifest.structures?.push(sanitized);
  }

  for (const [structId, payload] of availableStructFiles.entries()) {
    if (assignedStructIds.has(structId)) continue;
    document.structs![structId] = cloneStructDocument(payload.document);
    const sanitized = sanitizeStructManifest(
      structId,
      { path: payload.locationPath, groupName: payload.groupName, groupSlug: payload.groupSlug, structType: payload.structType },
      document,
    );
    document.manifest.structures?.push(sanitized);
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
  const editorVersion = VERSION_INFO.editor || normalized.manifest.appVersion || '';
  if (editorVersion) {
    normalized.manifest.appVersion = editorVersion;
  }
  const outputZip = new JSZip();

  for (const definition of PROJECT_CATEGORY_DEFINITIONS) {
    outputZip.folder(
      `${definition.topFolder}/${definition.directory}/${DEFAULT_GROUP_SLUG}/`,
    );
  }
  outputZip.folder(`struct/basic/${DEFAULT_STRUCT_GROUP_SLUG}/`);
  outputZip.folder(`struct/save/${DEFAULT_STRUCT_GROUP_SLUG}/`);

  const timestamp = options.timestamp ?? new Date().toISOString();

  for (const entry of normalized.manifest.graphs) {
    const graphDoc = normalized.graphs[entry.graphId];
    if (!graphDoc) {
      warnings.push(translateUi('projectIO.warning.exportGraphMissingJson', { graphId: entry.graphId }));
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
  for (const entry of normalized.manifest.structures ?? []) {
    const structDoc = normalized.structs?.[entry.structId];
    if (!structDoc) {
      warnings.push(translateUi('projectIO.warning.exportStructMissingJson', { structId: entry.structId }));
      continue;
    }
    const serializedStruct = JSON.stringify(
      {
        ...structDoc,
        struct_type: structDoc.struct_type ?? structDoc.struct_ype ?? entry.structType ?? DEFAULT_STRUCT_KIND,
        struct_ype: structDoc.struct_ype ?? structDoc.struct_type ?? entry.structType ?? DEFAULT_STRUCT_KIND,
      },
      null,
      options.pretty === false ? undefined : 2,
    );
    outputZip.file(entry.path, serializedStruct);
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
    structGroups: normalized.manifest.structGroups ?? [],
    structures: (normalized.manifest.structures ?? []).map((entry) => {
      const derivedSlug = entry.path.split('/')[1] ?? DEFAULT_STRUCT_GROUP_SLUG;
      const groupSlug = entry.groupSlug ?? derivedSlug;
      return {
        ...entry,
        groupSlug,
        groupName:
          entry.groupName ??
          deriveStructGroupNameFromSlug(
            groupSlug || slugifyStructGroupName(DEFAULT_STRUCT_GROUP_NAME),
          ),
      };
    }),
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
