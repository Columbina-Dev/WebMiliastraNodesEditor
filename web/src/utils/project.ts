import { nanoid } from 'nanoid/non-secure';
import type { GraphDocument } from '../types/node';
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORIES_BY_TOP,
  PROJECT_CATEGORY_BY_DIRECTORY,
  PROJECT_CATEGORY_BY_KEY,
  PROJECT_MANIFEST_VERSION,
  type ProjectDocument,
  type ProjectGraphDescriptor,
  type ProjectGraphLocation,
  type ProjectManifest,
  type ProjectManifestGraph,
  type ProjectManifestGroup,
  type ProjectTopFolder,
} from '../types/project';
import type { StructDocument, StructManifestEntry } from '../types/struct';
import {
  DEFAULT_STRUCT_GROUP_NAME,
  DEFAULT_STRUCT_GROUP_SLUG,
  DEFAULT_STRUCT_KIND,
  type StructKind,
  type StructManifestGroup,
  type StructParamType,
} from '../types/struct';

const INVALID_PATH_CHARS = /[\\:*?"<>|]/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export const GRAPH_FILE_EXTENSION = '.json';
export const STRUCT_FILE_EXTENSION = '.json';

export const createProjectId = () => nanoid();
export const createStructId = () =>
  Math.floor(1_000_000_000 + Math.random() * 9_000_000_000).toString();

export const sanitizeName = (value: string, fallback: string) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const sanitizePathSegment = (segment: string, fallback: string) => {
  const trimmed = (segment ?? '').trim();
  if (!trimmed) return fallback;
  const replaced = trimmed.replace(CONTROL_CHARS, '').replace(INVALID_PATH_CHARS, '-');
  const compact = replaced.replace(/\s+/g, '-').replace(/-+/g, '-');
  const trimmedDots = compact.replace(/^\.+/, '').replace(/\.+$/, '');
  return trimmedDots.length > 0 ? trimmedDots : fallback;
};

const DEFAULT_NAME_SLUG = sanitizePathSegment(DEFAULT_GROUP_NAME, DEFAULT_GROUP_SLUG).toLowerCase();
const DEFAULT_STRUCT_NAME_SLUG = sanitizePathSegment(
  DEFAULT_STRUCT_GROUP_NAME,
  DEFAULT_STRUCT_GROUP_SLUG,
).toLowerCase();

export const slugifyGroupName = (groupName: string) => {
  const normalized = sanitizeName(groupName, DEFAULT_GROUP_NAME);
  if (normalized === DEFAULT_GROUP_NAME) {
    return DEFAULT_GROUP_SLUG;
  }
  const sanitized = sanitizePathSegment(normalized, DEFAULT_GROUP_SLUG).toLowerCase();
  if (!sanitized || sanitized === DEFAULT_GROUP_SLUG || sanitized === DEFAULT_NAME_SLUG) {
    return DEFAULT_GROUP_SLUG;
  }
  return sanitized;
};

export const deriveGroupNameFromSlug = (slug: string) => {
  if (!slug || slug === DEFAULT_GROUP_SLUG) {
    return DEFAULT_GROUP_NAME;
  }
  try {
    const decoded = decodeURIComponent(slug);
    if (decoded.trim().length > 0) {
      return decoded;
    }
  } catch {
    // noop
  }
  const spaced = slug.replace(/[-_]+/g, ' ').trim();
  return spaced.length > 0 ? spaced : slug;
};

export const slugifyStructGroupName = (groupName: string) => {
  const normalized = sanitizeName(groupName, DEFAULT_STRUCT_GROUP_NAME);
  if (normalized === DEFAULT_STRUCT_GROUP_NAME) {
    return DEFAULT_STRUCT_GROUP_SLUG;
  }
  const sanitized = sanitizePathSegment(normalized, DEFAULT_STRUCT_GROUP_SLUG).toLowerCase();
  if (!sanitized || sanitized === DEFAULT_STRUCT_GROUP_SLUG || sanitized === DEFAULT_STRUCT_NAME_SLUG) {
    return DEFAULT_STRUCT_GROUP_SLUG;
  }
  return sanitized;
};

export const deriveStructGroupNameFromSlug = (slug: string) => {
  if (!slug || slug === DEFAULT_STRUCT_GROUP_SLUG) {
    return DEFAULT_STRUCT_GROUP_NAME;
  }
  try {
    const decoded = decodeURIComponent(slug);
    if (decoded.trim().length > 0) {
      return decoded;
    }
  } catch {
    // noop
  }
  const spaced = slug.replace(/[-_]+/g, ' ').trim();
  return spaced.length > 0 ? spaced : slug;
};

const groupKey = (group: { topFolder: ProjectTopFolder; categoryKey: string; groupSlug: string }) =>
  `${group.topFolder}:${group.categoryKey}:${group.groupSlug}`;

export const ensureManifestGroups = (manifest: ProjectManifest) => {
  if (!Array.isArray(manifest.groups)) {
    manifest.groups = [];
  }
  const known = new Map<string, ProjectManifestGroup>();
  manifest.groups.forEach((group) => {
    known.set(groupKey(group), group);
  });
  for (const category of Object.values(PROJECT_CATEGORIES_BY_TOP).flat()) {
    const key = groupKey({
      topFolder: category.topFolder,
      categoryKey: category.key,
      groupSlug: DEFAULT_GROUP_SLUG,
    });
    if (!known.has(key)) {
      const entry: ProjectManifestGroup = {
        topFolder: category.topFolder,
        categoryKey: category.key,
        groupSlug: DEFAULT_GROUP_SLUG,
        groupName: DEFAULT_GROUP_NAME,
      };
      manifest.groups.push(entry);
      known.set(key, entry);
    }
  }

  manifest.groups = manifest.groups.map((group) => {
    const originalSlug = (group.groupSlug ?? '').trim();
    const normalizedSlugInput = originalSlug
      ? sanitizePathSegment(originalSlug, DEFAULT_GROUP_SLUG).toLowerCase()
      : '';
    const sanitizedName = sanitizeName(group.groupName, DEFAULT_GROUP_NAME);
    const shouldUseDefault =
      !originalSlug ||
      normalizedSlugInput === DEFAULT_GROUP_SLUG ||
      normalizedSlugInput === DEFAULT_NAME_SLUG ||
      sanitizedName === DEFAULT_GROUP_NAME;
    const normalizedSlug = shouldUseDefault
      ? DEFAULT_GROUP_SLUG
      : (normalizedSlugInput || slugifyGroupName(sanitizedName));
    return {
      ...group,
      groupSlug: normalizedSlug,
      groupName: shouldUseDefault ? DEFAULT_GROUP_NAME : sanitizedName,
    };
  });

  return manifest.groups;
};

const structGroupKey = (group: { groupSlug: string }) => group.groupSlug || DEFAULT_STRUCT_GROUP_SLUG;

export const ensureStructManifestGroups = (manifest: ProjectManifest) => {
  if (!Array.isArray(manifest.structGroups)) {
    manifest.structGroups = [];
  }
  const known = new Map<string, StructManifestGroup>();
  manifest.structGroups.forEach((group) => {
    known.set(`${group.structType ?? DEFAULT_STRUCT_KIND}:${structGroupKey(group)}`, group);
  });
  (['basic', 'runtime'] as StructKind[]).forEach((kind) => {
    const baseKey = `${kind}:${structGroupKey({ groupSlug: DEFAULT_STRUCT_GROUP_SLUG })}`;
    if (!known.has(baseKey)) {
      const entry: StructManifestGroup = {
        groupSlug: DEFAULT_STRUCT_GROUP_SLUG,
        groupName: DEFAULT_STRUCT_GROUP_NAME,
        structType: kind,
        sortOrder: 0,
      };
      manifest.structGroups!.push(entry);
      known.set(baseKey, entry);
    }
  });
  manifest.structGroups = manifest.structGroups.map((group, index) => {
    const originalSlug = (group.groupSlug ?? '').trim();
    const normalizedSlugInput = originalSlug
      ? sanitizePathSegment(originalSlug, DEFAULT_STRUCT_GROUP_SLUG).toLowerCase()
      : '';
    const sanitizedName = sanitizeName(group.groupName, DEFAULT_STRUCT_GROUP_NAME);
    const shouldUseDefault =
      !originalSlug ||
      normalizedSlugInput === DEFAULT_STRUCT_GROUP_SLUG ||
      normalizedSlugInput === DEFAULT_STRUCT_NAME_SLUG ||
      sanitizedName === DEFAULT_STRUCT_GROUP_NAME;
    const normalizedSlug = shouldUseDefault
      ? DEFAULT_STRUCT_GROUP_SLUG
      : normalizedSlugInput || slugifyStructGroupName(sanitizedName);
    return {
      ...group,
      groupSlug: normalizedSlug,
      groupName: shouldUseDefault ? DEFAULT_STRUCT_GROUP_NAME : sanitizedName,
      structType: group.structType ?? DEFAULT_STRUCT_KIND,
      sortOrder: group.sortOrder ?? index,
    };
  });
  return manifest.structGroups;
};

export const upsertStructManifestGroup = (
  manifest: ProjectManifest,
  group: StructManifestGroup,
) => {
  ensureStructManifestGroups(manifest);
  const key = structGroupKey(group);
  const index = manifest.structGroups?.findIndex((item) => structGroupKey(item) === key) ?? -1;
  if (index >= 0 && manifest.structGroups) {
    manifest.structGroups[index] = group;
  } else if (manifest.structGroups) {
    manifest.structGroups.push(group);
  }
};

export const removeStructManifestGroup = (manifest: ProjectManifest, groupSlug: string) => {
  ensureStructManifestGroups(manifest);
  manifest.structGroups = (manifest.structGroups ?? []).filter(
    (group) => structGroupKey(group) !== structGroupKey({ groupSlug }),
  );
  ensureStructManifestGroups(manifest);
};

export const upsertManifestGroup = (manifest: ProjectManifest, group: ProjectManifestGroup) => {
  ensureManifestGroups(manifest);
  const key = groupKey(group);
  const index = manifest.groups.findIndex((item) => groupKey(item) === key);
  if (index >= 0) {
    manifest.groups[index] = group;
  } else {
    manifest.groups.push(group);
  }
};

export const removeManifestGroup = (
  manifest: ProjectManifest,
  topFolder: ProjectTopFolder,
  categoryKey: string,
  groupSlug: string,
) => {
  ensureManifestGroups(manifest);
  manifest.groups = manifest.groups.filter(
    (group) => groupKey(group) !== groupKey({ topFolder, categoryKey, groupSlug }),
  );
  ensureManifestGroups(manifest);
};

export const buildGraphPath = (location: ProjectGraphLocation, graphId: string) => {
  const safeId = sanitizePathSegment(graphId, graphId || 'graph');
  const groupSegment = location.groupSlug || DEFAULT_GROUP_SLUG;
  return `${location.topFolder}/${location.categoryDirectory}/${groupSegment}/${safeId}${GRAPH_FILE_EXTENSION}`;
};

export const buildStructPath = (structType: StructKind, groupSlug: string, structId: string) => {
  const safeId = sanitizePathSegment(structId, structId || 'struct');
  const safeGroup = groupSlug
    ? sanitizePathSegment(groupSlug, DEFAULT_STRUCT_GROUP_SLUG)
    : DEFAULT_STRUCT_GROUP_SLUG;
  const typeSegment = structType === 'runtime' ? 'save' : 'basic';
  return `struct/${typeSegment}/${safeGroup || DEFAULT_STRUCT_GROUP_SLUG}/${safeId}${STRUCT_FILE_EXTENSION}`;
};

export interface ProjectGroupDescriptor {
  topFolder: ProjectTopFolder;
  categoryKey: string;
  groupSlug: string;
  groupName: string;
  graphCount: number;
  isDefault: boolean;
}

export const listProjectGroupDescriptors = (
  document: ProjectDocument,
  topFolder: ProjectTopFolder,
  categoryKey?: string,
): ProjectGroupDescriptor[] => {
  ensureManifestGroups(document.manifest);
  const categories = PROJECT_CATEGORIES_BY_TOP[topFolder];
  const categorySet = categoryKey
    ? categories.filter((item) => item.key === categoryKey)
    : categories;

  const counts = new Map<string, number>();
  document.manifest.graphs.forEach((entry) => {
    const resolved = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
      preferredTopFolder: topFolder,
      fallbackCategoryKey: categoryKey,
    });
    const key = groupKey({
      topFolder: resolved.location.topFolder,
      categoryKey: resolved.location.categoryKey,
      groupSlug: resolved.location.groupSlug,
    });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const descriptors: ProjectGroupDescriptor[] = [];
  for (const category of categorySet) {
    const groups = document.manifest.groups.filter(
      (group) => group.topFolder === topFolder && group.categoryKey === category.key,
    );
    groups.forEach((group) => {
      const key = groupKey(group);
      descriptors.push({
        topFolder: group.topFolder,
        categoryKey: group.categoryKey,
        groupSlug: group.groupSlug,
        groupName: group.groupName,
        graphCount: counts.get(key) ?? 0,
        isDefault: group.groupSlug === DEFAULT_GROUP_SLUG,
      });
    });
  }

  descriptors.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-CN'));
  return descriptors;
};

export interface ParsedGraphPathResult {
  location: ProjectGraphLocation;
  fileStem: string;
}

export interface ParsedStructPathResult {
  groupSlug: string;
  groupName: string;
  structType: StructKind;
  fileStem: string;
}

export const parseGraphPath = (path: string): ParsedGraphPathResult | null => {
  if (!path) return null;
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length !== 4) {
    return null;
  }
  const [topSegment, categorySegment, groupSegment, fileName] = segments;
  if (topSegment !== 'server' && topSegment !== 'client') {
    return null;
  }
  const category = PROJECT_CATEGORY_BY_DIRECTORY.get(categorySegment);
  if (!category || category.topFolder !== topSegment) {
    return null;
  }
  if (!fileName.toLowerCase().endsWith(GRAPH_FILE_EXTENSION)) {
    return null;
  }
  const stem = fileName.slice(0, -GRAPH_FILE_EXTENSION.length);
  if (!stem) {
    return null;
  }
  let decodedGroup = groupSegment;
  try {
    decodedGroup = decodeURIComponent(groupSegment);
  } catch {
    decodedGroup = groupSegment;
  }
  const loweredGroup = decodedGroup.toLowerCase();
  const sanitizedSegment = sanitizePathSegment(groupSegment, DEFAULT_GROUP_SLUG).toLowerCase();
  const groupSlug =
    !loweredGroup ||
    loweredGroup === DEFAULT_GROUP_SLUG ||
    loweredGroup === DEFAULT_NAME_SLUG
      ? DEFAULT_GROUP_SLUG
      : sanitizedSegment || DEFAULT_GROUP_SLUG;
  const groupName = deriveGroupNameFromSlug(groupSlug);
  const location: ProjectGraphLocation = {
    topFolder: topSegment,
    categoryKey: category.key,
    categoryDirectory: category.directory,
    groupSlug,
    groupName,
  };
  return { location, fileStem: stem };
};

export const parseStructPath = (path: string): ParsedStructPathResult | null => {
  if (!path) return null;
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length !== 4) {
    return null;
  }
  const [rootSegment, typeSegment, groupSegment, fileName] = segments;
  if (rootSegment !== 'struct') {
    return null;
  }
  const structType: StructKind =
    typeSegment === 'save' ? 'runtime' : 'basic';
  if (!fileName.toLowerCase().endsWith(STRUCT_FILE_EXTENSION)) {
    return null;
  }
  const stem = fileName.slice(0, -STRUCT_FILE_EXTENSION.length);
  if (!stem) return null;
  let decodedGroup = groupSegment;
  try {
    decodedGroup = decodeURIComponent(groupSegment);
  } catch {
    decodedGroup = groupSegment;
  }
  const loweredGroup = decodedGroup.toLowerCase();
  const sanitizedSegment = sanitizePathSegment(groupSegment, DEFAULT_STRUCT_GROUP_SLUG).toLowerCase();
  const groupSlug =
    !loweredGroup ||
    loweredGroup === DEFAULT_STRUCT_GROUP_SLUG ||
    loweredGroup === DEFAULT_STRUCT_NAME_SLUG
      ? DEFAULT_STRUCT_GROUP_SLUG
      : sanitizedSegment || DEFAULT_STRUCT_GROUP_SLUG;
  const groupName = deriveStructGroupNameFromSlug(groupSlug);
  return { groupSlug, groupName, structType, fileStem: stem };
};

export interface ResolveGraphLocationOptions {
  preferredTopFolder?: ProjectTopFolder;
  fallbackCategoryKey?: string;
  groupNameHint?: string;
}

export interface ResolvedGraphLocation {
  location: ProjectGraphLocation;
  normalizedPath: string;
  issues: string[];
}

const pickDefaultCategory = (topFolder: ProjectTopFolder) => {
  const categories = PROJECT_CATEGORIES_BY_TOP[topFolder];
  if (!categories.length) {
    throw new Error(`No categories registered for ${topFolder}`);
  }
  return categories[0];
};

export const resolveGraphLocation = (
  graphId: string,
  path: string | undefined,
  options: ResolveGraphLocationOptions = {},
): ResolvedGraphLocation => {
  const issues: string[] = [];
  const preferredTop = options.preferredTopFolder ?? 'server';
  let fallbackCategoryDefinition =
    options.fallbackCategoryKey
      ? PROJECT_CATEGORY_BY_KEY.get(options.fallbackCategoryKey)
      : undefined;
  if (!fallbackCategoryDefinition || fallbackCategoryDefinition.topFolder !== preferredTop) {
    fallbackCategoryDefinition = pickDefaultCategory(preferredTop);
  }

  if (path) {
    const parsed = parseGraphPath(path);
    if (parsed) {
      const location = parsed.location;
      const normalizedPath = buildGraphPath(location, graphId);
      return { location, normalizedPath, issues };
    }
    issues.push(`无效的路径：${path}`);
  }

  const groupName = sanitizeName(options.groupNameHint ?? DEFAULT_GROUP_NAME, DEFAULT_GROUP_NAME);
  const groupSlug = groupName === DEFAULT_GROUP_NAME ? DEFAULT_GROUP_SLUG : slugifyGroupName(groupName);
  const location: ProjectGraphLocation = {
    topFolder: fallbackCategoryDefinition.topFolder,
    categoryKey: fallbackCategoryDefinition.key,
    categoryDirectory: fallbackCategoryDefinition.directory,
    groupSlug,
    groupName: groupName || DEFAULT_GROUP_NAME,
  };
  const normalizedPath = buildGraphPath(location, graphId);
  return { location, normalizedPath, issues };
};

export interface ResolveStructLocationOptions {
  groupNameHint?: string;
  preferredGroupSlug?: string;
  structType?: StructKind;
}

export interface ResolvedStructLocation {
  groupSlug: string;
  groupName: string;
  normalizedPath: string;
  issues: string[];
}

export const resolveStructLocation = (
  structId: string,
  path: string | undefined,
  options: ResolveStructLocationOptions = {},
): ResolvedStructLocation => {
  const issues: string[] = [];
  if (path) {
    const parsed = parseStructPath(path);
    if (parsed) {
      const normalizedPath = buildStructPath(parsed.structType, parsed.groupSlug, structId);
      return {
        groupSlug: parsed.groupSlug,
        groupName: parsed.groupName,
        structType: parsed.structType,
        normalizedPath,
        issues,
      };
    }
    issues.push(`无效的结构体路径：${path}`);
  }
  const groupName = sanitizeName(
    options.groupNameHint ?? deriveStructGroupNameFromSlug(options.preferredGroupSlug ?? ''),
    DEFAULT_STRUCT_GROUP_NAME,
  );
  const groupSlug =
    groupName === DEFAULT_STRUCT_GROUP_NAME
      ? DEFAULT_STRUCT_GROUP_SLUG
      : slugifyStructGroupName(groupName);
  const structType: StructKind = options.structType ?? DEFAULT_STRUCT_KIND;
  const normalizedPath = buildStructPath(structType, groupSlug, structId);
  return {
    groupSlug,
    groupName,
    structType,
    normalizedPath,
    issues,
  };
};

export interface CreateProjectDocumentOptions {
  projectId?: string;
  name?: string;
  appVersion: string;
}

export const createEmptyProjectDocument = ({
  projectId,
  name,
  appVersion,
}: CreateProjectDocumentOptions): ProjectDocument => {
  const id = projectId ?? createProjectId();
  const projectName = sanitizeName(name ?? '未命名项目', '未命名项目');
  const manifest: ProjectManifest = {
    manifestVersion: PROJECT_MANIFEST_VERSION,
    appVersion,
    project: {
      id,
      name: projectName,
    },
    graphs: [],
    groups: [],
    structGroups: [],
    structures: [],
  };
  ensureManifestGroups(manifest);
  ensureStructManifestGroups(manifest);
  return {
    manifest,
    graphs: {},
    structs: {},
  };
};

export const listProjectGraphDescriptors = (
  document: ProjectDocument,
): ProjectGraphDescriptor[] => {
  ensureManifestGroups(document.manifest);
  return document.manifest.graphs.map((entry) => {
    const resolved = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
    });
    return {
      graphId: entry.graphId,
      name: entry.name,
      location: resolved.location,
    };
  });
};

export interface ProjectStructDescriptor {
  structId: string;
  name: string;
  groupSlug: string;
  groupName: string;
  structType: StructKind;
}

export const listProjectStructDescriptors = (
  document: ProjectDocument,
): ProjectStructDescriptor[] => {
  ensureStructManifestGroups(document.manifest);
  const entries = document.manifest.structures ?? [];
  return entries.map((entry) => {
    const resolved = resolveStructLocation(entry.structId, entry.path, {
      groupNameHint: entry.groupName,
      preferredGroupSlug: entry.groupSlug,
    });
    return {
      structId: entry.structId,
      name: entry.name,
      groupSlug: resolved.groupSlug,
      groupName: resolved.groupName,
      structType: entry.structType ?? DEFAULT_STRUCT_KIND,
    };
  });
};

export const upsertManifestEntry = (
  manifest: ProjectManifest,
  entry: ProjectManifestGraph,
) => {
  const index = manifest.graphs.findIndex((item) => item.graphId === entry.graphId);
  if (index >= 0) {
    manifest.graphs[index] = entry;
  } else {
    manifest.graphs.push(entry);
  }
};

export const removeManifestEntry = (manifest: ProjectManifest, graphId: string) => {
  const next = manifest.graphs.filter((item) => item.graphId !== graphId);
  manifest.graphs.splice(0, manifest.graphs.length, ...next);
};

export const upsertStructManifestEntry = (
  manifest: ProjectManifest,
  entry: StructManifestEntry,
) => {
  ensureStructManifestGroups(manifest);
  const list = manifest.structures ?? [];
  const index = list.findIndex((item) => item.structId === entry.structId);
  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }
  manifest.structures = list;
};

export const removeStructManifestEntry = (manifest: ProjectManifest, structId: string) => {
  if (!manifest.structures) return;
  const next = manifest.structures.filter((item) => item.structId !== structId);
  manifest.structures = next;
};

export const attachGraphToDocument = (
  document: ProjectDocument,
  graphId: string,
  graph: GraphDocument,
) => {
  document.graphs[graphId] = graph;
};

export const detachGraphFromDocument = (document: ProjectDocument, graphId: string) => {
  delete document.graphs[graphId];
};

export const attachStructToDocument = (
  document: ProjectDocument,
  structId: string,
  structDoc: StructDocument,
) => {
  if (!document.structs) {
    document.structs = {};
  }
  document.structs[structId] = structDoc;
};

export const detachStructFromDocument = (document: ProjectDocument, structId: string) => {
  if (!document.structs) return;
  delete document.structs[structId];
};
