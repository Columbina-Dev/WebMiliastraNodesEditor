import type { GraphDocument, GraphEnvironment } from '../types/node';
import { GRAPH_SCHEMA_VERSION } from '../types/node';
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORIES_BY_TOP,
  type ProjectDocument,
  type ProjectGraphLocation,
  type ProjectTopFolder,
} from '../types/project';
import { buildGraphPath, createEmptyProjectDocument } from './project';
import {
  clientKindFromEnvironment,
  getDefaultExecutionInterval,
  normalizeGraphEnvironment,
  sanitizeExecutionInterval,
} from './graphEnvironment';
import {
  detectDefaultUiLanguage,
  getDefaultSecondaryLanguage,
  isUiLanguage,
  t as translateText,
  type UiLanguage,
} from './i18n';

const STORAGE_NAMESPACE = 'miliastra-editor';
const KEY_LAYOUT = STORAGE_NAMESPACE + ':layout';
const KEY_PROJECTS = STORAGE_NAMESPACE + ':projects';
const KEY_AUTOSAVES = STORAGE_NAMESPACE + ':autosaves';
const KEY_SESSION = STORAGE_NAMESPACE + ':session';
const KEY_SETTINGS = STORAGE_NAMESPACE + ':settings';
const KEY_MIGRATION_V2 = STORAGE_NAMESPACE + ':migration:v2';

const LEGACY_TOP_FOLDER: ProjectTopFolder = 'server';
const LEGACY_CATEGORY_KEY = 'entity';

export const AUTOSAVE_LIMIT = 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface LegacyStoredProject {
  id: string;
  name: string;
  savedAt: string;
  document: GraphDocument;
}

interface LegacyAutoSaveEntry {
  savedAt: string;
  document: GraphDocument;
}

const isLegacyGraphDocument = (value: unknown): value is GraphDocument => {
  if (!isRecord(value)) return false;
  if (typeof value.name !== 'string') return false;
  if (!Array.isArray((value as { nodes?: unknown }).nodes)) return false;
  if (!Array.isArray((value as { edges?: unknown }).edges)) return false;
  return true;
};

const isProjectDocumentLike = (value: unknown): value is ProjectDocument => {
  if (!isRecord(value)) return false;
  const manifest = (value as { manifest?: unknown }).manifest;
  if (!isRecord(manifest)) return false;
  const project = manifest.project;
  if (!isRecord(project)) return false;
  if (typeof project.id !== 'string') return false;
  if (typeof project.name !== 'string') return false;
  if (!Array.isArray(manifest.graphs)) return false;
  const graphs = (value as { graphs?: unknown }).graphs;
  if (!isRecord(graphs)) return false;
  if (manifest.groups !== undefined && !Array.isArray(manifest.groups)) return false;
  return true;
};

const getLegacyLocation = (): ProjectGraphLocation => {
  const categories = PROJECT_CATEGORIES_BY_TOP[LEGACY_TOP_FOLDER] ?? [];
  const categoryDefinition =
    categories.find((item) => item.key === LEGACY_CATEGORY_KEY) ?? categories[0];
  return {
    topFolder: LEGACY_TOP_FOLDER,
    categoryKey: categoryDefinition?.key ?? LEGACY_CATEGORY_KEY,
    categoryDirectory: categoryDefinition?.directory ?? LEGACY_CATEGORY_KEY,
    groupSlug: DEFAULT_GROUP_SLUG,
    groupName: DEFAULT_GROUP_NAME,
  };
};

export interface LayoutState {
  paletteCollapsed: boolean;
  inspectorCollapsed: boolean;
}

export interface StoredProject {
  id: string;
  name: string;
  savedAt: string;
  document: ProjectDocument;
}

export interface AutoSaveEntry {
  savedAt: string;
  document: ProjectDocument;
}

export type AutoSaveMap = Record<string, AutoSaveEntry[]>;

export interface SessionState {
  lastActiveProjectId?: string;
  lastVisitedView?: 'home' | 'editor' | 'tutorial' | 'effects' | 'settings';
}

export type EditorPanButton = 'right' | 'middle';
export type EditorZoomControl = 'wheel' | 'keys' | 'both';
export type EditorSelectionActivation = 'drag' | 'click';
export type EditorMultiSelectBehavior =
  | 'touch'
  | 'box'
  | 'leftTouchRightBox'
  | 'leftBoxRightTouch';
export type GiaUidMode = 'perExport' | 'perSession' | 'fixed';
export type PointerStyle = 'sandbox' | 'system';

const DEFAULT_UI_PRIMARY_LANGUAGE: UiLanguage = detectDefaultUiLanguage();
const DEFAULT_UI_SECONDARY_LANGUAGE: UiLanguage = getDefaultSecondaryLanguage(DEFAULT_UI_PRIMARY_LANGUAGE);
const DEFAULT_GRAPH_NAME = translateText('graph.defaultName', DEFAULT_UI_PRIMARY_LANGUAGE, DEFAULT_UI_SECONDARY_LANGUAGE);

export interface EditorSettings {
  uiPrimaryLanguage: UiLanguage;
  uiSecondaryLanguage: UiLanguage;
  allowSearchAllLanguageNodeNames: boolean;
  panButton: EditorPanButton;
  zoomControl: EditorZoomControl;
  selectionActivation: EditorSelectionActivation;
  multiSelectBehavior: EditorMultiSelectBehavior;
  enterInputOnNodeInsert: boolean;
  enableGilExport: boolean;
  enableGiaExport: boolean;
  giaUidMode: GiaUidMode;
  giaFixedUid: string;
  pointerStyle: PointerStyle;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  uiPrimaryLanguage: DEFAULT_UI_PRIMARY_LANGUAGE,
  uiSecondaryLanguage: DEFAULT_UI_SECONDARY_LANGUAGE,
  allowSearchAllLanguageNodeNames: false,
  panButton: 'right',
  zoomControl: 'wheel',
  selectionActivation: 'drag',
  multiSelectBehavior: 'touch',
  enterInputOnNodeInsert: true,
  enableGilExport: false,
  enableGiaExport: false,
  giaUidMode: 'perExport',
  giaFixedUid: '',
  pointerStyle: 'sandbox',
};

const DEFAULT_LAYOUT: LayoutState = {
  paletteCollapsed: false,
  inspectorCollapsed: false,
};

const getStorage = (): Storage | undefined =>
  typeof window !== 'undefined' ? window.localStorage : undefined;

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const persist = (key: string, value: unknown) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const convertLegacyGraphToProjectDocument = (
  projectId: string,
  projectName: string,
  graph: GraphDocument,
  savedAt: string,
  topFolder: ProjectTopFolder = LEGACY_TOP_FOLDER,
): ProjectDocument => {
  const fallbackEnvironment: GraphEnvironment = topFolder === 'client' ? 'client:skill' : 'server';
  const fallbackKind = clientKindFromEnvironment(fallbackEnvironment) ?? undefined;
  const environment: GraphEnvironment = graph.environment
    ? normalizeGraphEnvironment(graph.environment, { fallbackClientKind: fallbackKind })
    : fallbackEnvironment;
  const defaultInterval = getDefaultExecutionInterval(environment);
  const executionIntervalSeconds =
    defaultInterval !== undefined
      ? sanitizeExecutionInterval(
          graph.executionIntervalSeconds ?? defaultInterval,
          defaultInterval,
        )
      : graph.executionIntervalSeconds;
  const base = createEmptyProjectDocument({
    projectId,
    name: projectName,
    appVersion: 'legacy-import',
  });
  const graphId = projectId;
  const location =
    topFolder === LEGACY_TOP_FOLDER ? getLegacyLocation() : { ...getLegacyLocation(), topFolder };
  const normalizedGraph: GraphDocument = {
    ...graph,
    schemaVersion: graph.schemaVersion ?? GRAPH_SCHEMA_VERSION,
    environment,
    executionIntervalSeconds:
      defaultInterval !== undefined ? executionIntervalSeconds : graph.executionIntervalSeconds,
  };
  base.graphs[graphId] = normalizedGraph;
  base.manifest.graphs.push({
    graphId,
    name: normalizedGraph.name,
    path: buildGraphPath(location, graphId),
    groupName: location.groupName,
    createdAt: normalizedGraph.createdAt ?? savedAt,
    updatedAt: normalizedGraph.updatedAt ?? savedAt,
  });
  return base;
};

const convertLegacyProjectRecord = (value: unknown): StoredProject | null => {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<LegacyStoredProject>;
  if (
    typeof candidate?.id !== 'string' ||
    typeof candidate?.name !== 'string' ||
    typeof candidate?.savedAt !== 'string' ||
    !candidate.document ||
    !isLegacyGraphDocument(candidate.document)
  ) {
    return null;
  }
  const document = convertLegacyGraphToProjectDocument(
    candidate.id,
    candidate.name,
    candidate.document,
    candidate.savedAt,
    LEGACY_TOP_FOLDER,
  );
  return {
    id: document.manifest.project.id,
    name: document.manifest.project.name,
    savedAt: candidate.savedAt,
    document,
  };
};

const convertLegacyAutoSaveEntry = (
  projectId: string,
  value: unknown,
): AutoSaveEntry | null => {
  if (!isRecord(value)) return null;
  const candidate = value as Partial<LegacyAutoSaveEntry>;
  if (typeof candidate?.savedAt !== 'string' || !candidate.document || !isLegacyGraphDocument(candidate.document)) {
    return null;
  }
  const document = convertLegacyGraphToProjectDocument(
    projectId,
    candidate.document.name ?? DEFAULT_GRAPH_NAME,
    candidate.document,
    candidate.savedAt,
    LEGACY_TOP_FOLDER,
  );
  return {
    savedAt: candidate.savedAt,
    document,
  };
};

const migrateLegacyStorage = (storage: Storage): boolean => {
  let migrated = false;
  const rawProjects = safeParse<unknown[]>(storage.getItem(KEY_PROJECTS), []);
  if (Array.isArray(rawProjects) && rawProjects.length) {
    const convertedProjects: StoredProject[] = [];
    let legacyDetected = false;
    for (const entry of rawProjects) {
      if (isProjectDocumentLike((entry as StoredProject)?.document)) {
        convertedProjects.push(entry as StoredProject);
      } else {
        const converted = convertLegacyProjectRecord(entry);
        if (converted) {
          convertedProjects.push(converted);
          legacyDetected = true;
        }
      }
    }
    if (legacyDetected) {
      storage.setItem(KEY_PROJECTS, JSON.stringify(convertedProjects));
      migrated = true;
    }
  }

  const rawAutoSaves = safeParse<Record<string, unknown>>(storage.getItem(KEY_AUTOSAVES), {});
  if (rawAutoSaves && typeof rawAutoSaves === 'object') {
    const convertedAutoSaves: AutoSaveMap = {};
    let legacyDetected = false;
    for (const [projectId, entries] of Object.entries(rawAutoSaves)) {
      if (Array.isArray(entries)) {
        const convertedEntries: AutoSaveEntry[] = [];
        for (const entry of entries) {
          if (
            entry &&
            typeof entry === 'object' &&
            isProjectDocumentLike((entry as AutoSaveEntry).document)
          ) {
            convertedEntries.push(entry as AutoSaveEntry);
          } else {
            const converted = convertLegacyAutoSaveEntry(projectId, entry);
            if (converted) {
              convertedEntries.push(converted);
              legacyDetected = true;
            }
          }
        }
        if (convertedEntries.length) {
          convertedAutoSaves[projectId] = convertedEntries;
        }
      }
    }
    if (legacyDetected) {
      storage.setItem(KEY_AUTOSAVES, JSON.stringify(convertedAutoSaves));
      migrated = true;
    }
  }

  return migrated;
};

const ensureMigration = () => {
  const storage = getStorage();
  if (!storage) return;
  if (storage.getItem(KEY_MIGRATION_V2)) return;
  const didMigrate = migrateLegacyStorage(storage);
  const marker = {
    version: 2,
    migratedAt: new Date().toISOString(),
    changed: didMigrate,
  };
  storage.setItem(KEY_MIGRATION_V2, JSON.stringify(marker));
};

ensureMigration();

export const loadLayoutState = (): LayoutState => {
  const storage = getStorage();
  if (!storage) return DEFAULT_LAYOUT;
  const parsed = safeParse<Partial<LayoutState>>(storage.getItem(KEY_LAYOUT), {});
  return { ...DEFAULT_LAYOUT, ...parsed } as LayoutState;
};

export const persistLayoutState = (layout: LayoutState) => {
  persist(KEY_LAYOUT, layout);
};

export const loadProjects = (): StoredProject[] => {
  const storage = getStorage();
  if (!storage) return [];
  const parsed = safeParse<StoredProject[]>(storage.getItem(KEY_PROJECTS), []);
  if (!Array.isArray(parsed)) return [];
  const sanitized = parsed.filter((item): item is StoredProject => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as StoredProject;
    if (typeof candidate.id !== 'string') return false;
    if (typeof candidate.name !== 'string') return false;
    if (typeof candidate.savedAt !== 'string') return false;
    return isProjectDocumentLike(candidate.document);
  });
  sanitized.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return sanitized;
};

const persistProjects = (projects: StoredProject[]) => {
  persist(KEY_PROJECTS, projects);
};

export const upsertProjectRecord = (record: StoredProject) => {
  const projects = loadProjects().filter((item) => item.id !== record.id);
  projects.unshift(record);
  persistProjects(projects);
};

export const removeProjectRecord = (projectId: string) => {
  const projects = loadProjects().filter((item) => item.id !== projectId);
  persistProjects(projects);
};

export const findProjectRecord = (projectId: string): StoredProject | undefined =>
  loadProjects().find((item) => item.id === projectId);

const sanitizeAutoSaveEntries = (entries: unknown): AutoSaveEntry[] => {
  if (!Array.isArray(entries)) return [];
  const sanitized = entries.filter((entry): entry is AutoSaveEntry => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as AutoSaveEntry;
    if (typeof candidate.savedAt !== 'string') return false;
    return isProjectDocumentLike(candidate.document);
  });
  sanitized.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return sanitized.slice(0, AUTOSAVE_LIMIT);
};

export const loadAutoSaveMap = (): AutoSaveMap => {
  const storage = getStorage();
  if (!storage) return {};
  const parsed = safeParse<Record<string, unknown>>(storage.getItem(KEY_AUTOSAVES), {});
  const map: AutoSaveMap = {};
  for (const [projectId, value] of Object.entries(parsed)) {
    const sanitized = sanitizeAutoSaveEntries(value);
    if (sanitized.length) {
      map[projectId] = sanitized;
    }
  }
  return map;
};

const persistAutoSaveMap = (map: AutoSaveMap) => {
  persist(KEY_AUTOSAVES, map);
};

export const loadAutoSavesForProject = (projectId: string): AutoSaveEntry[] => {
  const map = loadAutoSaveMap();
  return map[projectId] ? [...map[projectId]] : [];
};

export const persistAutoSaveEntry = (
  projectId: string,
  entry: AutoSaveEntry,
  limit = AUTOSAVE_LIMIT
) => {
  const map = loadAutoSaveMap();
  const next = [entry, ...(map[projectId] ?? []).filter((item) => item.savedAt !== entry.savedAt)];
  map[projectId] = next.slice(0, Math.max(limit, 1));
  persistAutoSaveMap(map);
};

export const clearAutoSavesForProject = (projectId: string) => {
  const map = loadAutoSaveMap();
  if (!(projectId in map)) return;
  delete map[projectId];
  persistAutoSaveMap(map);
};

export const replaceAutoSavesForProject = (projectId: string, entries: AutoSaveEntry[]) => {
  const map = loadAutoSaveMap();
  if (!entries.length) {
    delete map[projectId];
  } else {
    map[projectId] = entries.slice(0, AUTOSAVE_LIMIT);
  }
  persistAutoSaveMap(map);
};

export const loadSessionState = (): SessionState => {
  const storage = getStorage();
  if (!storage) return {};
  return safeParse<SessionState>(storage.getItem(KEY_SESSION), {});
};

export const persistSessionState = (session: SessionState) => {
  const normalized: SessionState = {};
  if (session.lastActiveProjectId) {
    normalized.lastActiveProjectId = session.lastActiveProjectId;
  }
  if (session.lastVisitedView) {
    normalized.lastVisitedView = session.lastVisitedView;
  }
  persist(KEY_SESSION, normalized);
};

export const updateSessionState = (updater: (prev: SessionState) => SessionState) => {
  const next = updater(loadSessionState());
  persistSessionState(next);
  return next;
};

export const loadEditorSettings = (): EditorSettings => {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_EDITOR_SETTINGS };
  const parsed = safeParse<Partial<EditorSettings>>(storage.getItem(KEY_SETTINGS), {});
  const merged = { ...DEFAULT_EDITOR_SETTINGS, ...parsed };
  // sanitize legacy values
  const legacySelectionActivation = parsed.selectionActivation as
    | EditorSelectionActivation
    | 'both'
    | undefined;
  if (legacySelectionActivation === 'both') {
    merged.selectionActivation = 'drag';
  }
  if (
    merged.multiSelectBehavior !== 'touch' &&
    merged.multiSelectBehavior !== 'box' &&
    merged.multiSelectBehavior !== 'leftTouchRightBox' &&
    merged.multiSelectBehavior !== 'leftBoxRightTouch'
  ) {
    merged.multiSelectBehavior = DEFAULT_EDITOR_SETTINGS.multiSelectBehavior;
  }
  if (merged.pointerStyle !== 'sandbox' && merged.pointerStyle !== 'system') {
    merged.pointerStyle = DEFAULT_EDITOR_SETTINGS.pointerStyle;
  }
  if (!isUiLanguage(merged.uiPrimaryLanguage)) {
    merged.uiPrimaryLanguage = DEFAULT_EDITOR_SETTINGS.uiPrimaryLanguage;
  }
  merged.uiSecondaryLanguage = getDefaultSecondaryLanguage(merged.uiPrimaryLanguage);
  if (typeof merged.allowSearchAllLanguageNodeNames !== 'boolean') {
    merged.allowSearchAllLanguageNodeNames = DEFAULT_EDITOR_SETTINGS.allowSearchAllLanguageNodeNames;
  }
  return merged;
};

export const persistEditorSettings = (settings: EditorSettings) => {
  persist(KEY_SETTINGS, settings);
};
