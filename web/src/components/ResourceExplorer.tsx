import classNames from 'classnames';
import { nanoid } from 'nanoid/non-secure';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useProjectStore } from '../state/projectStore';
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORIES_BY_TOP,
  type ProjectDocument,
  type ProjectTopFolder,
} from '../types/project';
import {
  listProjectGraphDescriptors,
  listProjectGroupDescriptors,
  buildGraphPath,
  createProjectId,
  resolveGraphLocation,
} from '../utils/project';
import serverNodeList from '../data/nodeDefinitions.server';
import clientNodeAvailability from '../data/nodeDefinitions.client';
import { nodeDefinitions } from '../data/nodeDefinitions';
import { graphDocumentSchema } from '../utils/validation';
import {
  GRAPH_SCHEMA_VERSION,
  GRAPH_SYSTEM_NODE_IDS,
  type GraphComment,
  type GraphDocument,
  type GraphEnvironment,
} from '../types/node';
import {
  clientKindFromEnvironment,
  getDefaultExecutionInterval,
  getEnvironmentTopFolder,
  isGraphEnvironmentValue,
  normalizeGraphEnvironment,
  resolveEnvironmentFromLocation,
  sanitizeExecutionInterval,
} from '../utils/graphEnvironment';
import { useI18n } from '../utils/i18nContext';
import './ResourceExplorer.css';

interface ResourceExplorerProps {
  topFolder: ProjectTopFolder;
  document: ProjectDocument | null;
  dirtyGraphIds: Record<string, true>;
  onOpenGraph: (graphId: string) => void;
}

const describeEnvironmentLabel = (environment: GraphEnvironment) => {
  const kind = clientKindFromEnvironment(environment);
  return kind ? `client-${kind}` : 'server';
};

type HistoryEntry = string | null;

type ContextMenuState =
  | {
      type: 'empty';
      scope: 'root' | 'folder';
      categoryKey: string;
      groupSlug?: string;
      x: number;
      y: number;
    }
  | { type: 'folder'; x: number; y: number; groupSlug: string; categoryKey: string }
  | { type: 'graph'; x: number; y: number; graphId: string; groupSlug: string; categoryKey: string };

type EditingState =
  | { type: 'folder'; groupSlug: string; categoryKey: string }
  | { type: 'graph'; graphId: string };

type ClipboardItem =
  | {
      kind: 'folder';
      mode: 'copy' | 'cut';
      topFolder: ProjectTopFolder;
      categoryKey: string;
      groupSlug: string;
      groupName: string;
    }
  | {
      kind: 'graph';
      topFolder: ProjectTopFolder;
      categoryKey: string;
      groupSlug: string;
      graphId: string;
      graphName: string;
    };

const ICON_BACK = new URL('../assets/icons/nav-back.svg', import.meta.url).href;
const ICON_FORWARD = new URL('../assets/icons/nav-forward.svg', import.meta.url).href;
const ICON_FILTER = new URL('../assets/icons/filter.svg', import.meta.url).href;
const ICON_SEARCH = new URL('../assets/icons/search.svg', import.meta.url).href;
const ICON_FOLDER = new URL('../assets/icons/folder.svg', import.meta.url).href;
const ICON_GRAPH = new URL('../assets/icons/graph.svg', import.meta.url).href;
const ICON_TAB_SERVER = new URL('../assets/icons/tab-server.svg', import.meta.url).href;
const ICON_TAB_CLIENT = new URL('../assets/icons/tab-client.svg', import.meta.url).href;
const ICON_TOGGLE = new URL('../assets/icons/sidebar-toggle.svg', import.meta.url).href;
const ICON_SORT_ASC = new URL('../assets/icons/srt_asc.png', import.meta.url).href;
const ICON_SORT_DESC = new URL('../assets/icons/srt_des.png', import.meta.url).href;

type ResourceExplorerDialog = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'danger';
  onConfirm?: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
};

const ResourceExplorer = ({ topFolder, document, dirtyGraphIds, onOpenGraph }: ResourceExplorerProps) => {
  const { t } = useI18n();
  const createGroup = useProjectStore((state) => state.createGroup);
  const duplicateGroup = useProjectStore((state) => state.duplicateGroup);
  const deleteGroup = useProjectStore((state) => state.deleteGroup);
  const exportGroup = useProjectStore((state) => state.exportGroup);
  const setGraphDocument = useProjectStore((state) => state.setGraphDocument);
  const setManifestEntry = useProjectStore((state) => state.setManifestEntry);
  const markGraphDirty = useProjectStore((state) => state.markGraphDirty);
  const updateDocument = useProjectStore((state) => state.updateDocument);
  const removeManifestEntry = useProjectStore((state) => state.removeManifestEntry);

  const categories = PROJECT_CATEGORIES_BY_TOP[topFolder];
  const defaultGroupNameLabelRaw = t('common.defaultGroupName');
  const defaultGroupNameLabel = defaultGroupNameLabelRaw.trim() &&
    defaultGroupNameLabelRaw.trim() !== 'structure-manager__group-label'
    ? defaultGroupNameLabelRaw
    : DEFAULT_GROUP_NAME;

  const systemNodeIdSet = useMemo(
    () => new Set<string>(GRAPH_SYSTEM_NODE_IDS as readonly string[]),
    [],
  );
  const fallbackNodeIds = useMemo(
    () => nodeDefinitions.map((definition) => definition.id).filter((id) => !systemNodeIdSet.has(id)),
    [systemNodeIdSet],
  );

  const serverNodeSet = useMemo(() => {
    const ids = serverNodeList.length ? serverNodeList : fallbackNodeIds;
    return new Set(ids.filter((id) => !systemNodeIdSet.has(id)));
  }, [fallbackNodeIds, systemNodeIdSet]);

  const clientNodeSets = useMemo(() => {
    const buildSet = (ids: string[]) => {
      const source = ids.length ? ids : fallbackNodeIds;
      return new Set(source.filter((id) => !systemNodeIdSet.has(id)));
    };
    return {
      'role-skill': buildSet(clientNodeAvailability['role-skill']),
      'creation-skill': buildSet(clientNodeAvailability['creation-skill']),
      'creation-state': buildSet(clientNodeAvailability['creation-state']),
      'creation-state-decision': buildSet(clientNodeAvailability['creation-state-decision']),
      boolean: buildSet(clientNodeAvailability.boolean),
      integer: buildSet(clientNodeAvailability.integer),
    };
  }, [fallbackNodeIds, systemNodeIdSet]);

  const graphValidation = useMemo(() => {
    if (!document) {
      return new Map<string, { errors: string[]; environment: GraphEnvironment }>();
    }
    const map = new Map<string, { errors: string[]; environment: GraphEnvironment }>();
    for (const entry of document.manifest.graphs) {
      const resolved = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      const expectedEnv = resolveEnvironmentFromLocation(resolved.location);
      const graph = document.graphs[entry.graphId];
      if (!graph) continue;
      const errors: string[] = [];
      const declaredEnv = graph.environment
        ? normalizeGraphEnvironment(graph.environment)
        : undefined;
      if (declaredEnv) {
        const declaredTop = getEnvironmentTopFolder(declaredEnv);
        const expectedTop = getEnvironmentTopFolder(expectedEnv);
        if (declaredTop !== expectedTop) {
          errors.push(
            declaredTop === 'client'
              ? t('resourceExplorer.validation.envMismatch.clientInServer')
              : t('resourceExplorer.validation.envMismatch.serverInClient'),
          );
        } else {
          const declaredKind = clientKindFromEnvironment(declaredEnv);
          const expectedKind = clientKindFromEnvironment(expectedEnv);
          if (declaredKind && expectedKind && declaredKind !== expectedKind) {
            errors.push(
              `Graph type mismatch: expected ${describeEnvironmentLabel(
                expectedEnv,
              )}, found ${describeEnvironmentLabel(declaredEnv)}.`,
            );
          }
        }
      }
      const expectedKind = clientKindFromEnvironment(expectedEnv);
      const allowedSet = expectedKind ? clientNodeSets[expectedKind] : serverNodeSet;
      const invalidTypes = Array.from(
        new Set(
          graph.nodes
            .map((node) => node.type)
            .filter(
              (type) =>
                type &&
                !systemNodeIdSet.has(type) &&
                !allowedSet.has(type),
            ),
        ),
      );
      if (invalidTypes.length) {
        errors.push(
          t('resourceExplorer.validation.invalidNodeTypes', { types: invalidTypes.join(', ') }),
        );
      }
      if (errors.length) {
        map.set(entry.graphId, { errors, environment: expectedEnv });
      }
    }
    return map;
  }, [clientNodeSets, document, serverNodeSet, systemNodeIdSet, t]);

  const [activeCategoryKey, setActiveCategoryKey] = useState<string>(() => categories[0]?.key ?? '');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((category) => [category.key, true])),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAscending, setSortAscending] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportTarget, setPendingImportTarget] = useState<{
    groupSlug: string;
    categoryKey: string;
  } | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [dialog, setDialog] = useState<ResourceExplorerDialog | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const dragCounterRef = useRef(0);

  const openInfoDialog = useCallback((title: string, message: ReactNode) => {
    setDialog({
      title,
      message,
      confirmLabel: t('common.ok'),
    });
  }, [t]);

  const attemptOpenGraph = useCallback(
    (graphId: string) => {
      const issues = graphValidation.get(graphId);
      if (issues && issues.errors.length) {
        openInfoDialog(
          t('resourceExplorer.openGraph.errorTitle'),
          <div className="resource-explorer__dialog-message">
            <p>{t('resourceExplorer.openGraph.errorHint')}</p>
            <ul>
              {issues.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>,
        );
        return;
      }
      onOpenGraph(graphId);
    },
    [graphValidation, onOpenGraph, openInfoDialog],
  );

  useEffect(() => {
    const nextActive = categories[0]?.key ?? '';
    setActiveCategoryKey(nextActive);
    setExpandedCategories(Object.fromEntries(categories.map((category) => [category.key, true])));
    setHistory([null]);
    setHistoryIndex(0);
    setSearchTerm('');
  }, [categories]);

  useEffect(() => {
    const handleWindowClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.resource-explorer__context-menu')) {
        return;
      }
      setContextMenu(null);
    };
    const handleWindowContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.resource-explorer__context-menu')) {
        event.preventDefault();
        return;
      }
      if (!target?.closest('.resource-explorer__tbody')) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleWindowClick);
    window.addEventListener('contextmenu', handleWindowContextMenu);
    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('contextmenu', handleWindowContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    const handle = window.setTimeout(() => {
      if (editingInputRef.current) {
        editingInputRef.current.focus();
        editingInputRef.current.select();
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [editing]);

  const allGroups = useMemo(
    () => (document ? listProjectGroupDescriptors(document, topFolder) : []),
    [document, topFolder],
  );

  const groupsByCategory = useMemo(() => {
    const map = new Map<string, typeof allGroups>();
    categories.forEach((category) => {
      map.set(category.key, []);
    });
    allGroups.forEach((group) => {
      if (!map.has(group.categoryKey)) {
        map.set(group.categoryKey, []);
      }
      map.get(group.categoryKey)!.push(group);
    });
    categories.forEach((category) => {
      const list = map.get(category.key) ?? [];
      list.sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-CN'));
      map.set(category.key, list);
    });
    return map;
  }, [allGroups, categories]);

  const groupMap = useMemo(() => new Map(allGroups.map((group) => [group.groupSlug, group])), [allGroups]);

  const allGraphs = useMemo(
    () => (document ? listProjectGraphDescriptors(document) : []),
    [document],
  );

  const currentHistoryEntry = history[historyIndex] ?? null;
  const isRootView = currentHistoryEntry === null;

  const currentCategoryGroups = useMemo(
    () => groupsByCategory.get(activeCategoryKey) ?? [],
    [activeCategoryKey, groupsByCategory],
  );

  const visibleFolders = useMemo(() => {
    const filtered = currentCategoryGroups.filter((group) =>
      group.groupName.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) =>
      sortAscending
        ? a.groupName.localeCompare(b.groupName, 'zh-CN')
        : b.groupName.localeCompare(a.groupName, 'zh-CN'),
    );
    return sorted;
  }, [currentCategoryGroups, searchTerm, sortAscending]);

  const visibleGraphs = useMemo(() => {
    if (isRootView || !currentHistoryEntry) {
      return [];
    }
    const filtered = allGraphs.filter((descriptor) => {
      const { location } = descriptor;
      return (
        location.topFolder === topFolder &&
        location.categoryKey === activeCategoryKey &&
        location.groupSlug === currentHistoryEntry
      );
    });
    const searched = filtered.filter((descriptor) =>
      descriptor.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );
    return [...searched].sort((a, b) =>
      sortAscending
        ? a.name.localeCompare(b.name, 'zh-CN')
        : b.name.localeCompare(a.name, 'zh-CN'),
    );
  }, [activeCategoryKey, allGraphs, currentHistoryEntry, isRootView, searchTerm, sortAscending, topFolder]);

  useEffect(() => {
    if (currentHistoryEntry === null) {
      return;
    }
    if (!groupMap.has(currentHistoryEntry)) {
      setHistory([null]);
      setHistoryIndex(0);
    }
  }, [currentHistoryEntry, groupMap]);

  const findGroupDescriptor = useCallback(
    (groupSlug: string, categoryKey: string) =>
      allGroups.find(
        (group) => group.groupSlug === groupSlug && group.categoryKey === categoryKey,
      ) ?? null,
    [allGroups],
  );

  const getCategoryDefinition = useCallback(
    (categoryKey: string) =>
      categories.find((category) => category.key === categoryKey) ?? null,
    [categories],
  );

  const resetEditing = useCallback(() => {
    setEditing(null);
    setEditingValue('');
  }, []);

  const commitEditing = useCallback(
    (apply: boolean) => {
      if (!editing) return;
      const nextValue = editingValue.trim();
      const currentEditing = editing;
      resetEditing();
      if (!apply) return;

      if (currentEditing.type === 'folder') {
        const project = useProjectStore.getState().document;
        if (!project) return;
        const existingGroup = project.manifest.groups.find(
          (group) =>
            group.topFolder === topFolder &&
            group.categoryKey === currentEditing.categoryKey &&
            group.groupSlug === currentEditing.groupSlug,
        );
        if (!existingGroup) return;
        const finalName = nextValue || existingGroup.groupName;
        if (finalName === existingGroup.groupName) return;
        updateDocument((draft) => {
          const target = draft.manifest.groups.find(
            (group) =>
              group.topFolder === topFolder &&
              group.categoryKey === currentEditing.categoryKey &&
              group.groupSlug === currentEditing.groupSlug,
          );
          if (!target) return;
          target.groupName = finalName;
          draft.manifest.graphs = draft.manifest.graphs.map((entry) => {
            const resolved = resolveGraphLocation(entry.graphId, entry.path, {
              groupNameHint: entry.groupName,
              preferredTopFolder: topFolder,
              fallbackCategoryKey: currentEditing.categoryKey,
            });
            if (
              resolved.location.topFolder === topFolder &&
              resolved.location.categoryKey === currentEditing.categoryKey &&
              resolved.location.groupSlug === currentEditing.groupSlug
            ) {
              return { ...entry, groupName: finalName };
            }
            return entry;
          });
        });
        return;
      }

      if (currentEditing.type === 'graph') {
        const project = useProjectStore.getState().document;
        if (!project) return;
        const manifestEntry = project.manifest.graphs.find(
          (entry) => entry.graphId === currentEditing.graphId,
        );
        if (!manifestEntry) return;
        const finalName = nextValue || manifestEntry.name;
        if (finalName === manifestEntry.name) return;
        const timestamp = new Date().toISOString();
        updateDocument((draft) => {
          const entry = draft.manifest.graphs.find(
            (item) => item.graphId === currentEditing.graphId,
          );
          if (entry) {
            entry.name = finalName;
            entry.updatedAt = timestamp;
          }
          const doc = draft.graphs[currentEditing.graphId];
          if (doc) {
            draft.graphs[currentEditing.graphId] = {
              ...doc,
              name: finalName,
              updatedAt: timestamp,
            };
          }
        });
      }
    },
    [editing, editingValue, resetEditing, topFolder, updateDocument],
  );

  const handleStartFolderRename = useCallback(
    (groupSlug: string, categoryKey: string, initialName: string) => {
      setEditing({ type: 'folder', groupSlug, categoryKey });
      setEditingValue(initialName);
      setContextMenu(null);
    },
    [setContextMenu],
  );

  const handleStartGraphRename = useCallback(
    (graphId: string, initialName: string) => {
      setEditing({ type: 'graph', graphId });
      setEditingValue(initialName);
      setContextMenu(null);
    },
    [setContextMenu],
  );

  const moveGroupToCategory = useCallback(
    (groupSlug: string, fromCategoryKey: string, toCategoryKey: string): string | null => {
      if (fromCategoryKey === toCategoryKey) {
        return groupSlug;
      }
      const project = useProjectStore.getState().document;
      if (!project) {
        openInfoDialog(t('resourceExplorer.error.moveFolder.title'), t('common.noProjectOpen'));
        return null;
      }
      const targetCategory = getCategoryDefinition(toCategoryKey);
      if (!targetCategory) {
        openInfoDialog(t('resourceExplorer.error.moveFolder.title'), t('common.categoryNotFound'));
        return null;
      }
      const sourceGroup = project.manifest.groups.find(
        (group) =>
          group.topFolder === topFolder &&
          group.categoryKey === fromCategoryKey &&
          group.groupSlug === groupSlug,
      );
      if (!sourceGroup) return null;
      let nextSlug = groupSlug;
      const siblings = project.manifest.groups.filter(
        (group) =>
          group.topFolder === topFolder &&
          group.categoryKey === toCategoryKey &&
          group.groupSlug !== groupSlug,
      );
      if (siblings.some((group) => group.groupSlug === nextSlug)) {
        const base = nextSlug;
        let index = 2;
        while (siblings.some((group) => group.groupSlug === `${base}-${index}`)) {
          index += 1;
        }
        nextSlug = `${base}-${index}`;
      }
      updateDocument((draft) => {
        const target = draft.manifest.groups.find(
          (group) =>
            group.topFolder === topFolder &&
            group.categoryKey === fromCategoryKey &&
            group.groupSlug === groupSlug,
        );
        if (!target) return;
        target.categoryKey = toCategoryKey;
        target.groupSlug = nextSlug;
        draft.manifest.graphs = draft.manifest.graphs.map((entry) => {
          const resolved = resolveGraphLocation(entry.graphId, entry.path, {
            groupNameHint: entry.groupName,
            preferredTopFolder: topFolder,
            fallbackCategoryKey: fromCategoryKey,
          });
          if (
            resolved.location.topFolder === topFolder &&
            resolved.location.categoryKey === fromCategoryKey &&
            resolved.location.groupSlug === groupSlug
          ) {
            const updatedLocation = {
              topFolder,
              categoryKey: toCategoryKey,
              categoryDirectory: targetCategory.directory,
              groupSlug: nextSlug,
              groupName: target.groupName,
            };
            return {
              ...entry,
              path: buildGraphPath(updatedLocation, entry.graphId),
              groupName: target.groupName,
            };
          }
          return entry;
        });
      });
      return nextSlug;
    },
    [getCategoryDefinition, openInfoDialog, topFolder, updateDocument],
  );

  const handleCreateFolder = useCallback(() => {
    const created = createGroup(topFolder, activeCategoryKey, t('resourceExplorer.defaultFolderName'));
    setContextMenu(null);
    if (!created) return;
    setEditing({ type: 'folder', groupSlug: created.groupSlug, categoryKey: activeCategoryKey });
    setEditingValue(created.groupName);
  }, [activeCategoryKey, createGroup, setContextMenu, t, topFolder]);

  const handleCopyFolder = useCallback(
    (groupSlug: string, categoryKey: string, groupName: string) => {
      setClipboard({
        kind: 'folder',
        mode: 'copy',
        topFolder,
        categoryKey,
        groupSlug,
        groupName,
      });
      setContextMenu(null);
    },
    [setContextMenu, topFolder],
  );

  const handleCutFolder = useCallback(
    (groupSlug: string, categoryKey: string, groupName: string) => {
      setClipboard({
        kind: 'folder',
        mode: 'cut',
        topFolder,
        categoryKey,
        groupSlug,
        groupName,
      });
      setContextMenu(null);
    },
    [setContextMenu, topFolder],
  );

  const handlePasteFolder = useCallback(() => {
    if (!clipboard || clipboard.kind !== 'folder') {
      setContextMenu(null);
      return;
    }
    if (clipboard.topFolder !== topFolder) {
      openInfoDialog(
        t('resourceExplorer.error.paste.title'),
        t('resourceExplorer.error.paste.folderCrossExplorer'),
      );
      setContextMenu(null);
      return;
    }
    let resultingSlug: string | null = null;
    if (clipboard.mode === 'copy') {
      const duplicatedSlug = duplicateGroup(topFolder, clipboard.categoryKey, clipboard.groupSlug);
      if (!duplicatedSlug) {
        setContextMenu(null);
        return;
      }
      if (clipboard.categoryKey === activeCategoryKey) {
        resultingSlug = duplicatedSlug;
      } else {
        resultingSlug = moveGroupToCategory(
          duplicatedSlug,
          clipboard.categoryKey,
          activeCategoryKey,
        );
      }
    } else {
      resultingSlug = moveGroupToCategory(
        clipboard.groupSlug,
        clipboard.categoryKey,
        activeCategoryKey,
      );
      if (resultingSlug) {
        setClipboard(null);
      }
    }
    setContextMenu(null);
    if (resultingSlug && clipboard.mode === 'copy') {
      const descriptor = findGroupDescriptor(resultingSlug, activeCategoryKey);
      if (descriptor) {
        setEditing({ type: 'folder', groupSlug: descriptor.groupSlug, categoryKey: descriptor.categoryKey });
        setEditingValue(descriptor.groupName);
      }
    }
  }, [
    activeCategoryKey,
    clipboard,
    duplicateGroup,
    findGroupDescriptor,
    moveGroupToCategory,
    openInfoDialog,
    setContextMenu,
    topFolder,
  ]);

  const duplicateGraphInto = useCallback(
    (
      graphId: string,
      targetCategoryKey: string,
      targetGroupSlug: string,
      targetGroupName: string,
    ) => {
      const project = useProjectStore.getState().document;
      if (!project) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('common.noProjectOpen'));
        return null;
      }
      const sourceEntry = project.manifest.graphs.find((entry) => entry.graphId === graphId);
      if (!sourceEntry) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('resourceExplorer.error.copyGraph.entryNotFound'));
        return null;
      }
      const sourceDoc = project.graphs[graphId];
      if (!sourceDoc) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('resourceExplorer.error.copyGraph.contentNotFound'));
        return null;
      }
      const categoryDefinition = getCategoryDefinition(targetCategoryKey);
      if (!categoryDefinition) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('resourceExplorer.error.copyGraph.targetCategoryNotFound'));
        return null;
      }
      const existingNames = new Set(
        project.manifest.graphs
          .filter((entry) => {
            const resolved = resolveGraphLocation(entry.graphId, entry.path, {
              groupNameHint: entry.groupName,
              preferredTopFolder: topFolder,
              fallbackCategoryKey: targetCategoryKey,
            });
            return (
              resolved.location.topFolder === topFolder &&
              resolved.location.categoryKey === targetCategoryKey &&
              resolved.location.groupSlug === targetGroupSlug
            );
          })
          .map((entry) => entry.name),
      );
      const baseName = sourceEntry.name;
      let index = 1;
      let candidate = `${baseName}_${index}`;
      while (existingNames.has(candidate)) {
        index += 1;
        candidate = `${baseName}_${index}`;
      }
      const timestamp = new Date().toISOString();
      const clone = JSON.parse(JSON.stringify(sourceDoc)) as GraphDocument;
      clone.name = candidate;
      clone.createdAt = clone.createdAt ?? timestamp;
      clone.updatedAt = timestamp;
      const newGraphId = createProjectId();
      updateDocument((draft) => {
        draft.graphs[newGraphId] = clone;
        draft.manifest.graphs.push({
          graphId: newGraphId,
          name: candidate,
          path: buildGraphPath(
            {
              topFolder,
              categoryKey: targetCategoryKey,
              categoryDirectory: categoryDefinition.directory,
              groupSlug: targetGroupSlug,
              groupName: targetGroupName,
            },
            newGraphId,
          ),
          groupName: targetGroupName,
          createdAt: clone.createdAt,
          updatedAt: clone.updatedAt,
        });
      });
      markGraphDirty(newGraphId, false);
      return newGraphId;
    },
    [getCategoryDefinition, markGraphDirty, openInfoDialog, topFolder, updateDocument],
  );

  const handleCreateGraph = useCallback(() => {
    if (!currentHistoryEntry) {
      setContextMenu(null);
      return;
    }
    const categoryDefinition = getCategoryDefinition(activeCategoryKey);
    if (!categoryDefinition) {
      openInfoDialog(t('resourceExplorer.error.createGraph.title'), t('common.categoryNotFound'));
      setContextMenu(null);
      return;
    }
    const project = useProjectStore.getState().document;
    if (!project) {
      openInfoDialog(t('resourceExplorer.error.createGraph.title'), t('common.noProjectOpen'));
      setContextMenu(null);
      return;
    }
    const existingNames = new Set(
      project.manifest.graphs
        .filter((entry) => {
          const resolved = resolveGraphLocation(entry.graphId, entry.path, {
            groupNameHint: entry.groupName,
            preferredTopFolder: topFolder,
            fallbackCategoryKey: activeCategoryKey,
          });
          return (
            resolved.location.topFolder === topFolder &&
            resolved.location.categoryKey === activeCategoryKey &&
            resolved.location.groupSlug === currentHistoryEntry
          );
        })
        .map((entry) => entry.name),
    );
    const baseName = t('graph.defaultName');
    let candidate = baseName;
    let index = 1;
    while (existingNames.has(candidate)) {
      candidate = `${baseName}_${index}`;
      index += 1;
    }
    const group = findGroupDescriptor(currentHistoryEntry, activeCategoryKey);
    const groupName = group?.groupName ?? DEFAULT_GROUP_NAME;
    const location = {
      topFolder,
      categoryKey: activeCategoryKey,
      categoryDirectory: categoryDefinition.directory,
      groupSlug: currentHistoryEntry,
      groupName,
    };
    const environment = resolveEnvironmentFromLocation(location);
    const defaultInterval = getDefaultExecutionInterval(environment);
    const graphId = createProjectId();
    const timestamp = new Date().toISOString();
    const newGraph: GraphDocument = {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      name: candidate,
      createdAt: timestamp,
      updatedAt: timestamp,
      nodes: [],
      edges: [],
      comments: [],
      environment,
      executionIntervalSeconds: defaultInterval ?? undefined,
    };
    updateDocument((draft) => {
      draft.graphs[graphId] = newGraph;
      draft.manifest.graphs.push({
        graphId,
        name: candidate,
        path: buildGraphPath(location, graphId),
        groupName,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    markGraphDirty(graphId, false);
    setEditing({ type: 'graph', graphId });
    setEditingValue(candidate);
    setContextMenu(null);
  }, [
    activeCategoryKey,
    currentHistoryEntry,
    findGroupDescriptor,
    getCategoryDefinition,
    markGraphDirty,
    openInfoDialog,
    setContextMenu,
    topFolder,
    updateDocument,
  ]);

  const handleCopyGraph = useCallback(
    (graphId: string) => {
      const project = useProjectStore.getState().document;
      if (!project) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('common.noProjectOpen'));
        return;
      }
      const manifestEntry = project.manifest.graphs.find((entry) => entry.graphId === graphId);
      if (!manifestEntry) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('resourceExplorer.error.copyGraph.entryNotFound'));
        return;
      }
      const resolved = resolveGraphLocation(manifestEntry.graphId, manifestEntry.path, {
        groupNameHint: manifestEntry.groupName,
        preferredTopFolder: topFolder,
      });
      if (resolved.location.topFolder !== topFolder) {
        openInfoDialog(t('resourceExplorer.error.copyGraph.title'), t('resourceExplorer.error.copyGraph.crossType'));
        setContextMenu(null);
        return;
      }
      duplicateGraphInto(
        graphId,
        resolved.location.categoryKey,
        resolved.location.groupSlug,
        resolved.location.groupName,
      );
      setClipboard({
        kind: 'graph',
        topFolder,
        categoryKey: resolved.location.categoryKey,
        groupSlug: resolved.location.groupSlug,
        graphId,
        graphName: manifestEntry.name,
      });
      setContextMenu(null);
    },
    [duplicateGraphInto, openInfoDialog, setContextMenu, topFolder],
  );

  const handlePasteGraph = useCallback(() => {
    if (!clipboard || clipboard.kind !== 'graph') {
      setContextMenu(null);
      return;
    }
    if (clipboard.topFolder !== topFolder) {
      openInfoDialog(
        t('resourceExplorer.error.pasteGraph.title'),
        t('resourceExplorer.error.pasteGraph.crossExplorer'),
      );
      setContextMenu(null);
      return;
    }
    if (!currentHistoryEntry) {
      setContextMenu(null);
      return;
    }
    const group = findGroupDescriptor(currentHistoryEntry, activeCategoryKey);
    const groupName = group?.groupName ?? DEFAULT_GROUP_NAME;
    duplicateGraphInto(clipboard.graphId, activeCategoryKey, currentHistoryEntry, groupName);
    setContextMenu(null);
  }, [
    activeCategoryKey,
    clipboard,
    currentHistoryEntry,
    duplicateGraphInto,
    findGroupDescriptor,
    openInfoDialog,
    setContextMenu,
    topFolder,
  ]);

  const handleDeleteGraph = useCallback(
    (graphId: string, graphName: string) => {
      setContextMenu(null);
      setDialog({
        title: t('resourceExplorer.deleteGraph.title'),
        message: (
          <p>
            {t('resourceExplorer.deleteGraph.message', { name: graphName || graphId })}
          </p>
        ),
        confirmLabel: t('common.delete'),
        confirmVariant: 'danger',
        onConfirm: () => removeManifestEntry(graphId),
        cancelLabel: t('common.cancel'),
      });
    },
    [removeManifestEntry, setContextMenu, t],
  );

  const handleExportGraph = useCallback(
    (graphId: string, graphName: string) => {
      const project = useProjectStore.getState().document;
      if (!project) {
        openInfoDialog(t('resourceExplorer.error.exportGraph.title'), t('common.noProjectOpen'));
        setContextMenu(null);
        return;
      }
      const doc = project.graphs[graphId];
      if (!doc) {
        openInfoDialog(t('resourceExplorer.error.exportGraph.title'), t('resourceExplorer.error.exportGraph.contentNotFound'));
        setContextMenu(null);
        return;
      }
      const serialized = JSON.stringify({ ...doc, schemaVersion: GRAPH_SCHEMA_VERSION }, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const fileName = `${graphName || t('common.graph')}-${graphId}.json`;
      const link = window.document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      setContextMenu(null);
    },
    [openInfoDialog, setContextMenu, t],
  );

  const handleCopyGraphId = useCallback(
    (graphId: string) => {
      setContextMenu(null);
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard
          .writeText(graphId)
          .then(() => {
            openInfoDialog(
              t('resourceExplorer.copyGraphId.successTitle'),
              <p>
                {t('resourceExplorer.copyGraphId.successMessage')}
                <code className="resource-explorer__code">{graphId}</code>
              </p>,
            );
          })
          .catch(() => {
            openInfoDialog(
              t('resourceExplorer.copyGraphId.title'),
              <p>
                {t('resourceExplorer.copyGraphId.autoCopyFailed')}
                <code className="resource-explorer__code">{graphId}</code>
              </p>,
            );
          });
      } else {
        openInfoDialog(
          t('resourceExplorer.copyGraphId.title'),
          <p>
            {t('resourceExplorer.copyGraphId.manualCopy')}
            <code className="resource-explorer__code">{graphId}</code>
          </p>,
        );
      }
    },
    [openInfoDialog, setContextMenu, t],
  );

  const handleToggleCategory = (categoryKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  const handleSelectCategory = (categoryKey: string) => {
    if (categoryKey === activeCategoryKey) {
      if (history[historyIndex] !== null) {
        setHistory([null]);
        setHistoryIndex(0);
        setSearchTerm('');
      }
      return;
    }
    setActiveCategoryKey(categoryKey);
    setHistory([null]);
    setHistoryIndex(0);
    setSearchTerm('');
  };

  const handleOpenFolder = (groupSlug: string) => {
    const truncated = history.slice(0, historyIndex + 1);
    truncated.push(groupSlug);
    setHistory(truncated);
    setHistoryIndex(truncated.length - 1);
    setSearchTerm('');
  };

  const handleGoBack = () => {
    if (historyIndex === 0) return;
    setHistoryIndex((index) => Math.max(0, index - 1));
  };

  const handleGoForward = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((index) => Math.min(history.length - 1, index + 1));
  };

  const handleContextMenuOnEmpty = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const root =
      (event.currentTarget.closest('.resource-explorer') as HTMLElement) ?? event.currentTarget;
    const rootRect = root.getBoundingClientRect();
    if (currentHistoryEntry === null) {
      setContextMenu({
        type: 'empty',
        scope: 'root',
        categoryKey: activeCategoryKey,
        x: event.clientX - rootRect.left,
        y: event.clientY - rootRect.top,
      });
    } else {
      setContextMenu({
        type: 'empty',
        scope: 'folder',
        categoryKey: activeCategoryKey,
        groupSlug: currentHistoryEntry,
        x: event.clientX - rootRect.left,
        y: event.clientY - rootRect.top,
      });
    }
  };

  const handleContextMenuOnFolder = (
    event: React.MouseEvent<HTMLElement>,
    groupSlug: string,
    categoryKey: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const root =
      (event.currentTarget.closest('.resource-explorer') as HTMLElement) ?? event.currentTarget;
    const rootRect = root.getBoundingClientRect();
    setContextMenu({
      type: 'folder',
      groupSlug,
      categoryKey,
      x: event.clientX - rootRect.left,
      y: event.clientY - rootRect.top,
    });
  };

  const handleContextMenuOnGraph = (
    event: React.MouseEvent<HTMLDivElement>,
    graphId: string,
    groupSlug: string,
    categoryKey: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const root =
      (event.currentTarget.closest('.resource-explorer') as HTMLElement) ?? event.currentTarget;
    const rootRect = root.getBoundingClientRect();
    setContextMenu({
      type: 'graph',
      graphId,
      groupSlug,
      categoryKey,
      x: event.clientX - rootRect.left,
      y: event.clientY - rootRect.top,
    });
  };

  const handleExportFolder = useCallback(
    (groupSlug: string, categoryKey: string) => {
      void exportGroup(topFolder, categoryKey, groupSlug);
      setContextMenu(null);
    },
    [exportGroup, topFolder],
  );

  const handleRequestImportGraphs = useCallback(
    (groupSlug: string, categoryKey: string) => {
      if (!document) {
        openInfoDialog(t('resourceExplorer.error.import.title'), t('common.noProjectOpen'));
        return;
      }
      setPendingImportTarget({ groupSlug, categoryKey });
      setContextMenu(null);
      importInputRef.current?.click();
    },
    [document, openInfoDialog, t],
  );

  const importGraphsTo = useCallback(
    async (
      files: FileList | File[],
      target: { groupSlug: string; categoryKey: string },
    ) => {
      const selectedFiles = Array.from(files ?? []);
      if (!selectedFiles.length) return;
      if (!document) {
        openInfoDialog(t('resourceExplorer.error.import.title'), t('common.noProjectOpen'));
        return;
      }
      const category = categories.find((item) => item.key === target.categoryKey);
      if (!category) {
        openInfoDialog(t('resourceExplorer.error.import.title'), t('common.categoryNotFound'));
        return;
      }
      const group = groupMap.get(target.groupSlug);
      const groupName =
        group?.groupName ??
        (target.groupSlug === DEFAULT_GROUP_SLUG ? DEFAULT_GROUP_NAME : target.groupSlug);
      const failures: string[] = [];
      for (const file of selectedFiles) {
        try {
          const raw = await file.text();
          const parsedResult = graphDocumentSchema.safeParse(JSON.parse(raw));
          if (!parsedResult.success) {
            console.error(parsedResult.error);
            failures.push(file.name);
            continue;
          }
          const parsed = parsedResult.data;
          const graphId = createProjectId();
          const location = {
            topFolder,
            categoryKey: category.key,
            categoryDirectory: category.directory,
            groupSlug: target.groupSlug,
            groupName,
          };
          const fallbackName = file.name.replace(/\.json$/i, '') || t('graph.defaultName');
          const trimmedName = parsed.name?.trim();
          const graphName = trimmedName && trimmedName.length > 0 ? trimmedName : fallbackName;
          const timestamp = new Date().toISOString();
          const normalizedComments: GraphComment[] = [];
          if (Array.isArray(parsed.comments)) {
            for (const comment of parsed.comments) {
              const nodeId = (comment.nodeId ?? '').trim();
              const position = comment.position
                ? { x: Number(comment.position.x) || 0, y: Number(comment.position.y) || 0 }
                : undefined;
              if (!nodeId && !position) continue;
              const commentId =
                comment.id && comment.id.trim().length > 0 ? comment.id : nanoid();
              normalizedComments.push({
                id: commentId,
                nodeId: nodeId || undefined,
                position,
                text: comment.text ?? '',
                pinned: Boolean(comment.pinned),
                collapsed: Boolean(comment.collapsed),
              });
            }
          }
          const environmentFromLocation = resolveEnvironmentFromLocation(location);
          const declaredEnvironment = isGraphEnvironmentValue(parsed.environment)
            ? normalizeGraphEnvironment(parsed.environment)
            : undefined;
          const fallbackKind = clientKindFromEnvironment(environmentFromLocation) ?? undefined;
          const normalizedDeclared =
            declaredEnvironment && getEnvironmentTopFolder(declaredEnvironment) === location.topFolder
              ? normalizeGraphEnvironment(declaredEnvironment, { fallbackClientKind: fallbackKind })
              : null;
          const environment: GraphEnvironment = normalizedDeclared ?? environmentFromLocation;
          const defaultInterval = getDefaultExecutionInterval(environment);
          const executionIntervalSeconds =
            defaultInterval !== undefined
              ? sanitizeExecutionInterval(
                  parsed.executionIntervalSeconds ?? defaultInterval,
                  defaultInterval,
                )
              : parsed.executionIntervalSeconds;
          const normalizedDocument: GraphDocument = {
            ...parsed,
            environment,
            schemaVersion: GRAPH_SCHEMA_VERSION,
            name: graphName,
            createdAt: parsed.createdAt ?? timestamp,
            updatedAt: parsed.updatedAt ?? timestamp,
            comments: normalizedComments,
            executionIntervalSeconds,
          };
          const entry = {
            graphId,
            name: graphName,
            path: buildGraphPath(location, graphId),
            groupName: location.groupName,
            createdAt: normalizedDocument.createdAt,
            updatedAt: normalizedDocument.updatedAt,
          };
          setGraphDocument(graphId, normalizedDocument);
          setManifestEntry(entry);
          markGraphDirty(graphId, false);
        } catch (error) {
          console.error('Failed to import graph', error);
          failures.push(file.name);
        }
      }
      if (failures.length) {
        openInfoDialog(
          t('resourceExplorer.import.partialFailure.title'),
          <div className="resource-explorer__dialog-message">
            <p>{t('resourceExplorer.import.partialFailure.hint')}</p>
            <ul>
              {failures.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>,
        );
      }
    },
    [
      categories,
      document,
      groupMap,
      markGraphDirty,
      openInfoDialog,
      setGraphDocument,
      setManifestEntry,
      t,
      topFolder,
    ],
  );

  const handleImportGraphs = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) {
        setPendingImportTarget(null);
        return;
      }
      if (!pendingImportTarget) {
        setPendingImportTarget(null);
        return;
      }
      await importGraphsTo(files, pendingImportTarget);
      setPendingImportTarget(null);
    },
    [importGraphsTo, pendingImportTarget],
  );

  const handleImportInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      void handleImportGraphs(files);
      event.target.value = '';
    },
    [handleImportGraphs],
  );

  const handleDeleteFolder = useCallback(
    (groupSlug: string, categoryKey: string) => {
      const targetGroup = groupMap.get(groupSlug);
      if (!targetGroup) {
        setContextMenu(null);
        return;
      }
      setContextMenu(null);
      setDialog({
        title: t('resourceExplorer.deleteFolder.title'),
        message: (
          <p>
            {t('resourceExplorer.deleteFolder.message', { name: targetGroup.groupName })}
          </p>
        ),
        confirmLabel: t('common.delete'),
        confirmVariant: 'danger',
        onConfirm: () => {
          deleteGroup(topFolder, categoryKey, groupSlug);
          if (groupSlug === currentHistoryEntry) {
            setHistory([null]);
            setHistoryIndex(0);
          }
        },
        cancelLabel: t('common.cancel'),
      });
    },
    [currentHistoryEntry, deleteGroup, groupMap, setHistory, setHistoryIndex, t, topFolder],
  );

  const handleNavigateToRoot = useCallback(() => {
    if (currentHistoryEntry === null) return;
    const truncated = history.slice(0, historyIndex + 1);
    truncated.push(null);
    setHistory(truncated);
    setHistoryIndex(truncated.length - 1);
    setSearchTerm('');
  }, [currentHistoryEntry, history, historyIndex, setHistory, setHistoryIndex, setSearchTerm]);

  const pathSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; onClick?: () => void; disabled?: boolean }> = [];
    const category = categories.find((item) => item.key === activeCategoryKey);
    if (category) {
      const isRoot = currentHistoryEntry === null;
      segments.push({
        key: `category:${category.key}`,
        label: t(category.labelKey),
        onClick: isRoot ? undefined : handleNavigateToRoot,
        disabled: isRoot,
      });
    }
    if (currentHistoryEntry) {
      const group = groupMap.get(currentHistoryEntry);
      const groupLabel = group
        ? group.groupSlug === DEFAULT_GROUP_SLUG && group.groupName === DEFAULT_GROUP_NAME
          ? defaultGroupNameLabel
          : group.groupName
        : currentHistoryEntry;
      segments.push({
        key: `group:${currentHistoryEntry}`,
        label: groupLabel,
        disabled: true,
      });
    }
    return segments;
  }, [activeCategoryKey, categories, currentHistoryEntry, defaultGroupNameLabel, groupMap, handleNavigateToRoot, t]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const resetDropState = useCallback(() => {
    dragCounterRef.current = 0;
    setDropActive(false);
  }, []);

  const isFileDragEvent = (event: DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isRootView || !isFileDragEvent(event)) return;
      event.preventDefault();
      dragCounterRef.current += 1;
      setDropActive(true);
    },
    [isRootView],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isRootView || !isFileDragEvent(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [isRootView],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isRootView || !isFileDragEvent(event)) return;
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setDropActive(false);
      }
    },
    [isRootView],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isRootView || !isFileDragEvent(event)) return;
      event.preventDefault();
      const targetSlug = currentHistoryEntry;
      resetDropState();
      if (!targetSlug) return;
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      void importGraphsTo(files, { groupSlug: targetSlug, categoryKey: activeCategoryKey });
    },
    [activeCategoryKey, currentHistoryEntry, importGraphsTo, isRootView, resetDropState],
  );

  useEffect(() => {
    if (isRootView) {
      resetDropState();
    }
  }, [isRootView, resetDropState]);

  useEffect(() => {
    resetDropState();
  }, [currentHistoryEntry, resetDropState]);

  const folderRows = (
    <div
      className="resource-explorer__tbody"
      onContextMenu={handleContextMenuOnEmpty}
    >
      {visibleFolders.length === 0 ? (
        <div className="resource-explorer__empty">{t('resourceExplorer.folders.empty')}</div>
      ) : (
        visibleFolders.map((group, index) => {
          const stripeClass = `resource-explorer__row--${index % 2 === 0 ? 'even' : 'odd'}`;
          const isRenaming =
            editing?.type === 'folder' &&
            editing.groupSlug === group.groupSlug &&
            editing.categoryKey === group.categoryKey;
          return (
            <div
              key={group.groupSlug}
              className={classNames('resource-explorer__row', stripeClass, {
                'is-editing': isRenaming,
              })}
              role="button"
              tabIndex={0}
              onDoubleClick={() => handleOpenFolder(group.groupSlug)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleOpenFolder(group.groupSlug);
                }
              }}
              onContextMenu={(event) =>
                handleContextMenuOnFolder(event, group.groupSlug, group.categoryKey)
              }
            >
              <div className="resource-explorer__cell resource-explorer__cell--name">
                <img src={ICON_FOLDER} alt="" aria-hidden="true" />
                {isRenaming ? (
                  <input
                    ref={editingInputRef}
                    className="resource-explorer__rename-input"
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => commitEditing(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitEditing(true);
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        commitEditing(false);
                      }
                    }}
                    placeholder={t('resourceExplorer.defaultFolderName')}
                  />
                ) : (
                  <span>
                    {group.groupSlug === DEFAULT_GROUP_SLUG && group.groupName === DEFAULT_GROUP_NAME
                      ? defaultGroupNameLabel
                      : group.groupName}
                  </span>
                )}
              </div>
              <div className="resource-explorer__cell resource-explorer__cell--type">{t('resourceExplorer.itemType.folder')}</div>
              <div className="resource-explorer__cell resource-explorer__cell--meta">
                {group.graphCount > 0
                  ? t('resourceExplorer.folder.count', { count: group.graphCount })
                  : t('common.empty')}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const graphRows = (
    <div
      className={classNames('resource-explorer__tbody', { 'is-drop-target': dropActive })}
      onContextMenu={handleContextMenuOnEmpty}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropActive && (
        <div className="resource-explorer__drop-overlay">
          <span>{t('resourceExplorer.import.dropOverlay')}</span>
        </div>
      )}
      {visibleGraphs.length === 0 ? (
        <div className="resource-explorer__empty">{t('resourceExplorer.graphs.empty')}</div>
      ) : (
        visibleGraphs.map((descriptor, index) => {
          const validation = graphValidation.get(descriptor.graphId);
          const hasError = Boolean(validation && validation.errors.length);
          const isDirty = Boolean(dirtyGraphIds[descriptor.graphId]);
          const stripeClass = `resource-explorer__row--${index % 2 === 0 ? 'even' : 'odd'}`;
          const isRenaming =
            editing?.type === 'graph' && editing.graphId === descriptor.graphId;
          return (
            <div
              key={descriptor.graphId}
              className={classNames('resource-explorer__row', stripeClass, {
                'is-dirty': isDirty,
                'is-editing': isRenaming,
                'is-error': hasError,
              })}
              role="button"
              tabIndex={0}
              onDoubleClick={() => attemptOpenGraph(descriptor.graphId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  attemptOpenGraph(descriptor.graphId);
                }
              }}
              onContextMenu={(event) =>
                handleContextMenuOnGraph(
                  event,
                  descriptor.graphId,
                  descriptor.location.groupSlug,
                  descriptor.location.categoryKey,
                )
              }
            >
              <div className="resource-explorer__cell resource-explorer__cell--name">
                <img src={ICON_GRAPH} alt="" aria-hidden="true" />
                {isRenaming ? (
                  <input
                    ref={editingInputRef}
                    className="resource-explorer__rename-input"
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => commitEditing(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitEditing(true);
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        commitEditing(false);
                      }
                    }}
                    placeholder={t('resourceExplorer.graph.rename.placeholder')}
                  />
                ) : (
                  <span>{descriptor.name}</span>
                )}
                {isDirty && <span className="resource-explorer__dirty-indicator">*</span>}
              </div>
              <div className="resource-explorer__cell resource-explorer__cell--type">{t('common.graph')}</div>
              <div
                className={classNames(
                  'resource-explorer__cell',
                  'resource-explorer__cell--meta',
                  { 'is-error': hasError },
                )}
              >
                {hasError ? (
                  <span title={validation?.errors.join('\n') ?? ''}>
                    {validation?.errors[0] ?? t('resourceExplorer.graph.error')}
                  </span>
                ) : (
                  descriptor.graphId
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const canPasteFolder =
    clipboard?.kind === 'folder' && clipboard.topFolder === topFolder;

  const canPasteGraph =
    clipboard?.kind === 'graph' &&
    clipboard.topFolder === topFolder &&
    currentHistoryEntry !== null;

  return (
    <div className="resource-explorer">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={handleImportInputChange}
      />
      <aside className="resource-explorer__sidebar">
        <h2 className="resource-explorer__sidebar-title">
          <img
            src={topFolder === 'server' ? ICON_TAB_SERVER : ICON_TAB_CLIENT}
            alt=""
            aria-hidden="true"
          />
          {topFolder === 'server'
            ? t('resourceExplorer.sidebar.serverGraphs')
            : t('resourceExplorer.sidebar.clientGraphs')}
        </h2>
        <nav className="resource-explorer__sidebar-groups">
          {categories.map((category) => {
            const isExpanded = expandedCategories[category.key];
            const groups = groupsByCategory.get(category.key) ?? [];
            const isActiveCategory = category.key === activeCategoryKey;
            return (
              <div key={category.key} className="resource-explorer__sidebar-section">
                <button
                  type="button"
                  className={classNames('resource-explorer__sidebar-group', {
                    'is-active': isActiveCategory,
                  })}
                  onClick={() => handleSelectCategory(category.key)}
                >
                  <span
                    className={classNames('resource-explorer__sidebar-toggle', {
                      'is-expanded': isExpanded,
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleCategory(category.key);
                    }}
                    aria-hidden="true"
                  >
                    <img
                      src={ICON_TOGGLE}
                      alt=""
                      aria-hidden="true"
                      className="resource-explorer__sidebar-toggle-icon"
                    />
                  </span>
                  <img src={ICON_FOLDER} alt="" aria-hidden="true" />
                  <span className="resource-explorer__sidebar-group-label">{t(category.labelKey)}</span>
                </button>
                {isExpanded && (
                  <div className="resource-explorer__sidebar-subgroups">
                    {groups.map((group) => {
                      const isActiveFolder =
                        isActiveCategory && currentHistoryEntry === group.groupSlug;
                      return (
                        <button
                          type="button"
                          key={group.groupSlug}
                          className={classNames('resource-explorer__sidebar-subgroup', {
                            'is-active': isActiveFolder,
                          })}
                          onClick={() => {
                            if (activeCategoryKey !== group.categoryKey) {
                              setActiveCategoryKey(group.categoryKey);
                            }
                            handleOpenFolder(group.groupSlug);
                          }}
                        >
                          <span className="resource-explorer__sidebar-subgroup-icon" aria-hidden="true" />
                          <span>
                            {group.groupSlug === DEFAULT_GROUP_SLUG &&
                            group.groupName === DEFAULT_GROUP_NAME
                              ? defaultGroupNameLabel
                              : group.groupName}
                          </span>
                        </button>
                      );
                    })}
                    {groups.length === 0 && (
                      <div className="resource-explorer__sidebar-subgroup resource-explorer__sidebar-subgroup--empty">
                        {t('resourceExplorer.folders.empty')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="resource-explorer__content">
        <div className="resource-explorer__toolbar">
          <div className="resource-explorer__nav">
            <button
              type="button"
              className="resource-explorer__icon-button"
              onClick={handleGoBack}
              disabled={!canGoBack}
            >
              <img src={ICON_BACK} alt={t('common.back')} />
            </button>
            <button
              type="button"
              className="resource-explorer__icon-button"
              onClick={handleGoForward}
              disabled={!canGoForward}
            >
              <img src={ICON_FORWARD} alt={t('common.forward')} />
            </button>
            <div className="resource-explorer__path">
              {pathSegments.length === 0 ? (
                <span className="resource-explorer__path-empty">—</span>
              ) : (
                pathSegments.map((segment, index) => (
                  <span className="resource-explorer__path-entry" key={segment.key}>
                    <button
                      type="button"
                      className={classNames('resource-explorer__path-segment', {
                        'is-disabled': segment.disabled || !segment.onClick,
                      })}
                      onClick={segment.onClick}
                      disabled={segment.disabled || !segment.onClick}
                    >
                      {segment.label}
                    </button>
                    {index < pathSegments.length - 1 && (
                      <span className="resource-explorer__path-separator">/</span>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="resource-explorer__actions">
            <button type="button" className="resource-explorer__icon-button" disabled>
              <img src={ICON_FILTER} alt={t('common.filter')} />
            </button>
            <div className="resource-explorer__search">
              <img src={ICON_SEARCH} alt="" aria-hidden="true" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('resourceExplorer.search.placeholder')}
              />
            </div>
          </div>
        </div>

        <div className="resource-explorer__table">
          <div className="resource-explorer__thead">
            <button
              type="button"
              className="resource-explorer__thead-cell resource-explorer__thead-cell--sortable"
              onClick={() => setSortAscending((prev) => !prev)}
            >
              {t('common.name')}
              <span className="resource-explorer__sort-indicator" aria-hidden="true">
                <img src={sortAscending ? ICON_SORT_ASC : ICON_SORT_DESC} alt="" />
              </span>
            </button>
            <div className="resource-explorer__thead-cell">{t('common.type')}</div>
            <div className="resource-explorer__thead-cell resource-explorer__thead-cell--meta">
              {t('common.info')}
            </div>
          </div>
          {isRootView ? folderRows : graphRows}
        </div>

        {contextMenu && (
          <div
            className="resource-explorer__context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'empty' ? (
              contextMenu.scope === 'root' ? (
                <>
                  <button type="button" onClick={handleCreateFolder}>
                    {t('resourceExplorer.context.newFolder')}
                  </button>
                  <button
                    type="button"
                    onClick={canPasteFolder ? handlePasteFolder : undefined}
                    className={classNames({ 'is-disabled': !canPasteFolder })}
                    disabled={!canPasteFolder}
                  >
                    {t('resourceExplorer.context.pasteFolder')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleCreateGraph}>
                    {t('resourceExplorer.context.newGraph')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (contextMenu.groupSlug) {
                        handleRequestImportGraphs(contextMenu.groupSlug, contextMenu.categoryKey);
                      }
                    }}
                  >
                    {t('resourceExplorer.context.importJson')}
                  </button>
                  <button
                    type="button"
                    onClick={canPasteGraph ? handlePasteGraph : undefined}
                    className={classNames({ 'is-disabled': !canPasteGraph })}
                    disabled={!canPasteGraph}
                  >
                    {t('resourceExplorer.context.pasteGraph')}
                  </button>
                </>
              )
            ) : contextMenu.type === 'folder' ? (
              (() => {
                const descriptor = findGroupDescriptor(
                  contextMenu.groupSlug,
                  contextMenu.categoryKey,
                );
                const folderName = descriptor?.groupName ?? contextMenu.groupSlug;
                const isDefaultFolder = descriptor?.isDefault ?? false;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setContextMenu(null);
                        handleOpenFolder(contextMenu.groupSlug);
                      }}
                    >
                      {t('common.open')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleStartFolderRename(
                          contextMenu.groupSlug,
                          contextMenu.categoryKey,
                          folderName,
                        )
                      }
                      className={classNames({ 'is-disabled': isDefaultFolder })}
                      disabled={isDefaultFolder}
                    >
                      {t('common.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyFolder(contextMenu.groupSlug, contextMenu.categoryKey, folderName)
                      }
                    >
                      {t('common.copy')}
                    </button>
                    <button
                      type="button"
                      className={classNames('is-danger', { 'is-disabled': isDefaultFolder })}
                      onClick={() =>
                        handleCutFolder(contextMenu.groupSlug, contextMenu.categoryKey, folderName)
                      }
                      disabled={isDefaultFolder}
                    >
                      {t('common.cut')}
                    </button>
                    {!isDefaultFolder && (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() =>
                          handleDeleteFolder(contextMenu.groupSlug, contextMenu.categoryKey)
                        }
                      >
                        {t('common.delete')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleExportFolder(contextMenu.groupSlug, contextMenu.categoryKey)
                      }
                    >
                      {t('common.export')}
                    </button>
                  </>
                );
              })()
            ) : (
              (() => {
                const graphDescriptor = allGraphs.find(
                  (item) => item.graphId === contextMenu.graphId,
                );
                const graphName = graphDescriptor?.name ?? contextMenu.graphId;
                const validation = graphValidation.get(contextMenu.graphId);
                const hasError = Boolean(validation && validation.errors.length);
                const errorTooltip = validation?.errors.join('; ');
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setContextMenu(null);
                        attemptOpenGraph(contextMenu.graphId);
                      }}
                      className={classNames({ 'is-disabled': hasError })}
                      disabled={hasError}
                      title={hasError ? errorTooltip : undefined}
                    >
                      {t('common.open')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartGraphRename(contextMenu.graphId, graphName)}
                    >
                      {t('common.rename')}
                    </button>
                    <button type="button" onClick={() => handleCopyGraph(contextMenu.graphId)}>
                      {t('common.copy')}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => handleDeleteGraph(contextMenu.graphId, graphName)}
                    >
                      {t('common.delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportGraph(contextMenu.graphId, graphName)}
                    >
                      {t('common.export')}
                    </button>
                    <button type="button" onClick={() => handleCopyGraphId(contextMenu.graphId)}>
                      {t('resourceExplorer.context.copyGraphId')}
                    </button>
                  </>
                );
              })()
            )}
          </div>
        )}
        {dialog && (
          <div
            className="home__confirm-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              dialog.onCancel?.();
              setDialog(null);
            }}
          >
            <div
              className="home__confirm"
              role="document"
              onClick={(event) => event.stopPropagation()}
            >
              <h3>{dialog.title}</h3>
              <div className="resource-explorer__dialog-message">{dialog.message}</div>
              <div className="home__confirm-actions">
                {dialog.cancelLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      dialog.onCancel?.();
                      setDialog(null);
                    }}
                  >
                    {dialog.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  className={classNames({ 'is-danger': dialog.confirmVariant === 'danger' })}
                  onClick={() => {
                    dialog.onConfirm?.();
                    setDialog(null);
                  }}
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceExplorer;
