import type { ProjectDocument } from '../types/project';

const STORAGE_NAMESPACE = 'miliastra-editor';
const KEY_LAYOUT = STORAGE_NAMESPACE + ':layout';
const KEY_PROJECTS = STORAGE_NAMESPACE + ':projects';
const KEY_AUTOSAVES = STORAGE_NAMESPACE + ':autosaves';
const KEY_SESSION = STORAGE_NAMESPACE + ':session';

export const AUTOSAVE_LIMIT = 4;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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
  lastVisitedView?: 'home' | 'editor' | 'tutorial';
}

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
