import JSZip from 'jszip';
import { create } from 'zustand';
import { GRAPH_SCHEMA_VERSION } from '../types/node';
import type { GraphDocument } from '../types/node';
import {
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORY_BY_KEY,
  type ProjectDocument,
  type ProjectManifestGraph,
  type ProjectTopFolder,
} from '../types/project';
import {
  buildGraphPath,
  createProjectId,
  ensureManifestGroups,
  removeManifestGroup,
  resolveGraphLocation,
  sanitizeName,
  slugifyGroupName,
  upsertManifestGroup,
} from '../utils/project';
const EXPLORER_LABEL: Record<ProjectTopFolder, string> = {
  server: '服务器节点图资源管理器',
  client: '客户端节点图资源管理器',
};
export type ExplorerTabId = `explorer:${ProjectTopFolder}`;
export type GraphTabId = `graph:${string}`;
export type TabId = ExplorerTabId | GraphTabId;
const buildExplorerTabId = (topFolder: ProjectTopFolder): ExplorerTabId =>
  `explorer:${topFolder}`;
const buildGraphTabId = (graphId: string): GraphTabId => `graph:${graphId}`;
export interface ExplorerTab {
  id: ExplorerTabId;
  type: 'explorer';
  topFolder: ProjectTopFolder;
  label: string;
}
export interface GraphTab {
  id: GraphTabId;
  type: 'graph';
  graphId: string;
  label: string;
  topFolder: ProjectTopFolder;
}
export type ProjectTab = ExplorerTab | GraphTab;
const createExplorerTab = (topFolder: ProjectTopFolder): ExplorerTab => ({
  id: buildExplorerTabId(topFolder),
  type: 'explorer',
  topFolder,
  label: EXPLORER_LABEL[topFolder],
});
const DEFAULT_EXPLORER_ORDER: ProjectTopFolder[] = ['server', 'client'];
interface ProjectWorkspaceState {
  document: ProjectDocument | null;
  projectId: string | null;
  projectName: string;
  openTabs: ProjectTab[];
  activeTabId: TabId | null;
  activeGraphId: string | null;
  dirtyGraphIds: Record<string, true>;
  setDocument: (document: ProjectDocument) => void;
  updateDocument: (updater: (document: ProjectDocument) => ProjectDocument | void) => void;
  setProjectName: (name: string) => void;
  setManifestEntry: (entry: ProjectManifestGraph) => void;
  removeManifestEntry: (graphId: string) => void;
  setGraphDocument: (graphId: string, document: GraphDocument) => void;
  removeGraphDocument: (graphId: string) => void;
  openExplorer: (topFolder: ProjectTopFolder) => void;
  openGraphTab: (graphId: string) => void;
  closeTab: (tabId: TabId) => void;
  activateTab: (tabId: TabId) => void;
  markGraphDirty: (graphId: string, dirty?: boolean) => void;
  createGroup: (
    topFolder: ProjectTopFolder,
    categoryKey: string,
    groupName: string,
  ) => { groupSlug: string; groupName: string } | null;
  duplicateGroup: (topFolder: ProjectTopFolder, categoryKey: string, groupSlug: string) => string | null;
  deleteGroup: (topFolder: ProjectTopFolder, categoryKey: string, groupSlug: string) => void;
  exportGroup: (topFolder: ProjectTopFolder, categoryKey: string, groupSlug: string) => Promise<void>;
  reset: () => void;
}
const createInitialState = (): ProjectWorkspaceState => ({
  document: null,
  projectId: null,
  projectName: '未命名项目',
  openTabs: DEFAULT_EXPLORER_ORDER.map((folder) => createExplorerTab(folder)),
  activeTabId: buildExplorerTabId('server'),
  activeGraphId: null,
  dirtyGraphIds: {},
  setDocument: () => undefined,
  updateDocument: () => undefined,
  setProjectName: () => undefined,
  setManifestEntry: () => undefined,
  removeManifestEntry: () => undefined,
  setGraphDocument: () => undefined,
  removeGraphDocument: () => undefined,
  openExplorer: () => undefined,
  openGraphTab: () => undefined,
  closeTab: () => undefined,
  activateTab: () => undefined,
  markGraphDirty: () => undefined,
  createGroup: () => null,
  duplicateGroup: () => null,
  deleteGroup: () => undefined,
  exportGroup: async () => undefined,
  reset: () => undefined,
});
const ensureExplorerTabs = (tabs: ProjectTab[]): ProjectTab[] => {
  const byId = new Map<ProjectTab['id'], ProjectTab>();
  tabs.forEach((tab) => byId.set(tab.id, tab));
  DEFAULT_EXPLORER_ORDER.forEach((folder) => {
    const id = buildExplorerTabId(folder);
    if (!byId.has(id)) {
      byId.set(id, createExplorerTab(folder));
    }
  });
  return DEFAULT_EXPLORER_ORDER.map((folder) => byId.get(buildExplorerTabId(folder))!).concat(
    tabs.filter((tab) => tab.type === 'graph'),
  );
};
const refreshGraphTabLabels = (
  tabs: ProjectTab[],
  document: ProjectDocument,
): ProjectTab[] => {
  const manifestById = new Map(
    document.manifest.graphs.map((entry) => [entry.graphId, entry]),
  );
  return tabs.map((tab) => {
    if (tab.type !== 'graph') return tab;
    const entry = manifestById.get(tab.graphId);
    if (!entry) return tab;
    const { location } = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
    });
    if (tab.label === entry.name && tab.topFolder === location.topFolder) {
      return tab;
    }
    return {
      ...tab,
      label: entry.name,
      topFolder: location.topFolder,
    } satisfies GraphTab;
  });
};
const DEFAULT_NEW_GROUP_NAME = '新建文件夹';
const getCategoryDefinition = (topFolder: ProjectTopFolder, categoryKey: string) => {
  const definition = PROJECT_CATEGORY_BY_KEY.get(categoryKey);
  if (!definition || definition.topFolder !== topFolder) {
    return null;
  }
  return definition;
};
const generateUniqueGroupInfo = (
  manifest: ProjectDocument['manifest'],
  topFolder: ProjectTopFolder,
  categoryKey: string,
  requestedName?: string,
): { groupName: string; groupSlug: string } => {
  ensureManifestGroups(manifest);
  const candidates = manifest.groups.filter(
    (group) => group.topFolder === topFolder && group.categoryKey === categoryKey,
  );
  const existingNames = new Set(candidates.map((group) => group.groupName));
  const existingSlugs = new Set(candidates.map((group) => group.groupSlug));
  const baseName = sanitizeName(requestedName ?? DEFAULT_NEW_GROUP_NAME, DEFAULT_NEW_GROUP_NAME);
  let nameCandidate = baseName;
  let nameIndex = 2;
  while (existingNames.has(nameCandidate)) {
    nameCandidate = `${baseName}-${nameIndex}`;
    nameIndex += 1;
  }
  let slugBase = slugifyGroupName(nameCandidate);
  if (!slugBase || slugBase === DEFAULT_GROUP_SLUG) {
    slugBase = slugifyGroupName(`${nameCandidate}-${Date.now().toString(36)}`);
  }
  let slugCandidate = slugBase;
  let slugIndex = 2;
  while (existingSlugs.has(slugCandidate) || slugCandidate === DEFAULT_GROUP_SLUG) {
    slugCandidate = `${slugBase}-${slugIndex}`;
    slugIndex += 1;
  }
  return { groupName: nameCandidate, groupSlug: slugCandidate };
};
const cloneGraphForDuplication = (source: GraphDocument): GraphDocument =>
  JSON.parse(JSON.stringify({ ...source }));
export const useProjectStore = create<ProjectWorkspaceState>((set, get) => ({
  ...createInitialState(),
  setDocument: (document) => {
    ensureManifestGroups(document.manifest);
    const projectId = document.manifest.project.id;
    const projectName = document.manifest.project.name;
    set(() => ({
      document,
      projectId,
      projectName,
      openTabs: DEFAULT_EXPLORER_ORDER.map((folder) => createExplorerTab(folder)),
      activeTabId: buildExplorerTabId('server'),
      activeGraphId: null,
      dirtyGraphIds: {},
    }));
  },
  updateDocument: (updater) => {
    const current = get().document;
    if (!current) return;
    const draft: ProjectDocument = {
      manifest: {
        ...current.manifest,
        project: { ...current.manifest.project },
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...current.graphs },
    };
    const result = updater(draft);
    const next = (result as ProjectDocument | undefined) ?? draft;
    ensureManifestGroups(next.manifest);
    const projectId = next.manifest.project.id;
    const projectName = next.manifest.project.name;
    set((state) => ({
      document: next,
      projectId,
      projectName,
      openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), next),
    }));
  },
  setProjectName: (name) => {
    const document = get().document;
    if (!document) return;
    const nextName = sanitizeName(name, '未命名项目');
    const nextDocument: ProjectDocument = {
      manifest: {
        ...document.manifest,
        project: { ...document.manifest.project, name: nextName },
        graphs: document.manifest.graphs.map((entry) => ({ ...entry })),
        groups: document.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...document.graphs },
    };
    ensureManifestGroups(nextDocument.manifest);
    set((state) => ({
      document: nextDocument,
      projectId: nextDocument.manifest.project.id,
      projectName: nextName,
      openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
    }));
  },
  setManifestEntry: (entry) => {
    const document = get().document;
    if (!document) return;
    const graphs = document.manifest.graphs.map((item) =>
      item.graphId === entry.graphId ? entry : { ...item },
    );
    if (!graphs.some((item) => item.graphId === entry.graphId)) {
      graphs.push(entry);
    }
    const nextDocument: ProjectDocument = {
      manifest: {
        ...document.manifest,
        project: { ...document.manifest.project },
        graphs,
        groups: document.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...document.graphs },
    };
    const { location } = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
    });
    upsertManifestGroup(nextDocument.manifest, {
      topFolder: location.topFolder,
      categoryKey: location.categoryKey,
      groupSlug: location.groupSlug,
      groupName: location.groupName,
    });
    ensureManifestGroups(nextDocument.manifest);
    set((state) => ({
      document: nextDocument,
      projectId: nextDocument.manifest.project.id,
      projectName: nextDocument.manifest.project.name,
      openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
    }));
  },
  removeManifestEntry: (graphId) => {
    const document = get().document;
    if (!document) return;
    const nextDocument: ProjectDocument = {
      manifest: {
        ...document.manifest,
        project: { ...document.manifest.project },
        graphs: document.manifest.graphs
          .filter((entry) => entry.graphId !== graphId)
          .map((entry) => ({ ...entry })),
        groups: document.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...document.graphs },
    };
    delete nextDocument.graphs[graphId];
    ensureManifestGroups(nextDocument.manifest);
    set((state) => {
      const nextTabs = ensureExplorerTabs(
        state.openTabs.filter((tab) => tab.id !== buildGraphTabId(graphId)),
      );
      const nextDirty = { ...state.dirtyGraphIds };
      delete nextDirty[graphId];
      let nextActiveTabId = state.activeTabId;
      let nextActiveGraphId = state.activeGraphId;
      if (state.activeTabId === buildGraphTabId(graphId)) {
        const fallback =
          nextTabs.find((tab) => tab.type === 'graph') ??
          nextTabs.find((tab) => tab.id === buildExplorerTabId('server')) ??
          nextTabs[0] ??
          null;
        if (fallback) {
          nextActiveTabId = fallback.id;
          nextActiveGraphId = fallback.type === 'graph' ? fallback.graphId : null;
        } else {
          nextActiveTabId = null;
          nextActiveGraphId = null;
        }
      }
      return {
        document: nextDocument,
        projectId: nextDocument.manifest.project.id,
        projectName: nextDocument.manifest.project.name,
        openTabs: refreshGraphTabLabels(nextTabs, nextDocument),
        activeTabId: nextActiveTabId,
        activeGraphId: nextActiveGraphId,
        dirtyGraphIds: nextDirty,
      };
    });
  },
  setGraphDocument: (graphId, document) => {
    const current = get().document;
    if (!current) return;
    const nextGraphs = { ...current.graphs, [graphId]: document };
    const nextDocument: ProjectDocument = {
      manifest: {
        ...current.manifest,
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: nextGraphs,
    };
    ensureManifestGroups(nextDocument.manifest);
    set((state) => ({
      document: nextDocument,
      openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
    }));
  },
  removeGraphDocument: (graphId) => {
    const current = get().document;
    if (!current) return;
    const nextGraphs = { ...current.graphs };
    delete nextGraphs[graphId];
    const nextDocument: ProjectDocument = {
      manifest: {
        ...current.manifest,
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: nextGraphs,
    };
    ensureManifestGroups(nextDocument.manifest);
    set((state) => ({
      document: nextDocument,
      openTabs: refreshGraphTabLabels(
        ensureExplorerTabs(state.openTabs.filter((tab) => tab.id !== buildGraphTabId(graphId))),
        nextDocument,
      ),
    }));
  },
  openExplorer: (topFolder) => {
    const id = buildExplorerTabId(topFolder);
    set((state) => ({
      openTabs: ensureExplorerTabs(state.openTabs),
      activeTabId: id,
      activeGraphId: null,
    }));
  },
  openGraphTab: (graphId) => {
    const document = get().document;
    if (!document) return;
    const entry = document.manifest.graphs.find((item) => item.graphId === graphId);
    if (!entry) return;
    const { location } = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
    });
    const id = buildGraphTabId(graphId);
    set((state) => {
      let tabs = ensureExplorerTabs(state.openTabs);
      const existing = tabs.find((tab) => tab.id === id);
      if (!existing) {
        tabs = tabs.concat({
          id,
          type: 'graph',
          graphId,
          label: entry.name,
          topFolder: location.topFolder,
        });
      } else if (existing.type === 'graph') {
        tabs = tabs.map((tab) =>
          tab.id === id ? { ...existing, label: entry.name, topFolder: location.topFolder } : tab,
        );
      }
      return {
        openTabs: tabs,
        activeTabId: id,
        activeGraphId: graphId,
      };
    });
  },
  closeTab: (tabId) => {
    if (tabId.startsWith('explorer:')) {
      return;
    }
    set((state) => {
      const target = state.openTabs.find((tab) => tab.id === tabId);
      if (!target || target.type !== 'graph') {
        return state;
      }
      const nextTabs = ensureExplorerTabs(
        state.openTabs.filter((tab) => tab.id !== tabId),
      );
      const nextDirty = { ...state.dirtyGraphIds };
      delete nextDirty[target.graphId];
      let nextActiveTabId = state.activeTabId;
      let nextActiveGraphId = state.activeGraphId;
      if (state.activeTabId === tabId) {
        const fallback =
          nextTabs.find((tab) => tab.type === 'graph') ??
          nextTabs.find((tab) => tab.id === buildExplorerTabId('server')) ??
          nextTabs[0] ??
          null;
        if (fallback) {
          nextActiveTabId = fallback.id;
          nextActiveGraphId = fallback.type === 'graph' ? fallback.graphId : null;
        } else {
          nextActiveTabId = null;
          nextActiveGraphId = null;
        }
      }
      return {
        openTabs: nextTabs,
        activeTabId: nextActiveTabId,
        activeGraphId: nextActiveGraphId,
        dirtyGraphIds: nextDirty,
      } as ProjectWorkspaceState;
    });
  },
  activateTab: (tabId) => {
    set((state) => {
      const tab = state.openTabs.find((item) => item.id === tabId);
      if (!tab) return state;
      return {
        activeTabId: tabId,
        activeGraphId: tab.type === 'graph' ? tab.graphId : null,
      };
    });
  },
  markGraphDirty: (graphId, dirty = true) => {
    set((state) => {
      const next = { ...state.dirtyGraphIds };
      if (dirty) {
        next[graphId] = true;
      } else {
        delete next[graphId];
      }
      return {
        dirtyGraphIds: next,
      };
    });
  },
  createGroup: (topFolder, categoryKey, requestedName) => {
    const current = get().document;
    if (!current) return null;
    const category = getCategoryDefinition(topFolder, categoryKey);
    if (!category) return null;
    const nextDocument: ProjectDocument = {
      manifest: {
        ...current.manifest,
        project: { ...current.manifest.project },
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...current.graphs },
    };
    const { groupName, groupSlug } = generateUniqueGroupInfo(
      nextDocument.manifest,
      topFolder,
      categoryKey,
      requestedName,
    );
    upsertManifestGroup(nextDocument.manifest, {
      topFolder,
      categoryKey,
      groupSlug,
      groupName,
    });
    ensureManifestGroups(nextDocument.manifest);
    set((state) => ({
      document: nextDocument,
      projectId: nextDocument.manifest.project.id,
      projectName: nextDocument.manifest.project.name,
      openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
    }));
    return { groupName, groupSlug };
  },
  duplicateGroup: (topFolder, categoryKey, groupSlug) => {
    const current = get().document;
    if (!current) return null;
    const category = getCategoryDefinition(topFolder, categoryKey);
    if (!category) return null;
    const sourceGroup = current.manifest.groups.find(
      (group) =>
        group.topFolder === topFolder &&
        group.categoryKey === categoryKey &&
        group.groupSlug === groupSlug,
    );
    if (!sourceGroup) return null;
    const nextDocument: ProjectDocument = {
      manifest: {
        ...current.manifest,
        project: { ...current.manifest.project },
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...current.graphs },
    };
    const { groupName, groupSlug: newGroupSlug } = generateUniqueGroupInfo(
      nextDocument.manifest,
      topFolder,
      categoryKey,
      `${sourceGroup.groupName} 副本`,
    );
    let createdSlug: string | null = newGroupSlug;
    upsertManifestGroup(nextDocument.manifest, {
      topFolder,
      categoryKey,
      groupSlug: newGroupSlug,
      groupName,
    });
    const timestamp = new Date().toISOString();
    const newGraphIds: string[] = [];
    current.manifest.graphs.forEach((entry) => {
      const { location } = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      if (
        location.topFolder !== topFolder ||
        location.categoryKey !== categoryKey ||
        location.groupSlug !== groupSlug
      ) {
        return;
      }
      const originalGraph = current.graphs[entry.graphId];
      if (!originalGraph) return;
      const clone = cloneGraphForDuplication(originalGraph);
      const newGraphId = createProjectId();
      clone.createdAt = timestamp;
      clone.updatedAt = timestamp;
      nextDocument.graphs[newGraphId] = clone;
      const newLocation = {
        topFolder,
        categoryKey,
        categoryDirectory: category.directory,
        groupSlug: newGroupSlug,
        groupName,
      };
      const newPath = buildGraphPath(newLocation, newGraphId);
      nextDocument.manifest.graphs.push({
        graphId: newGraphId,
        name: clone.name,
        path: newPath,
        groupName,
        createdAt: clone.createdAt,
        updatedAt: clone.updatedAt,
      });
      newGraphIds.push(newGraphId);
    });
    ensureManifestGroups(nextDocument.manifest);
    if (!newGraphIds.length) {
      set((state) => ({
        document: nextDocument,
        projectId: nextDocument.manifest.project.id,
        projectName: nextDocument.manifest.project.name,
        openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
      }));
      return createdSlug;
    }
    set((state) => {
      const nextDirty = { ...state.dirtyGraphIds };
      newGraphIds.forEach((id) => {
        nextDirty[id] = true;
      });
      return {
        document: nextDocument,
        projectId: nextDocument.manifest.project.id,
        projectName: nextDocument.manifest.project.name,
        openTabs: refreshGraphTabLabels(ensureExplorerTabs(state.openTabs), nextDocument),
        dirtyGraphIds: nextDirty,
      };
    });
    return createdSlug;
  },
  deleteGroup: (topFolder, categoryKey, groupSlug) => {
    if (groupSlug === DEFAULT_GROUP_SLUG) return;
    const current = get().document;
    if (!current) return;
    const category = getCategoryDefinition(topFolder, categoryKey);
    if (!category) return;
    const nextDocument: ProjectDocument = {
      manifest: {
        ...current.manifest,
        project: { ...current.manifest.project },
        graphs: current.manifest.graphs.map((entry) => ({ ...entry })),
        groups: current.manifest.groups.map((group) => ({ ...group })),
      },
      graphs: { ...current.graphs },
    };
    const removedGraphIds: string[] = [];
    nextDocument.manifest.graphs = nextDocument.manifest.graphs.filter((entry) => {
      const { location } = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      const match =
        location.topFolder === topFolder &&
        location.categoryKey === categoryKey &&
        location.groupSlug === groupSlug;
      if (match) {
        removedGraphIds.push(entry.graphId);
        return false;
      }
      return true;
    });
    removedGraphIds.forEach((id) => {
      delete nextDocument.graphs[id];
    });
    removeManifestGroup(nextDocument.manifest, topFolder, categoryKey, groupSlug);
    ensureManifestGroups(nextDocument.manifest);
    set((state) => {
      const nextDirty = { ...state.dirtyGraphIds };
      removedGraphIds.forEach((id) => delete nextDirty[id]);
      const remainingTabs = ensureExplorerTabs(
        state.openTabs.filter(
          (tab) => !(tab.type === 'graph' && removedGraphIds.includes(tab.graphId)),
        ),
      );
      let nextActiveTabId = state.activeTabId;
      let nextActiveGraphId = state.activeGraphId;
      if (nextActiveGraphId && removedGraphIds.includes(nextActiveGraphId)) {
        nextActiveGraphId = null;
      }
      if (
        nextActiveTabId &&
        nextActiveTabId.startsWith('graph:') &&
        removedGraphIds.includes(nextActiveTabId.slice('graph:'.length))
      ) {
        const fallback =
          remainingTabs.find((tab) => tab.type === 'graph') ??
          remainingTabs.find((tab) => tab.id === buildExplorerTabId('server')) ??
          remainingTabs[0] ??
          null;
        nextActiveTabId = fallback ? fallback.id : null;
        nextActiveGraphId = fallback && fallback.type === 'graph' ? fallback.graphId : null;
      }
      return {
        document: nextDocument,
        projectId: nextDocument.manifest.project.id,
        projectName: nextDocument.manifest.project.name,
        openTabs: refreshGraphTabLabels(remainingTabs, nextDocument),
        activeTabId: nextActiveTabId,
        activeGraphId: nextActiveGraphId,
        dirtyGraphIds: nextDirty,
      };
    });
  },
  exportGroup: async (topFolder, categoryKey, groupSlug) => {
    const projectDocument = get().document;
    if (!projectDocument) return;
    const category = getCategoryDefinition(topFolder, categoryKey);
    if (!category) return;
    const group = projectDocument.manifest.groups.find(
      (item) =>
        item.topFolder === topFolder &&
        item.categoryKey === categoryKey &&
        item.groupSlug === groupSlug,
    );
    if (!group) {
      window.alert('未找到指定的文件夹。');
      return;
    }
    const entries = projectDocument.manifest.graphs.filter((entry) => {
      const { location } = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      return (
        location.topFolder === topFolder &&
        location.categoryKey === categoryKey &&
        location.groupSlug === groupSlug
      );
    });
    if (!entries.length) {
      window.alert('该文件夹为空，暂无可导出的节点图。');
      return;
    }
    const zip = new JSZip();
    const timestamp = new Date().toISOString();
    for (const entry of entries) {
      const graphDoc = projectDocument.graphs[entry.graphId];
      if (!graphDoc) continue;
      const { location } = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      const serialized = JSON.stringify(
        {
          ...graphDoc,
          schemaVersion: GRAPH_SCHEMA_VERSION,
          updatedAt: graphDoc.updatedAt ?? timestamp,
        },
        null,
        2,
      );
      zip.file(buildGraphPath(location, entry.graphId), serialized);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = `${group.groupName}-${category.directory}-${topFolder}-${timestamp.replace(
      /[:.]/g,
      '-',
    )}.zip`;
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = 'none';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },
  reset: () => {
    set(() => createInitialState());
  },
}));
