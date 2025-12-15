import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, MouseEvent, ReactNode } from "react";
import JSZip from "jszip";

import GraphCanvas from "./components/GraphCanvas";
import HomePage from "./components/HomePage";
import ResourceExplorer from "./components/ResourceExplorer";
import StructureManager from "./components/StructureManager";
import TutorialPage, { type TutorialRoute } from "./components/TutorialPage";
import EffectsPage from "./components/EffectsPage";
import NodeInspector from "./components/NodeInspector";
import NodePalette from "./components/NodePalette";
import SettingsPage from "./components/SettingsPage";
import { useGraphStore } from "./state/graphStore";
import { useProjectStore, type ProjectTab, type TabId } from "./state/projectStore";
import type { GraphDocument, GraphEnvironment } from "./types/node";
import { GRAPH_SCHEMA_VERSION } from "./types/node";
import type { StructDocument } from "./types/struct";
import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_SLUG, PROJECT_CATEGORIES_BY_TOP, type ProjectDocument, type ProjectTopFolder } from "./types/project";
import {
  buildGraphPath,
  createEmptyProjectDocument,
  createProjectId,
  resolveGraphLocation,
  sanitizeName,
} from "./utils/project";
import {
  clientKindFromEnvironment,
  getEnvironmentTopFolder,
  getDefaultExecutionInterval,
  normalizeGraphEnvironment,
  resolveEnvironmentFromLocation,
} from "./utils/graphEnvironment";
import {
  loadProjectFromZip,
  normalizeProjectDocument,
  saveProjectToZip,
} from "./utils/projectIO";
import { exportGraphsToGil } from "./lib/gil/export";
import { exportGiaDocument } from "./lib/gia/exporter";
import { decodeGiaBinary } from "./lib/gia/decoder";
import VERSION_INFO from "./config/version";
import type { AutoSaveEntry, EditorSettings, LayoutState, StoredProject } from "./utils/storage";
import {
  AUTOSAVE_LIMIT,
  clearAutoSavesForProject,
  loadAutoSaveMap,
  loadLayoutState,
  loadProjects,
  loadSessionState,
  loadEditorSettings,
  persistAutoSaveEntry,
  persistLayoutState,
  persistEditorSettings,
  replaceAutoSavesForProject,
  removeProjectRecord,
  updateSessionState,
  upsertProjectRecord,
} from "./utils/storage";
import { I18nProvider } from "./utils/i18nContext";
import { t as translateText } from "./utils/i18n";
import { isLocalizedError } from "./utils/localizedText";
import "./App.css";

const AUTO_SAVE_INTERVAL = 30_000;
const AUTO_SAVE_RECOVERY_THRESHOLD = 30_000;
const GITHUB_URL = "https://github.com/Columbina-Dev/WebMiliastraNodesEditor";
const APP_BASE_PATH = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const TUTORIAL_BASE_PATH = "/ys/ugc/tutorial";

const ICON_BACK = new URL("./assets/icons/back.png", import.meta.url).href;
const ICON_SAVE = new URL("./assets/icons/save.png", import.meta.url).href;
const ICON_SAVEAS = new URL("./assets/icons/save-as.png", import.meta.url).href;
const ICON_EXPORT = new URL("./assets/icons/export.png", import.meta.url).href;
const ICON_UNDO = new URL("./assets/icons/undo.png", import.meta.url).href;
const ICON_REDO = new URL("./assets/icons/redo.png", import.meta.url).href;
const ICON_TUTORIAL = new URL("./assets/icons/tutorial.png", import.meta.url).href;
const ICON_EFFECTS = new URL("./assets/icons/effects.svg", import.meta.url).href;
const ICON_PROJECT = new URL("./assets/icons/file.png", import.meta.url).href;
const ICON_SETTING = new URL("./assets/icons/setting.png", import.meta.url).href;
const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150];
const ICON_TAB_SERVER = new URL("./assets/icons/tab-server.svg", import.meta.url).href;
const ICON_TAB_CLIENT = new URL("./assets/icons/tab-client.svg", import.meta.url).href;
const ICON_TAB_GRAPH = new URL("./assets/icons/tab-graph.png", import.meta.url).href;
const ICON_STRUCT = new URL("./assets/icons/struct.png", import.meta.url).href;
const ICON_APP_LOGO = new URL("./assets/icons/test.ico", import.meta.url).href;
const ICON_DOCK_EXPAND = new URL("./assets/icons/dock-expand.svg", import.meta.url).href;
const ICON_DOCK_COLLAPSE = new URL("./assets/icons/dock-collapse.svg", import.meta.url).href;
const ICON_DOCK_COMMENT = new URL("./assets/icons/dock-comment.png", import.meta.url).href;
const ICON_INTERVAL = new URL("./assets/icons/interval.svg", import.meta.url).href;

const INVALID_FILENAME_CHARS = new Set(["\\", "/", ":", "*", "?", "\"", "<", ">", "|"]);

type LightweightDialog = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};
type DialogRequest = Omit<LightweightDialog, 'onConfirm' | 'onCancel'>;

const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const safe = Array.from(trimmed)
    .map((char) => (INVALID_FILENAME_CHARS.has(char) ? "_" : char))
    .join("");
  return safe.length ? safe : "project";
};

const formatExecutionInterval = (value: number) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = Number(value.toFixed(3));
  return rounded.toString();
};

const tokenizeVersion = (value?: string): number[] => {
  if (!value) {
    return [];
  }
  const sanitized = value.trim();
  if (!sanitized) {
    return [];
  }
  const cleaned = sanitized.replace(/^v/i, '');
  const segments = cleaned.split('.');
  const tokens: number[] = [];
  for (const segment of segments) {
    if (!segment) {
      tokens.push(0);
      continue;
    }
    if (/^\d+$/.test(segment)) {
      tokens.push(Number(segment));
      continue;
    }
    const match = /^([A-Za-z]+)(\d+)?$/.exec(segment);
    if (match) {
      const letterCode = 10000 + match[1].toUpperCase().charCodeAt(0);
      tokens.push(letterCode);
      if (match[2]) {
        tokens.push(Number(match[2]));
      }
      continue;
    }
    tokens.push(0);
  }
  return tokens;
};

const compareAppVersions = (incoming?: string, current?: string): number => {
  const incomingTokens = tokenizeVersion(incoming);
  const currentTokens = tokenizeVersion(current);
  const length = Math.max(incomingTokens.length, currentTokens.length);
  for (let i = 0; i < length; i++) {
    const a = incomingTokens[i] ?? 0;
    const b = currentTokens[i] ?? 0;
    if (a === b) {
      continue;
    }
    return a > b ? 1 : -1;
  }
  return 0;
};

const highlightJsonText = (jsonText: string) => {
  const escaped = jsonText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'number';
      if (match.startsWith('"')) {
        cls = match.endsWith(':') ? 'key' : 'string';
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (match === 'null') {
        cls = 'null';
      }
      return `<span class="json-token json-token--${cls}">${match}</span>`;
    },
  );
};

type GiaModalState = {
  fileName: string;
  jsonText: string;
  highlightedJson: string;
};

const ensureLeadingSlash = (path: string) => (path.startsWith("/") ? path : "/" + path);

const buildAppPath = (path: string) => {
  const relative = ensureLeadingSlash(path);
  if (!APP_BASE_PATH || APP_BASE_PATH === "/") {
    return relative;
  }
  return APP_BASE_PATH + (relative === "/" ? "" : relative);
};

const stripAppBase = (pathname: string) => {
  const normalized = pathname || "/";
  if (!APP_BASE_PATH || APP_BASE_PATH === "/") {
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
  if (normalized.startsWith(APP_BASE_PATH)) {
    const rest = normalized.slice(APP_BASE_PATH.length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const isTutorialPath = (path: string) =>
  path === TUTORIAL_BASE_PATH ||
  path.startsWith(`${TUTORIAL_BASE_PATH}/`) ||
  path.startsWith(`${TUTORIAL_BASE_PATH}//`);

const isEffectsPath = (path: string) =>
  path === "/effects" || path.startsWith("/effects/");

const isSettingsPath = (path: string) => path === "/settings";

const buildTutorialPath = (path: string) => {
  const trimmed = path.replace(/^\/+/, "");
  if (!trimmed) {
    return TUTORIAL_BASE_PATH;
  }
  return `${TUTORIAL_BASE_PATH}/${trimmed}`.replace(/\/{2,}/g, "/");
};

const parseTutorialRouteFromPath = (pathname: string): TutorialRoute => {
  if (!isTutorialPath(pathname)) {
    return { kind: "landing" };
  }
  const rest = pathname.slice(TUTORIAL_BASE_PATH.length);
  const segments = rest.split("/").filter((segment) => segment.length > 0);
  if (!segments.length) {
    return { kind: "landing" };
  }
  const first = segments[0];
  let kind: "knowledge" | "course" = "knowledge";
  let remaining = segments;
  if (first === "knowledge" || first === "course") {
    kind = first;
    remaining = segments.slice(1);
  } else {
    kind = "knowledge";
  }
  let entryId: string | null = null;
  if (remaining[0] === "detail") {
    entryId = remaining[1] ?? null;
  } else if (remaining[0]) {
    entryId = remaining[0];
  }
  return { kind, entryId };
};

type ViewMode = "home" | "editor" | "tutorial" | "effects" | "settings" | "notFound";

const resolveViewFromPath = (relativePath: string) => {
  const normalized = relativePath.replace(/\/+$/, "") || "/";
  if (normalized === "/") {
    return { view: "home" } as const;
  }
  if (isSettingsPath(normalized)) {
    return { view: "settings" } as const;
  }
  if (isEffectsPath(normalized)) {
    return { view: "effects" } as const;
  }
  if (isTutorialPath(normalized)) {
    return { view: "tutorial", tutorialRoute: parseTutorialRouteFromPath(normalized) } as const;
  }
  return { view: "notFound", path: normalized } as const;
};

const fingerprintGraphDocument = (doc: GraphDocument) =>
  JSON.stringify({
    schemaVersion: doc.schemaVersion,
    name: doc.name,
    nodes: doc.nodes,
    edges: doc.edges,
    comments: doc.comments ?? [],
    environment: doc.environment ?? null,
    executionIntervalSeconds:
      typeof doc.executionIntervalSeconds === 'number' ? doc.executionIntervalSeconds : null,
  });

const fingerprintStructDocument = (doc: StructDocument) => JSON.stringify(doc);

const fingerprintProjectDocument = (document: ProjectDocument) => {
  const manifestFingerprint = JSON.stringify(document.manifest);
  const graphFingerprints = Object.entries(document.graphs)
    .map(([graphId, graphDoc]) => [graphId, fingerprintGraphDocument(graphDoc)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const structFingerprints = Object.entries(document.structs ?? {})
    .map(([structId, structDoc]) => [structId, fingerprintStructDocument(structDoc as StructDocument)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({ manifest: manifestFingerprint, graphs: graphFingerprints, structs: structFingerprints });
};

const resolveGraphEnvironment = (
  graphId: string,
  graph: GraphDocument,
  manifest: ProjectDocument['manifest'],
): GraphEnvironment => {
  const entry = manifest.graphs.find((item) => item.graphId === graphId);
  if (entry) {
    const resolved = resolveGraphLocation(graphId, entry.path, {
      groupNameHint: entry.groupName,
    });
    return resolveEnvironmentFromLocation(resolved.location);
  }
  if (graph.environment) {
    return normalizeGraphEnvironment(graph.environment);
  }
  return 'server';
};

const withGraphEnvironment = (
  graphId: string,
  graph: GraphDocument,
  manifest: ProjectDocument['manifest'],
): GraphDocument => {
  const environment = resolveGraphEnvironment(graphId, graph, manifest);
  return graph.environment === environment ? graph : { ...graph, environment };
};

const normalizeGraphDocuments = (document: ProjectDocument): ProjectDocument => {
  let changed = false;
  const nextGraphs: ProjectDocument['graphs'] = {};
  Object.entries(document.graphs).forEach(([graphId, graphDoc]) => {
    const normalized = withGraphEnvironment(graphId, graphDoc, document.manifest);
    nextGraphs[graphId] = normalized;
    if (normalized !== graphDoc) {
      changed = true;
    }
  });
  return changed ? { ...document, graphs: nextGraphs } : document;
};

const detectMobileMode = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const coarsePointer =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const smallViewport = window.innerWidth <= 900 || window.innerHeight <= 700;
  return (isMobileUA && touchPoints > 0) || coarsePointer || (touchPoints > 1 && smallViewport);
};

const GIA_UID_DIGITS = "0123456789";
const generateGiaUidValue = (length = 9) => {
  const safeLength = Math.max(1, length);
  let result = "";
  for (let i = 0; i < safeLength; i++) {
    const index = Math.floor(Math.random() * GIA_UID_DIGITS.length);
    result += GIA_UID_DIGITS[index];
  }
  return result;
};

const App = () => {
  const projectDocument = useProjectStore((state) => state.document);
  const projectId = useProjectStore((state) => state.projectId);
  const projectName = useProjectStore((state) => state.projectName);
  const openTabs = useProjectStore((state) => state.openTabs);
  const activeTabId = useProjectStore((state) => state.activeTabId);
  const activeGraphId = useProjectStore((state) => state.activeGraphId);
  const dirtyGraphIds = useProjectStore((state) => state.dirtyGraphIds);
  const dirtyStructIds = useProjectStore((state) => state.dirtyStructIds);

  const setDocument = useProjectStore((state) => state.setDocument);
  const updateDocument = useProjectStore((state) => state.updateDocument);
  const openExplorer = useProjectStore((state) => state.openExplorer);
  const openStructManager = useProjectStore((state) => state.openStructManager);
  const openGraphTab = useProjectStore((state) => state.openGraphTab);
  const closeTab = useProjectStore((state) => state.closeTab);
  const activateTab = useProjectStore((state) => state.activateTab);
  const resetProjectStore = useProjectStore((state) => state.reset);
  const setGraphDocument = useProjectStore((state) => state.setGraphDocument);
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const setManifestEntry = useProjectStore((state) => state.setManifestEntry);
  const markGraphDirty = useProjectStore((state) => state.markGraphDirty);
  const createGroup = useProjectStore((state) => state.createGroup);

  const graphName = useGraphStore((state) => state.name);
  const setGraphName = useGraphStore((state) => state.setName);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const canUndo = useGraphStore((state) => state.past.length > 0);
  const canRedo = useGraphStore((state) => state.future.length > 0);
  const importGraph = useGraphStore((state) => state.importGraph);
  const resetGraphStore = useGraphStore((state) => state.reset);
  const environment = useGraphStore((state) => state.environment);
  const executionIntervalSeconds = useGraphStore((state) => state.executionIntervalSeconds);
  const setExecutionIntervalSeconds = useGraphStore((state) => state.setExecutionIntervalSeconds);
  const shouldShowExecutionInterval = useMemo(() => {
    const kind = clientKindFromEnvironment(environment);
    return kind === 'boolean' || kind === 'integer';
  }, [environment]);
  const [executionIntervalInput, setExecutionIntervalInput] = useState('');
  const initialRelativePath =
    typeof window !== "undefined" ? stripAppBase(window.location.pathname) : "/";
  const initialRouteState = useMemo(
    () => resolveViewFromPath(initialRelativePath),
    [initialRelativePath],
  );

  const [view, setView] = useState<ViewMode>(() => {
    if (initialRouteState.view === "tutorial") return "tutorial";
    if (initialRouteState.view === "effects") return "effects";
    if (initialRouteState.view === "settings") return "settings";
    if (initialRouteState.view === "notFound") return "notFound";
    return "home";
  });
  const currentViewRef = useRef<ViewMode>(view);
  useEffect(() => {
    currentViewRef.current = view;
  }, [view]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history.state) {
      window.history.replaceState({ view: currentViewRef.current }, '', window.location.href);
    }
  }, []);

  const [tutorialRoute, setTutorialRoute] = useState<TutorialRoute>(() =>
    initialRouteState.view === "tutorial" ? initialRouteState.tutorialRoute : { kind: "landing" },
  );
  const [notFoundPath, setNotFoundPath] = useState<string | null>(
    initialRouteState.view === "notFound" ? initialRouteState.path : null,
  );
  const skipInitialRecoveryRef = useRef(
    initialRouteState.view === "tutorial" ||
      initialRouteState.view === "effects" ||
      initialRouteState.view === "notFound" ||
      initialRouteState.view === "settings",
  );
  const didInitialBootstrapRef = useRef(false);

  const [isMobileMode, setIsMobileMode] = useState(() => detectMobileMode());
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadEditorSettings());
  const updateEditorSettings = useCallback((updater: (prev: EditorSettings) => EditorSettings) => {
    setEditorSettings((prev) => {
      const next = updater(prev);
      persistEditorSettings(next);
      return next;
    });
  }, []);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translateText(key, editorSettings.uiPrimaryLanguage, editorSettings.uiSecondaryLanguage, params),
    [editorSettings.uiPrimaryLanguage, editorSettings.uiSecondaryLanguage],
  );
  const defaultProjectName = t('project.defaultName');

  const [history, setHistory] = useState<StoredProject[]>(() => loadProjects());
  const [panelState, setPanelState] = useState<LayoutState>(() => loadLayoutState());
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<'window' | 'file' | null>(null);
  const [gilDialog, setGilDialog] = useState<LightweightDialog | null>(null);
  const [giaModal, setGiaModal] = useState<GiaModalState | null>(null);
  const [isDecodingGia, setIsDecodingGia] = useState(false);
  const settingsReturnViewRef = useRef<'home' | 'editor' | null>(
    initialRouteState.view === 'settings' ? 'home' : null,
  );
  const giaSessionUidRef = useRef<string | null>(null);
  const getGiaUid = useCallback(() => {
    if (editorSettings.giaUidMode === 'fixed') {
      const sanitized = editorSettings.giaFixedUid.trim();
      if (/^\d{9,10}$/.test(sanitized)) {
        return sanitized;
      }
    } else if (editorSettings.giaUidMode === 'perSession') {
      if (!giaSessionUidRef.current) {
        giaSessionUidRef.current = generateGiaUidValue(9);
      }
      return giaSessionUidRef.current;
    }
    return generateGiaUidValue(9);
  }, [editorSettings.giaFixedUid, editorSettings.giaUidMode]);
  useEffect(() => {
    if (editorSettings.giaUidMode !== 'perSession') {
      giaSessionUidRef.current = null;
    }
  }, [editorSettings.giaUidMode]);
  const requestConfirmation = useCallback(
    (dialog: DialogRequest) =>
      new Promise<boolean>((resolve) => {
        setGilDialog({
          ...dialog,
          onConfirm: () => {
            setGilDialog(null);
            resolve(true);
          },
          onCancel: () => {
            setGilDialog(null);
            resolve(false);
          },
        });
      }),
    [setGilDialog],
  );
  const ensureImportVersionSafe = useCallback(
    async (incomingVersion?: string) => {
      const currentVersion = VERSION_INFO.editor;
      if (!incomingVersion || !currentVersion) {
        return true;
      }
      if (compareAppVersions(incomingVersion, currentVersion) <= 0) {
        return true;
      }
      return requestConfirmation({
        title: t('app.importProject.confirmTitle'),
        message: (
          <div>
            <p>
              {t('app.importProject.versionWarning', {
                incomingVersion,
                currentVersion,
              })}
            </p>
            <p>{t('app.importProject.continueQuestion')}</p>
          </div>
        ),
        confirmLabel: t('common.continue'),
        cancelLabel: t('common.cancel'),
      });
    },
    [requestConfirmation, t],
  );
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [saveAsDialog, setSaveAsDialog] = useState<{
    graph: GraphDocument;
    topFolder: ProjectTopFolder;
    categoryKey: string;
    groupSlug: string;
    name: string;
  } | null>(null);
  const [projectInfoDialog, setProjectInfoDialog] = useState<{ name: string; error: string | null } | null>(null);
  const [saveAsNewFolderName, setSaveAsNewFolderName] = useState('');
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const [tabTooltip, setTabTooltip] = useState<{ tabId: TabId; path: string; left: number; top: number } | null>(null);
  const commentMode = useGraphStore((state) => state.commentMode);
  const setCommentMode = useGraphStore((state) => state.setCommentMode);
  const setSelectedComment = useGraphStore((state) => state.setSelectedComment);
  const zoomLevel = useGraphStore((state) => state.zoomLevel);
  const setRequestedZoom = useGraphStore((state) => state.setRequestedZoom);
  const displayedZoom = Math.round(zoomLevel * 100);

  const { paletteCollapsed, inspectorCollapsed } = panelState;

  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const saveToastTimerRef = useRef<number | null>(null);
  const tabTooltipTimerRef = useRef<number | null>(null);
  const autoSaveFingerprintRef = useRef<string | null>(null);
  const graphFingerprintRef = useRef<Map<string, string>>(new Map());
  const previousProjectIdRef = useRef<string | undefined>(projectId ?? undefined);

  const bodyStyle = useMemo(
    () =>
      ({
        '--palette-width': paletteCollapsed ? '48px' : '320px',
        '--inspector-width': inspectorCollapsed ? '48px' : '300px',
      }) as CSSProperties,
    [paletteCollapsed, inspectorCollapsed],
  );
  const graphPathMap = useMemo(() => {
    if (!projectDocument) return new Map<string, string>();
    const map = new Map<string, string>();
    projectDocument.manifest.graphs.forEach((entry) => {
      const resolved = resolveGraphLocation(entry.graphId, entry.path, {
        groupNameHint: entry.groupName,
      });
      map.set(entry.graphId, resolved.normalizedPath);
    });
    return map;
  }, [projectDocument]);

  useEffect(() => {
    if (shouldShowExecutionInterval && typeof executionIntervalSeconds === 'number') {
      setExecutionIntervalInput(formatExecutionInterval(executionIntervalSeconds));
    } else {
      setExecutionIntervalInput('');
    }
  }, [executionIntervalSeconds, shouldShowExecutionInterval]);
  const pushAppHistory = useCallback((path: string, replace = false, state?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    const target = buildAppPath(path);
    const payload = state ?? {};
    if (replace) {
      window.history.replaceState(payload, '', target);
    } else {
      window.history.pushState(payload, '', target);
    }
  }, []);

  useEffect(() => {
    const handleContextMenu = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-allow-native-context]')) {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    const updateMobileMode = () => setIsMobileMode(detectMobileMode());
    updateMobileMode();
    window.addEventListener('resize', updateMobileMode);
    window.addEventListener('orientationchange', updateMobileMode);
    return () => {
      window.removeEventListener('resize', updateMobileMode);
      window.removeEventListener('orientationchange', updateMobileMode);
    };
  }, []);

  const handleExecutionIntervalInputChange = useCallback((value: string) => {
    setExecutionIntervalInput(value);
  }, []);

  const restoreExecutionIntervalInput = useCallback(() => {
    if (shouldShowExecutionInterval && typeof executionIntervalSeconds === 'number') {
      setExecutionIntervalInput(formatExecutionInterval(executionIntervalSeconds));
    } else {
      setExecutionIntervalInput('');
    }
  }, [executionIntervalSeconds, shouldShowExecutionInterval]);

  const commitExecutionInterval = useCallback(() => {
    if (!shouldShowExecutionInterval) return;
    const trimmed = executionIntervalInput.trim();
    if (!trimmed.length) {
      restoreExecutionIntervalInput();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      restoreExecutionIntervalInput();
      return;
    }
    setExecutionIntervalSeconds(parsed);
  }, [
    executionIntervalInput,
    restoreExecutionIntervalInput,
    setExecutionIntervalSeconds,
    shouldShowExecutionInterval,
  ]);

  const showSaveToast = useCallback((message: string) => {
    if (saveToastTimerRef.current) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    setSaveToast(message);
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 2200);
  }, []);
  const clearTabTooltipTimer = useCallback(() => {
    if (tabTooltipTimerRef.current) {
      window.clearTimeout(tabTooltipTimerRef.current);
      tabTooltipTimerRef.current = null;
    }
  }, []);
  const handleTabHoverStart = useCallback(
    (tab: ProjectTab, target: HTMLButtonElement | null) => {
      if (!target || tab.type !== 'graph') return;
      const path = graphPathMap.get(tab.graphId);
      if (!path) return;
      clearTabTooltipTimer();
      tabTooltipTimerRef.current = window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        setTabTooltip({
          tabId: tab.id,
          path,
          left: rect.left + rect.width / 2,
          top: rect.bottom + 8,
        });
      }, 500);
    },
    [clearTabTooltipTimer, graphPathMap],
  );
  const handleTabHoverEnd = useCallback(() => {
    clearTabTooltipTimer();
    setTabTooltip(null);
  }, [clearTabTooltipTimer]);
  useEffect(() => {
    return () => {
      clearTabTooltipTimer();
    };
  }, [clearTabTooltipTimer]);
  useEffect(() => {
    if (!tabTooltip) return;
    const hide = () => setTabTooltip(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tabTooltip]);
  useEffect(() => {
    if (!tabTooltip) return;
    if (openTabs.some((tab) => tab.id === tabTooltip.tabId)) return;
    setTabTooltip(null);
  }, [openTabs, tabTooltip]);

  const handleDockCollapseToggle = useCallback(() => {
    setDockCollapsed((prev) => {
      if (!prev) {
        setZoomMenuOpen(false);
      }
      return !prev;
    });
  }, []);

  const handleZoomButtonClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setZoomMenuOpen((prev) => !prev);
  }, []);

  const handleZoomSelect = useCallback(
    (value: number) => {
      setRequestedZoom(value / 100);
      setZoomMenuOpen(false);
    },
    [setRequestedZoom],
  );

  const handleCommentToggle = useCallback(() => {
    if (commentMode === "selecting") {
      setCommentMode("inactive");
      setSelectedComment(undefined);
    } else {
      setCommentMode("selecting");
    }
  }, [commentMode, setCommentMode, setSelectedComment]);

  const refreshHistory = useCallback(() => {
    setHistory(loadProjects());
  }, []);

  const switchToEditor = useCallback((nextProjectId: string) => {
    setNotFoundPath(null);
    setView('editor');
    updateSessionState(() => ({
      lastActiveProjectId: nextProjectId,
      lastVisitedView: 'editor',
    }));
  }, []);

  const navigateHome = useCallback(
    (replace: boolean) => {
      pushAppHistory('/', replace, { view: 'home' });
      setView('home');
      setTutorialRoute({ kind: 'landing' });
      setNotFoundPath(null);
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'home' }));
    },
    [pushAppHistory],
  );

  const handleGoHome = useCallback(() => {
    setOpenMenu(null);
    navigateHome(false);
  }, [navigateHome]);

  const applySettingsReturnView = useCallback(
    (options?: { viaHistory?: boolean }) => {
      const target = settingsReturnViewRef.current ?? 'home';
      settingsReturnViewRef.current = null;
      if (!options?.viaHistory) {
        pushAppHistory('/', true, { view: target });
      }
      setNotFoundPath(null);
      if (target === 'editor') {
        setView('editor');
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'editor' }));
      } else {
        setView('home');
        setTutorialRoute({ kind: 'landing' });
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'home' }));
      }
    },
    [pushAppHistory],
  );

  const handleCloseSettings = useCallback(() => {
    applySettingsReturnView();
  }, [applySettingsReturnView]);

  const openSettings = useCallback(
    (source: 'home' | 'editor') => {
      setOpenMenu(null);
      settingsReturnViewRef.current = source;
      pushAppHistory('/settings', false, { view: 'settings', returnView: source });
      setTutorialRoute({ kind: 'landing' });
      setNotFoundPath(null);
      setView('settings');
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'settings' }));
    },
    [pushAppHistory],
  );

  const handleOpenSettingsFromHome = useCallback(() => {
    openSettings('home');
  }, [openSettings]);

  const handleOpenSettingsFromEditor = useCallback(() => {
    openSettings('editor');
  }, [openSettings]);

  const handleTutorialNavigate = useCallback(
    (nextPath: string, replace = false) => {
      const normalized = buildTutorialPath(nextPath);
      pushAppHistory(normalized, replace);
      const route = parseTutorialRouteFromPath(normalized);
      setTutorialRoute(route);
      setView('tutorial');
      setNotFoundPath(null);
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'tutorial' }));
    },
    [pushAppHistory],
  );

  const handleOpenTutorial = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetPath = buildTutorialPath('');
    const targetUrl = new URL(targetPath, window.location.origin).toString();
    window.open(targetUrl, '_blank', 'noopener');
  }, []);

  const handleOpenEffects = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetPath = buildAppPath('/effects');
    const targetUrl = new URL(targetPath, window.location.origin).toString();
    window.open(targetUrl, '_blank', 'noopener');
  }, []);

  const handleOpenProjectInfo = useCallback(() => {
    setOpenMenu(null);
    if (!projectDocument || !projectId) {
      window.alert(t('common.noProjectOpen'));
      return;
    }
    setProjectInfoDialog({
      name: projectDocument.manifest.project.name || projectName || defaultProjectName,
      error: null,
    });
  }, [defaultProjectName, projectDocument, projectId, projectName, t]);

  const handleProjectInfoNameChange = useCallback((value: string) => {
    setProjectInfoDialog((prev) => (prev ? { ...prev, name: value, error: null } : prev));
  }, []);

  const handleProjectInfoCancel = useCallback(() => {
    setProjectInfoDialog(null);
  }, []);

  const handleProjectInfoConfirm = useCallback(() => {
    if (!projectInfoDialog) return;
    if (!projectDocument || !projectId) {
      window.alert(t('common.noProjectOpen'));
      setProjectInfoDialog(null);
      return;
    }
    const trimmed = projectInfoDialog.name.trim();
    if (!trimmed) {
      setProjectInfoDialog((prev) =>
        prev ? { ...prev, error: t('app.projectInfo.nameRequired') } : prev,
      );
      return;
    }
    const sanitized = sanitizeName(trimmed, defaultProjectName);
    if (sanitized === projectDocument.manifest.project.name) {
      setProjectInfoDialog(null);
      return;
    }
    setProjectName(sanitized);
    const store = useProjectStore.getState();
    const updatedDocument = store.document;
    if (updatedDocument) {
      const { document: normalized } = normalizeProjectDocument(updatedDocument);
      const existing = history.find((item) => item.id === store.projectId);
      const savedAt = existing?.savedAt ?? new Date().toISOString();
      const record: StoredProject = {
        id: normalized.manifest.project.id,
        name: normalized.manifest.project.name,
        savedAt,
        document: normalized,
      };
      upsertProjectRecord(record);
      refreshHistory();
      autoSaveFingerprintRef.current = fingerprintProjectDocument(normalized);
      showSaveToast(t('app.projectInfo.updatedToast'));
    }
    setProjectInfoDialog(null);
  }, [
    defaultProjectName,
    history,
    projectDocument,
    projectId,
    projectInfoDialog,
    refreshHistory,
    setProjectName,
    showSaveToast,
    t,
  ]);

  const ensurePrimaryGraph = useCallback((document: ProjectDocument) => {
  if (document.manifest.graphs.length > 0) {
    const firstGraphId = document.manifest.graphs[0]?.graphId ?? null;
    return { document, primaryGraphId: firstGraphId };
  }
  const timestamp = new Date().toISOString();
  const newGraphId = createProjectId();
  const resolved = resolveGraphLocation(newGraphId, undefined);
  const environment = resolveEnvironmentFromLocation(resolved.location);
  const defaultInterval = getDefaultExecutionInterval(environment);
  const graphDoc: GraphDocument = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    name: t('graph.defaultName'),
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: [],
    edges: [],
    environment,
    executionIntervalSeconds: defaultInterval ?? undefined,
  };
    const nextDocument: ProjectDocument = {
      manifest: {
        ...document.manifest,
        graphs: [
          ...document.manifest.graphs,
          {
            graphId: newGraphId,
            name: graphDoc.name,
            path: resolved.normalizedPath,
            groupName: resolved.location.groupName,
            createdAt: graphDoc.createdAt,
            updatedAt: graphDoc.updatedAt,
          },
        ],
        groups: document.manifest.groups.map((group) => ({ ...group })),
        project: { ...document.manifest.project },
        manifestVersion: document.manifest.manifestVersion,
        appVersion: document.manifest.appVersion,
      },
      graphs: {
        ...document.graphs,
        [newGraphId]: graphDoc,
      },
    };
    return { document: nextDocument, primaryGraphId: newGraphId };
  }, [t]);

  const prepareProjectDocument = useCallback(
    (incoming: ProjectDocument) => {
      const firstNormalization = normalizeProjectDocument(incoming);
      const { document: ensured, primaryGraphId } = ensurePrimaryGraph(firstNormalization.document);
      const secondNormalization = normalizeProjectDocument(ensured);
      return {
        document: secondNormalization.document,
        primaryGraphId,
        warnings: [...firstNormalization.warnings, ...secondNormalization.warnings],
      };
    },
    [ensurePrimaryGraph],
  );

  const applyProjectDocument = useCallback(
    (document: ProjectDocument, primaryGraphId: string | null) => {
      const normalizedDocument = normalizeGraphDocuments(document);
      setDocument(normalizedDocument);
      graphFingerprintRef.current.clear();
      Object.entries(normalizedDocument.graphs).forEach(([graphDocId, graphDoc]) => {
        graphFingerprintRef.current.set(graphDocId, fingerprintGraphDocument(graphDoc));
      });
      autoSaveFingerprintRef.current = fingerprintProjectDocument(normalizedDocument);

      if (primaryGraphId) {
        const targetGraph = normalizedDocument.graphs[primaryGraphId];
        if (targetGraph) {
          resetGraphStore({ graphId: primaryGraphId });
          importGraph(targetGraph, { graphId: primaryGraphId, recordHistory: false });
          setGraphName(targetGraph.name);
          openGraphTab(primaryGraphId);
        } else {
          resetGraphStore({ graphId: createProjectId() });
          openExplorer('server');
        }
      } else {
        resetGraphStore({ graphId: createProjectId() });
        openExplorer('server');
      }

      switchToEditor(normalizedDocument.manifest.project.id);
    },
    [importGraph, openExplorer, openGraphTab, resetGraphStore, setDocument, setGraphName, switchToEditor],
  );
  const handleCreateNewProject = useCallback(() => {
    const baseDocument = createEmptyProjectDocument({
      projectId: createProjectId(),
      appVersion: VERSION_INFO.editor || '',
      name: defaultProjectName,
    });
    const { document: preparedDocument, primaryGraphId, warnings } =
      prepareProjectDocument(baseDocument);
    applyProjectDocument(preparedDocument, primaryGraphId);
    if (warnings.length) {
      console.warn('Project normalization warnings:', warnings);
    }
  }, [applyProjectDocument, defaultProjectName, prepareProjectDocument]);

  const handleImportProjectDocument = useCallback(
    async (file: File) => {
      try {
        const { document, warnings: loadWarnings } = await loadProjectFromZip(file, {
          fallbackAppVersion: VERSION_INFO.editor,
        });
        const versionOk = await ensureImportVersionSafe(document.manifest.appVersion);
        if (!versionOk) {
          return;
        }
        const { document: prepared, primaryGraphId, warnings: normalizeWarnings } =
          prepareProjectDocument(document);
        applyProjectDocument(prepared, primaryGraphId);
        const combinedWarnings = [...loadWarnings, ...normalizeWarnings];
        if (combinedWarnings.length) {
          window.alert(combinedWarnings.join("\n"));
        } else {
          showSaveToast(t('app.importProject.successToast'));
        }
      } catch (error) {
        console.error(error);
        window.alert(t('app.importProject.failedAlert'));
      }
    },
    [applyProjectDocument, ensureImportVersionSafe, prepareProjectDocument, showSaveToast, t],
  );

  const handleProjectFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const candidate =
        list.find((item) => item.name.toLowerCase().endsWith('.zip')) ??
        list.find((item) => item.type === 'application/zip') ??
        list[0];
      if (!candidate) return;
      await handleImportProjectDocument(candidate);
    },
    [handleImportProjectDocument],
  );

  const handleProjectFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void handleImportProjectDocument(file);
      event.target.value = '';
    },
    [handleImportProjectDocument],
  );

  const handleDecodeGiaFile = useCallback(async (file: File) => {
    setIsDecodingGia(true);
    try {
      const buffer = await file.arrayBuffer();
      const decoded = decodeGiaBinary(buffer);
      const pretty = JSON.stringify(decoded, null, 2);
      setGiaModal({
        fileName: file.name,
        jsonText: pretty,
        highlightedJson: highlightJsonText(pretty),
      });
    } catch (error) {
      console.error('Failed to decode GIA file', error);
      const message = isLocalizedError(error)
        ? t(error.key, error.params)
        : error instanceof Error
          ? error.message
          : t('app.giaDecode.unknownError');
      setGilDialog({
        title: t('app.giaDecode.failedTitle'),
        message,
        confirmLabel: t('common.close'),
      });
    } finally {
      setIsDecodingGia(false);
    }
  }, [t]);

  const handleDownloadGiaJson = useCallback(() => {
    if (!giaModal) return;
    const safeBase = sanitizeFileName(giaModal.fileName.replace(/\.gia$/i, '') || 'gia');
    const filename = `${safeBase}.decoded.json`;
    const blob = new Blob([giaModal.jsonText], { type: 'application/json;charset=utf-8' });
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [giaModal]);

  const closeGiaModal = useCallback(() => {
    setGiaModal(null);
  }, []);

  const performProjectSave = useCallback(() => {
    const store = useProjectStore.getState();
    if (!store.document || !store.projectId) {
      window.alert(t('common.noProjectOpen'));
      return false;
    }
    const { document: normalized } = normalizeProjectDocument(store.document);
    updateDocument(() => normalized);
    const savedAt = new Date().toISOString();
    const record: StoredProject = {
      id: normalized.manifest.project.id,
      name: normalized.manifest.project.name,
      savedAt,
      document: normalized,
    };
    upsertProjectRecord(record);
    refreshHistory();
    Object.keys(store.dirtyGraphIds).forEach((id) => {
      store.markGraphDirty(id, false);
    });
    Object.keys(store.dirtyStructIds ?? {}).forEach((id) => {
      store.markStructDirty(id, false);
    });
    autoSaveFingerprintRef.current = fingerprintProjectDocument(normalized);
    showSaveToast(t('app.save.savedToast'));
    return true;
  }, [refreshHistory, showSaveToast, t, updateDocument]);

  const handleManualSave = useCallback(() => {
    const store = useProjectStore.getState();
    const validator = store.structSaveValidator;
    if (validator) {
      return validator();
    }
    return performProjectSave();
  }, [performProjectSave]);

  const handleExportProject = useCallback(async () => {
    const store = useProjectStore.getState();
    if (!store.document) {
      window.alert(t('common.noProjectOpen'));
      return;
    }
    try {
      const { blob, document: normalized, warnings } = await saveProjectToZip(store.document, {
        pretty: true,
      });
      const filename = `${sanitizeFileName(
        store.projectName || normalized.manifest.project.name || 'project',
      )}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
      const link = window.document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      if (warnings.length) {
        console.warn('Project normalization warnings:', warnings);
      }
    } catch (error) {
      console.error(error);
      window.alert(t('app.exportProject.failedAlert'));
    }
  }, [t]);

  
  const performGilExport = useCallback(
    async (templateGil: ArrayBuffer) => {
      if (!projectDocument) return;
      const { document: normalized } = normalizeProjectDocument(projectDocument);
      const { gilBuffer } = await exportGraphsToGil({
        templateGil,
        projectDocument: normalized,
      });
      const filename = `${sanitizeFileName(
        projectName || normalized.manifest.project.name || 'project',
      )}-${new Date().toISOString().replace(/[:.]/g, '-')}.gil`;
      const blob = new Blob([gilBuffer], { type: 'application/octet-stream' });
      const link = window.document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    },
    [projectDocument, projectName],
  );

  const handleExportGil = useCallback(() => {
    if (!projectDocument) {
      setGilDialog({
        title: t('app.gilExport.title'),
        message: t('common.noProjectOpen'),
        confirmLabel: t('common.close'),
        onConfirm: () => setGilDialog(null),
      });
      return;
    }

    const pickTemplateFile = () => {
      const picker = window.document.createElement('input');
      picker.type = 'file';
      picker.accept = '.gil';
      picker.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          await performGilExport(await file.arrayBuffer());
        } catch (error) {
          console.error(error);
          const errorText = isLocalizedError(error)
            ? t(error.key, error.params)
            : error instanceof Error
              ? error.message
              : String(error);
          setGilDialog({
            title: t('app.gilExport.title'),
            message: t('app.gilExport.failedMessage', {
              error: errorText,
            }),
            confirmLabel: t('common.close'),
            onConfirm: () => setGilDialog(null),
          });
        } finally {
          picker.value = '';
        }
      };
      picker.click();
    };

    setGilDialog({
      title: t('app.gilExport.title'),
      message: (
        <>
          {t('app.gilExport.prompt.line1')}
          <br /><br />
          {t('app.gilExport.prompt.line2')}
        </>
      ),
      confirmLabel: t('app.gilExport.pickTemplate'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setGilDialog(null);
        if (!handleManualSave()) {
          return;
        }
        pickTemplateFile();
      },
      onCancel: () => setGilDialog(null),
    });
  }, [handleManualSave, performGilExport, projectDocument, t]);

const handleSaveGraphAs = useCallback(() => {
    if (!projectDocument || !activeGraphId) {
      window.alert(t('common.noGraphOpen'));
      return;
    }
    const graphState = useGraphStore.getState();
    const activeGraph = graphState.exportGraph();
    const manifestEntry = projectDocument.manifest.graphs.find(
      (entry) => entry.graphId === activeGraphId,
    );
    const resolved = resolveGraphLocation(activeGraphId, manifestEntry?.path, {
      groupNameHint: manifestEntry?.groupName,
    });
    const topFolder = resolved.location.topFolder;
    const categoriesForTop = PROJECT_CATEGORIES_BY_TOP[topFolder];
    if (!categoriesForTop.length) {
      window.alert(t('app.saveAs.noCategories'));
      return;
    }
    const initialCategory =
      categoriesForTop.find((category) => category.key === resolved.location.categoryKey) ??
      categoriesForTop[0];
    const groupsForCategory = projectDocument.manifest.groups.filter(
      (group) => group.topFolder === topFolder && group.categoryKey === initialCategory.key,
    );
    const initialGroupSlug =
      groupsForCategory.find((group) => group.groupSlug === resolved.location.groupSlug)?.groupSlug ??
      groupsForCategory[0]?.groupSlug ??
      DEFAULT_GROUP_SLUG;

    setSaveAsDialog({
      graph: activeGraph,
      topFolder,
      categoryKey: initialCategory.key,
      groupSlug: initialGroupSlug,
      name: activeGraph.name,
    });
    setSaveAsNewFolderName('');
    setSaveAsError(null);
  }, [activeGraphId, projectDocument, t]);

  const handleExportCurrentGraph = useCallback(() => {
    if (!activeGraphId) {
      setGilDialog({
        title: t('app.exportGraphJson.title'),
        message: t('common.noGraphOpen'),
        confirmLabel: t('common.gotIt'),
      });
      return;
    }
    const graphState = useGraphStore.getState();
    const exportedGraph = graphState.exportGraph();
    const manifestEntry = projectDocument?.manifest.graphs.find(
      (entry) => entry.graphId === activeGraphId,
    );
    const resolvedLocation = resolveGraphLocation(activeGraphId, manifestEntry?.path, {
      groupNameHint: manifestEntry?.groupName,
    });
    const environment: GraphEnvironment =
      exportedGraph.environment ?? resolveEnvironmentFromLocation(resolvedLocation.location);
    const exportPayload: GraphDocument = {
      ...exportedGraph,
      environment,
    };
    const baseName = manifestEntry?.name ?? exportedGraph.name ?? "graph";
    const extension =
      getEnvironmentTopFolder(environment) === 'client' ? 'client.json' : 'server.json';
    const fileName = `${sanitizeFileName(baseName)}-${activeGraphId}.${extension}`;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const link = window.document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [activeGraphId, projectDocument, t]);

  const handleExportGiaPrototype = useCallback(() => {
    if (!activeGraphId) {
      setGilDialog({
        title: t('app.giaExportExperimental.title'),
        message: t('common.noGraphOpen'),
        confirmLabel: t('common.gotIt'),
      });
      return;
    }
    const graphState = useGraphStore.getState();
    const exportedGraph = graphState.exportGraph();
    const manifestEntry = projectDocument?.manifest.graphs.find(
      (entry) => entry.graphId === activeGraphId,
    );
    const resolvedLocation = resolveGraphLocation(activeGraphId, manifestEntry?.path, {
      groupNameHint: manifestEntry?.groupName,
    });
    const environment: GraphEnvironment =
      exportedGraph.environment ?? resolveEnvironmentFromLocation(resolvedLocation.location);
    const exportPayload: GraphDocument = {
      ...exportedGraph,
      environment,
    };
    try {
      const uid = getGiaUid();
      const result = exportGiaDocument(exportPayload, { uid });
      const link = window.document.createElement("a");
      link.href = URL.createObjectURL(result.blob);
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      if (result.warnings.length > 0) {
        setGilDialog({
          title: t('app.giaExportExperimental.title'),
          message: (
            <div>
              <p>{t('app.giaExportExperimental.warningsIntro')}</p>
              <ul>
                {result.warnings.map((warning, index) => (
                  <li key={`${index}-${warning.key}`}>{t(warning.key, warning.params)}</li>
                ))}
              </ul>
            </div>
          ),
          confirmLabel: t('common.confirm'),
        });
      }
    } catch (error) {
      console.error(error);
      setGilDialog({
        title: t('app.giaExportExperimental.failedTitle'),
        message: (
          <div>
            <p>{t('app.giaExportExperimental.failedHint')}</p>
            {error instanceof Error && error.message ? (
              <pre>{error.message}</pre>
            ) : null}
          </div>
        ),
        confirmLabel: t('common.gotIt'),
      });
    }
  }, [activeGraphId, getGiaUid, projectDocument, setGilDialog, t]);

  const handleSaveAsCancel = useCallback(() => {
    setSaveAsDialog(null);
    setSaveAsNewFolderName('');
    setSaveAsError(null);
  }, []);

  const handleSaveAsNameChange = useCallback((value: string) => {
    setSaveAsDialog((prev) => (prev ? { ...prev, name: value } : prev));
    setSaveAsError(null);
  }, []);

  const handleSaveAsCategoryChange = useCallback(
    (value: string) => {
      if (!projectDocument) return;
      setSaveAsDialog((prev) => {
        if (!prev) return prev;
        const groupsForCategory = projectDocument.manifest.groups.filter(
          (group) => group.topFolder === prev.topFolder && group.categoryKey === value,
        );
        const fallbackSlug =
          groupsForCategory.find((group) => group.groupSlug === prev.groupSlug)?.groupSlug ??
          groupsForCategory[0]?.groupSlug ??
          DEFAULT_GROUP_SLUG;
        return {
          ...prev,
          categoryKey: value,
          groupSlug: fallbackSlug,
        };
      });
      setSaveAsNewFolderName('');
      setSaveAsError(null);
    },
    [projectDocument],
  );

  const handleSaveAsGroupChange = useCallback((value: string) => {
    setSaveAsDialog((prev) => (prev ? { ...prev, groupSlug: value } : prev));
    setSaveAsError(null);
  }, []);

  const handleSaveAsConfirm = useCallback(() => {
    if (!projectDocument || !saveAsDialog) return;
    const trimmedName = saveAsDialog.name.trim();
    if (!trimmedName) {
      setSaveAsError(t('app.saveAs.error.nameRequired'));
      return;
    }
    const categoriesForTop = PROJECT_CATEGORIES_BY_TOP[saveAsDialog.topFolder];
    const category =
      categoriesForTop.find((item) => item.key === saveAsDialog.categoryKey) ??
      categoriesForTop[0];
    if (!category) {
      setSaveAsError(t('app.saveAs.error.categoryMissing'));
      return;
    }
    const sourceEnv = saveAsDialog.graph.environment;
    const sourceTop = sourceEnv ? getEnvironmentTopFolder(sourceEnv) : saveAsDialog.topFolder;
    if (sourceTop !== saveAsDialog.topFolder) {
      setSaveAsError(t('app.saveAs.error.topFolderMismatch'));
      return;
    }
    const sourceKind = sourceEnv ? clientKindFromEnvironment(sourceEnv) : null;
    const targetKind =
      saveAsDialog.topFolder === 'client'
        ? category.key === 'boolean-filter'
          ? 'boolean'
          : category.key === 'integer-filter'
            ? 'integer'
            : category.key === 'skill'
              ? 'skill'
              : null
        : null;
    if (sourceKind && targetKind && sourceKind !== targetKind) {
      setSaveAsError(t('app.saveAs.error.clientKindMismatch'));
      return;
    }
    const groupsForCategory = projectDocument.manifest.groups.filter(
      (group) => group.topFolder === saveAsDialog.topFolder && group.categoryKey === category.key,
    );
    let targetGroupSlug = saveAsDialog.groupSlug;
    let targetGroupName: string | undefined;
    const trimmedFolderName = saveAsNewFolderName.trim();
    if (trimmedFolderName) {
      const created = createGroup(saveAsDialog.topFolder, category.key, trimmedFolderName);
      if (!created) {
        setSaveAsError(t('app.saveAs.error.createFolderFailed'));
        return;
      }
      targetGroupSlug = created.groupSlug;
      targetGroupName = created.groupName;
    } else {
      const existingGroup =
        groupsForCategory.find((group) => group.groupSlug === targetGroupSlug) ??
        groupsForCategory[0];
      if (!existingGroup) {
        setSaveAsError(t('app.saveAs.error.folderRequired'));
        return;
      }
      targetGroupSlug = existingGroup.groupSlug;
      targetGroupName = existingGroup.groupName;
    }
    const location = {
      topFolder: saveAsDialog.topFolder,
      categoryKey: category.key,
      categoryDirectory: category.directory,
      groupSlug: targetGroupSlug,
      groupName: targetGroupName ?? DEFAULT_GROUP_NAME,
    };
    const environment = resolveEnvironmentFromLocation(location);
    const defaultInterval = getDefaultExecutionInterval(environment);
    const preservedInterval = saveAsDialog.graph.executionIntervalSeconds;
    const executionIntervalSeconds =
      defaultInterval !== undefined
        ? preservedInterval ?? defaultInterval
        : preservedInterval;
    const newGraphId = createProjectId();
    const timestamp = new Date().toISOString();
    const duplicatedGraph: GraphDocument = {
      ...saveAsDialog.graph,
      name: trimmedName,
      createdAt: saveAsDialog.graph.createdAt ?? timestamp,
      updatedAt: timestamp,
      environment,
      executionIntervalSeconds,
    };
    const path = buildGraphPath(location, newGraphId);
    setGraphDocument(newGraphId, duplicatedGraph);
    setManifestEntry({
      graphId: newGraphId,
      name: trimmedName,
      path,
      groupName: location.groupName,
      createdAt: duplicatedGraph.createdAt,
      updatedAt: duplicatedGraph.updatedAt,
    });
    markGraphDirty(newGraphId, false);
    graphFingerprintRef.current.set(newGraphId, fingerprintGraphDocument(duplicatedGraph));
    handleSaveAsCancel();
    openGraphTab(newGraphId);
    showSaveToast(t('app.saveAs.successToast'));
  }, [
    createGroup,
    handleSaveAsCancel,
    markGraphDirty,
    openGraphTab,
    projectDocument,
    saveAsDialog,
    saveAsNewFolderName,
    setGraphDocument,
    setManifestEntry,
    showSaveToast,
    t,
  ]);

  const handleSaveAll = useCallback(async () => {
    if (!history.length) return;
    const archive = new JSZip();
    for (const record of history) {
      try {
        const { blob } = await saveProjectToZip(record.document, { pretty: true });
        const filename = `${sanitizeFileName(record.name || 'project')}_${record.id}.zip`;
        archive.file(filename, blob);
      } catch (error) {
        console.error("打包项目失败", error);
      }
    }
    const aggregated = await archive.generateAsync({ type: 'blob' });
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(aggregated);
    link.download = `miliastra-projects-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [history]);

  const handleOpenProject = useCallback(
    (project: StoredProject) => {
      try {
        const { document: prepared, primaryGraphId, warnings } = prepareProjectDocument(
          project.document,
        );
        applyProjectDocument(prepared, primaryGraphId);
        if (warnings.length) {
          console.warn("项目规范化警告：", warnings);
        }
      } catch (error) {
        console.error(error);
        window.alert(t('app.history.loadFailedAlert'));
        refreshHistory();
      }
    },
    [applyProjectDocument, prepareProjectDocument, refreshHistory, t],
  );

  const handleDeleteProject = useCallback(
    (targetId: string) => {
      removeProjectRecord(targetId);
      clearAutoSavesForProject(targetId);
      refreshHistory();
      updateSessionState((prev) => {
        const next = { ...prev };
        if (next.lastActiveProjectId === targetId) {
          delete next.lastActiveProjectId;
        }
        return next;
      });
      if (projectId === targetId) {
        resetProjectStore();
        resetGraphStore({ graphId: createProjectId() });
        autoSaveFingerprintRef.current = null;
        graphFingerprintRef.current.clear();
        navigateHome(false);
      }
    },
    [navigateHome, projectId, refreshHistory, resetGraphStore, resetProjectStore],
  );

  const handleOpenGraphFromExplorer = useCallback(
    (graphIdToOpen: string) => {
      openGraphTab(graphIdToOpen);
    },
    [openGraphTab],
  );

  const handleTabSelect = useCallback(
    (tabId: TabId) => {
      activateTab(tabId);
    },
    [activateTab],
  );

  const handleTabClose = useCallback(
    (tabId: TabId) => {
      const targetTab = openTabs.find((tab) => tab.id === tabId);
      if (targetTab?.type === 'struct' && Object.keys(dirtyStructIds).length > 0) {
        const saved = handleManualSave();
        if (!saved) {
          return;
        }
      }
      closeTab(tabId);
    },
    [closeTab, dirtyStructIds, handleManualSave, openTabs],
  );

  const handleOpenExplorerTab = useCallback(
    (folder: ProjectTopFolder) => {
      openExplorer(folder);
      setOpenMenu(null);
    },
    [openExplorer],
  );
  const handleOpenStructTab = useCallback(() => {
    openStructManager();
    setOpenMenu(null);
  }, [openStructManager]);

  const handleGraphNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setGraphName(event.target.value);
    },
    [setGraphName],
  );

  const handleToggleMenu = useCallback(
    (menu: 'window' | 'file') => {
      setOpenMenu((prev) => (prev === menu ? null : menu));
    },
    [],
  );

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (typeof window === 'undefined') return;
      const relative = stripAppBase(window.location.pathname);
      const routeState = resolveViewFromPath(relative);
      if (routeState.view === 'settings') {
        const returnView = event.state?.returnView === 'editor' ? 'editor' : 'home';
        settingsReturnViewRef.current = returnView;
        setTutorialRoute({ kind: 'landing' });
        setNotFoundPath(null);
        setView('settings');
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'settings' }));
        return;
      }
      if (currentViewRef.current === 'settings') {
        applySettingsReturnView({ viaHistory: true });
        return;
      }
      if (routeState.view === 'tutorial') {
        setTutorialRoute(routeState.tutorialRoute);
        setView('tutorial');
        setNotFoundPath(null);
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'tutorial' }));
        return;
      }
      if (routeState.view === 'effects') {
        setTutorialRoute({ kind: 'landing' });
        setView('effects');
        setNotFoundPath(null);
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'effects' }));
        return;
      }
      if (routeState.view === 'home') {
        setTutorialRoute({ kind: 'landing' });
        setView('home');
        setNotFoundPath(null);
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'home' }));
        return;
      }
      setTutorialRoute({ kind: 'landing' });
      setView('notFound');
      setNotFoundPath(routeState.path);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applySettingsReturnView]);

  useEffect(() => {
    if (view === 'effects') {
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'effects' }));
    }
  }, [view]);

  useEffect(() => {
    if (!openMenu) return;
    const closeMenu = () => setOpenMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [openMenu]);

  useEffect(() => {
    if (!zoomMenuOpen) return undefined;
    const closeMenu = () => setZoomMenuOpen(false);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [zoomMenuOpen]);

  useEffect(() => {
    if (!saveAsDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleSaveAsCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveAsCancel, saveAsDialog]);

  useEffect(() => {
    if (!projectInfoDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleProjectInfoCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleProjectInfoCancel, projectInfoDialog]);

  useEffect(() => {
    if (!saveAsDialog || !projectDocument) return;
    const groupsForCategory = projectDocument.manifest.groups.filter(
      (group) =>
        group.topFolder === saveAsDialog.topFolder &&
        group.categoryKey === saveAsDialog.categoryKey,
    );
    if (!groupsForCategory.length) return;
    if (!groupsForCategory.some((group) => group.groupSlug === saveAsDialog.groupSlug)) {
      const fallbackSlug = groupsForCategory[0].groupSlug;
      setSaveAsDialog((prev) => (prev ? { ...prev, groupSlug: fallbackSlug } : prev));
    }
  }, [projectDocument, saveAsDialog]);

  useEffect(() => {
    if (view !== 'editor') return undefined;
    const interval = window.setInterval(() => {
      const state = useProjectStore.getState();
      if (!state.document || !state.projectId) return;
      const fingerprint = fingerprintProjectDocument(state.document);
      if (autoSaveFingerprintRef.current === fingerprint) {
        return;
      }
      autoSaveFingerprintRef.current = fingerprint;
      const entry: AutoSaveEntry = {
        savedAt: new Date().toISOString(),
        document: state.document,
      };
      persistAutoSaveEntry(state.projectId, entry, AUTOSAVE_LIMIT);
      updateSessionState(() => ({
        lastActiveProjectId: state.projectId ?? undefined,
        lastVisitedView: 'editor',
      }));
    }, AUTO_SAVE_INTERVAL);
    return () => window.clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (previousProjectIdRef.current && previousProjectIdRef.current !== projectId) {
      autoSaveFingerprintRef.current = null;
    }
    previousProjectIdRef.current = projectId ?? undefined;
  }, [projectId]);

  useEffect(() => {
    const unsubscribe = useGraphStore.subscribe((graphState) => {
      const currentGraphId = graphState.graphId;
      if (!currentGraphId) return;
      const projectState = useProjectStore.getState();
      if (!projectState.document || projectState.activeGraphId !== currentGraphId) return;
      const snapshot = graphState.exportGraph();
      const fingerprint = fingerprintGraphDocument(snapshot);
      const previous = graphFingerprintRef.current.get(currentGraphId);
      if (previous === fingerprint) return;
      graphFingerprintRef.current.set(currentGraphId, fingerprint);
      projectState.setGraphDocument(currentGraphId, snapshot);
      projectState.markGraphDirty(currentGraphId, true);
      const manifestEntry = projectState.document.manifest.graphs.find(
        (entry) => entry.graphId === currentGraphId,
      );
      if (manifestEntry && manifestEntry.name !== snapshot.name) {
        projectState.setManifestEntry({
          ...manifestEntry,
          name: snapshot.name,
          updatedAt: new Date().toISOString(),
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!projectDocument) return;
    if (!activeGraphId) return;
    const target = projectDocument.graphs[activeGraphId];
    if (!target) return;
    const normalizedTarget = withGraphEnvironment(
      activeGraphId,
      target,
      projectDocument.manifest,
    );
    const current = useGraphStore.getState();
    const currentFingerprint = fingerprintGraphDocument(current.exportGraph());
    const targetFingerprint = fingerprintGraphDocument(normalizedTarget);
    if (current.graphId !== activeGraphId || currentFingerprint !== targetFingerprint) {
      importGraph(normalizedTarget, { graphId: activeGraphId, recordHistory: false });
      setGraphName(normalizedTarget.name);
      graphFingerprintRef.current.set(activeGraphId, targetFingerprint);
    }
  }, [activeGraphId, importGraph, projectDocument, setGraphName]);

  useEffect(() => {
    if (didInitialBootstrapRef.current) {
      return;
    }
    didInitialBootstrapRef.current = true;
    const projects = loadProjects();
    setHistory(projects);
    const session = loadSessionState();
    if (skipInitialRecoveryRef.current || initialRouteState.view !== 'home') {
      skipInitialRecoveryRef.current = false;
      return;
    }
    const lastProjectId = session.lastActiveProjectId;
    if (!lastProjectId) {
      navigateHome(true);
      return;
    }
    const autoSaveMap = loadAutoSaveMap();
    const entries = autoSaveMap[lastProjectId] ?? [];
    const manual = projects.find((item) => item.id === lastProjectId);
    const manualTime = manual ? Date.parse(manual.savedAt) : 0;
    const threshold = manualTime + AUTO_SAVE_RECOVERY_THRESHOLD;
    const validEntries: AutoSaveEntry[] = [];
    let recovered = false;
    for (const entry of entries) {
      const autoTime = Date.parse(entry.savedAt);
      if (Number.isNaN(autoTime)) {
        continue;
      }
      if (manualTime && autoTime <= threshold) {
        validEntries.push(entry);
        continue;
      }
      try {
        const { document: prepared, primaryGraphId, warnings } = prepareProjectDocument(
          entry.document,
        );
        applyProjectDocument(prepared, primaryGraphId);
        if (warnings.length) {
          console.warn("自动恢复规范化警告：", warnings);
        }
        showSaveToast(t('app.autoSave.recoveredToast'));
        recovered = true;
        validEntries.push(entry);
        break;
      } catch (error) {
        console.error("自动恢复失败", error);
      }
    }
    if (!recovered) {
      if (manual) {
        try {
          const { document: prepared, primaryGraphId, warnings } = prepareProjectDocument(
            manual.document,
          );
          applyProjectDocument(prepared, primaryGraphId);
          if (warnings.length) {
            console.warn("历史项目规范化警告：", warnings);
          }
        } catch (error) {
          console.error(error);
          navigateHome(true);
        }
      } else {
        navigateHome(true);
      }
    }
    if (validEntries.length !== entries.length) {
      replaceAutoSavesForProject(lastProjectId, validEntries);
    }
  }, [applyProjectDocument, initialRouteState.view, navigateHome, prepareProjectDocument, showSaveToast, t]);

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) {
        window.clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((project) => {
      const key = project.name || defaultProjectName;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [defaultProjectName, history]);

  const activeTab: ProjectTab | null = useMemo(() => {
    if (!openTabs.length) return null;
    return openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0] ?? null;
  }, [activeTabId, openTabs]);

  const isGraphTab = activeTab?.type === 'graph';
  const isStructTab = activeTab?.type === 'struct';
  const activeTabType = activeTab?.type ?? null;
  const explorerTopFolder: ProjectTopFolder =
    activeTab?.type === 'explorer' ? activeTab.topFolder : 'server';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key !== 's' && event.key !== 'S') return;
      event.preventDefault();
      if (view !== 'editor') return;
      if (isGraphTab || activeTabType === 'explorer' || activeTabType === 'struct') {
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabType, handleManualSave, isGraphTab, view]);

  const togglePalette = useCallback(() => {
    setPanelState((prev) => {
      const next = { ...prev, paletteCollapsed: !prev.paletteCollapsed };
      persistLayoutState(next);
      return next;
    });
  }, []);

  const toggleInspector = useCallback(() => {
    setPanelState((prev) => {
      const next = { ...prev, inspectorCollapsed: !prev.inspectorCollapsed };
      persistLayoutState(next);
      return next;
    });
  }, []);
  const renderTabs = () => (
    <div className="app__tabs">
      {openTabs.map((tab: ProjectTab) => {
        const isActive = tab.id === activeTabId;
        const isDirtyGraph = tab.type === 'graph' && Boolean(dirtyGraphIds[tab.graphId]);
        const isDirtyStruct = tab.type === 'struct' && Object.keys(dirtyStructIds).length > 0;
        const isDirty = isDirtyGraph || isDirtyStruct;
        const tabLabel =
          tab.type === 'explorer'
            ? tab.topFolder === 'server'
              ? t('tabs.explorer.server')
              : t('tabs.explorer.client')
            : tab.type === 'struct'
              ? t('tabs.structManager')
              : tab.label;
        let iconSrc = ICON_TAB_GRAPH;
        if (tab.type === 'explorer') {
          iconSrc = tab.topFolder === 'server' ? ICON_TAB_SERVER : ICON_TAB_CLIENT;
        } else if (tab.type === 'struct') {
          iconSrc = ICON_STRUCT;
        }
        return (
          <button
            key={tab.id}
            type="button"
            className={`app__tab ${isActive ? 'is-active' : ''}`}
            onClick={() => handleTabSelect(tab.id)}
            onMouseEnter={(event) => handleTabHoverStart(tab, event.currentTarget)}
            onMouseLeave={handleTabHoverEnd}
            onFocus={(event) => handleTabHoverStart(tab, event.currentTarget)}
            onBlur={handleTabHoverEnd}
          >
            <span className="app__tab-label">
              <img src={iconSrc} alt="" aria-hidden="true" />
              {tabLabel}
              {isDirty && <span className="app__tab-dirty">*</span>}
            </span>
            {(tab.type === "graph" || tab.type === "struct") && (
              <span
                role="button"
                aria-label={t('app.tabs.closeAria', { label: tabLabel })}
                className="app__tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  handleTabClose(tab.id);
                }}
              >
                ×
              </span>
            )}
          </button>
        );
      })}
      {tabTooltip && (
        <div
          className="app__tab-tooltip"
          style={{ left: tabTooltip.left, top: tabTooltip.top }}
        >
          {tabTooltip.path}
        </div>
      )}
    </div>
  );

  const renderEditor = () => {
    const saveAsCategories = saveAsDialog
      ? PROJECT_CATEGORIES_BY_TOP[saveAsDialog.topFolder]
      : [];
    const selectedCategory = saveAsDialog
      ? saveAsCategories.find((category) => category.key === saveAsDialog.categoryKey) ??
        saveAsCategories[0] ??
        null
      : null;
    const saveAsGroups =
      saveAsDialog && projectDocument
        ? projectDocument.manifest.groups
            .filter(
              (group) =>
                group.topFolder === saveAsDialog.topFolder &&
                group.categoryKey === (selectedCategory?.key ?? saveAsDialog.categoryKey),
            )
            .sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-CN'))
        : [];
    const selectedGroup = saveAsDialog
      ? saveAsGroups.find((group) => group.groupSlug === saveAsDialog.groupSlug) ??
        saveAsGroups[0] ??
        null
      : null;
    const saveAsTopFolderLabel = saveAsDialog
      ? saveAsDialog.topFolder === 'client'
        ? t('app.saveAs.topFolder.client')
        : t('app.saveAs.topFolder.server')
      : '';
    const saveAsPathPreview =
      saveAsDialog && selectedCategory && selectedGroup
        ? `/${saveAsDialog.topFolder}/${selectedCategory.directory}/${selectedGroup.groupSlug}/`
        : saveAsDialog
          ? `/${saveAsDialog.topFolder}/`
          : '';

    const isGiaFixedUidValid = /^\d{9,10}$/.test(editorSettings.giaFixedUid);
    const isGiaExportButtonEnabled =
      editorSettings.giaUidMode !== 'fixed' || isGiaFixedUidValid;

    return (
      <>
      <header className="app__editor-bar">
        <div className="app__editor-bar-left">
          <img src={ICON_APP_LOGO} alt="" className="app__editor-logo" />
          <nav
            className="app__editor-menu"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="app__editor-menu-item">
              <button
                type="button"
                className="app__editor-menu-button"
                onClick={() => handleToggleMenu("window")}
              >
                {t('app.menu.window')}
              </button>
              {openMenu === 'window' && (
                <div className="app__editor-menu-dropdown">
                  <button type="button" onClick={() => handleOpenExplorerTab("server")}>
                    <img src={ICON_TAB_SERVER} alt="" aria-hidden="true" />
                    {t('app.menu.window.serverExplorer')}
                  </button>
                  <button type="button" onClick={() => handleOpenExplorerTab("client")}>
                    <img src={ICON_TAB_CLIENT} alt="" aria-hidden="true" />
                    {t('app.menu.window.clientExplorer')}
                  </button>
                  <button type="button" onClick={handleOpenStructTab}>
                    <img src={ICON_STRUCT} alt="" aria-hidden="true" />
                    {t('app.menu.window.structManager')}
                  </button>
                  <button type="button" onClick={handleGoHome}>
                    <img src={ICON_BACK} alt="" aria-hidden="true" />
                    {t('app.menu.window.goHome')}
                  </button>
                </div>
              )}
            </div>
            <div className="app__editor-menu-item">
              <button
                type="button"
                className="app__editor-menu-button"
                onClick={() => handleToggleMenu("file")}
              >
                {t('app.menu.file')}
              </button>
              {openMenu === 'file' && (
                <div className="app__editor-menu-dropdown">
                  <button type="button" onClick={handleManualSave}>
                    <img src={ICON_SAVE} alt="" aria-hidden="true" />
                    {t('app.menu.file.saveProject')}
                  </button>
                  <button type="button" onClick={handleOpenProjectInfo}>
                    <img src={ICON_PROJECT} alt="" aria-hidden="true" />
                    {t('app.menu.file.editProjectInfo')}
                  </button>
                  <button type="button" onClick={handleExportProject}>
                    <img src={ICON_EXPORT} alt="" aria-hidden="true" />
                    {t('app.menu.file.exportZip')}
                  </button>
                  {editorSettings.enableGilExport && (
                    <button type="button" onClick={handleExportGil}>
                      <img src={ICON_EXPORT} alt="" aria-hidden="true" />
                      {t('app.menu.file.exportGil')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="app__editor-bar-center">{VERSION_INFO.node || VERSION_INFO.editor}</div>
        <div className="app__editor-bar-right">
          <button
            type="button"
            className="app__editor-icon-button"
            onClick={handleOpenSettingsFromEditor}
            aria-label={t('common.settings')}
          >
            <img src={ICON_SETTING} alt="" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app__editor-icon-button app__editor-icon-button--github"
            onClick={() => window.open(GITHUB_URL, '_blank', 'noopener')}
            aria-label={t('common.github')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path
                d="M12 .5C5.73.5.5 5.74.5 12.04c0 5.11 3.29 9.45 7.86 10.98.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.03 1.79 2.7 1.27 3.36.97.1-.76.4-1.27.72-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.57.23 2.73.12 3.02.74.81 1.18 1.84 1.18 3.1 0 4.44-2.68 5.41-5.23 5.7.41.36.77 1.08.77 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56C20.21 21.49 23.5 17.15 23.5 12.04 23.5 5.74 18.27.5 12 .5z"
                fill="#FFF"
              />
            </svg>
          </button>
          <button
            type="button"
            className="app__editor-icon-button"
            onClick={handleOpenTutorial}
            aria-label={t('common.tutorial')}
          >
            <img src={ICON_TUTORIAL} alt="" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app__editor-icon-button"
            onClick={handleOpenEffects}
            aria-label={t('common.effects')}
          >
            <img src={ICON_EFFECTS} alt="" aria-hidden="true" />
          </button>
        </div>
      </header>
      {renderTabs()}
      <div className={isGraphTab ? 'app__body' : 'app__body app__body--explorer'} style={bodyStyle}>
        {isGraphTab ? (
          <>
            <NodePalette
              collapsed={paletteCollapsed}
              onToggle={togglePalette}
              isTouchEnvironment={isMobileMode}
              allowSearchAllLanguageNodeNames={editorSettings.allowSearchAllLanguageNodeNames}
            />
            <GraphCanvas isMobileMode={isMobileMode} settings={editorSettings} />
            <NodeInspector collapsed={inspectorCollapsed} onToggle={toggleInspector} />
          </>
        ) : isStructTab ? (
          <StructureManager
            projectDocument={projectDocument}
            dirtyStructIds={dirtyStructIds}
            onRequestSave={performProjectSave}
          />
        ) : (
          <ResourceExplorer
            topFolder={explorerTopFolder}
            document={projectDocument}
            dirtyGraphIds={dirtyGraphIds}
            onOpenGraph={handleOpenGraphFromExplorer}
          />
        )}
      </div>
      {isGraphTab && (
        <div
          className={`action_dock${dockCollapsed ? ' action_dock--collapsed' : ''}`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="action_dock__button"
            onClick={handleDockCollapseToggle}
            title={dockCollapsed ? t('app.dock.expand') : t('app.dock.collapse')}
          >
            {dockCollapsed ? (
              <img
                src={ICON_DOCK_COLLAPSE}
                alt=""
                aria-hidden="true"
                className="action_dock__icon-img"
              />
            ) : (
              <img
                src={ICON_DOCK_EXPAND}
                alt=""
                aria-hidden="true"
                className="action_dock__icon-img"
              />
            )}
            <span className="sr-only">
              {dockCollapsed ? t('app.dock.expand') : t('app.dock.collapse')}
            </span>
          </button>
          {!dockCollapsed && (
            <div className="action_dock__content">
              <div className="action_dock__separator" aria-hidden="true" />
              <button
                type="button"
                className={`action_dock__button${commentMode === 'selecting' ? ' is-active' : ''}`}
                onClick={handleCommentToggle}
                title={t('app.dock.commentMode')}
              >
                <img
                  src={ICON_DOCK_COMMENT}
                  alt=""
                  aria-hidden="true"
                  className="action_dock__icon-img"
                />
                <span className="sr-only">{t('app.dock.commentMode')}</span>
              </button>
              <div className="action_dock__separator" aria-hidden="true" />
              {shouldShowExecutionInterval && (
                <>
                  <div className="action_dock__interval" title={t('app.dock.executionInterval')}>
                    <img
                      src={ICON_INTERVAL}
                      alt=""
                      aria-hidden="true"
                      className="action_dock__interval-icon"
                    />
                    <input
                      className="action_dock__name action_dock__name--interval"
                      type="text"
                      value={executionIntervalInput}
                      onChange={(event) => handleExecutionIntervalInputChange(event.target.value)}
                      onBlur={commitExecutionInterval}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitExecutionInterval();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          restoreExecutionIntervalInput();
                        }
                      }}
                      placeholder="0.3"
                      aria-label={t('app.dock.executionInterval')}
                      inputMode="decimal"
                      autoComplete="off"
                    />
                    <span className="action_dock__interval-unit">{t('common.seconds')}</span>
                  </div>
                  <div className="action_dock__separator" aria-hidden="true" />
                </>
              )}
              <input
                className="action_dock__name"
                value={graphName}
                onChange={handleGraphNameChange}
                placeholder={t('graph.namePlaceholder')}
              />
              <div className="action_dock__separator" aria-hidden="true" />
              <div className="action_dock__zoom">
                <button
                  type="button"
                  className="action_dock__button action_dock__button--wide"
                  onClick={handleZoomButtonClick}
                  title={t('app.dock.zoomLevel')}
                >
                  {`${displayedZoom}%`}
                </button>
                {zoomMenuOpen && (
                  <div className="action_dock__dropdown" onClick={(event) => event.stopPropagation()}>
                    {ZOOM_LEVELS.map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => handleZoomSelect(value)}
                        className={`action_dock__dropdown-item${displayedZoom === value ? ' is-active' : ''}`}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="action_dock__separator" aria-hidden="true" />
              <button
                type="button"
                className="action_dock__button"
                onClick={undo}
                disabled={!canUndo}
                title={t('common.undo')}
              >
                <img src={ICON_UNDO} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.undo')}</span>
              </button>
              <button
                type="button"
                className="action_dock__button"
                onClick={redo}
                disabled={!canRedo}
                title={t('common.redo')}
              >
                <img src={ICON_REDO} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.redo')}</span>
              </button>
              <div className="action_dock__separator" aria-hidden="true" />
              <button
                type="button"
                className="action_dock__button"
                onClick={handleManualSave}
                title={t('common.save')}
              >
                <img src={ICON_SAVE} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.save')}</span>
              </button>
              <button
                type="button"
                className="action_dock__button"
                onClick={handleSaveGraphAs}
                title={t('common.saveAs')}
              >
                <img src={ICON_SAVEAS} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.saveAs')}</span>
              </button>
              <button
                type="button"
                className="action_dock__button"
                onClick={handleExportCurrentGraph}
                title={t('app.exportGraphJson.action')}
              >
                <img src={ICON_EXPORT} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('app.exportGraphJson.action')}</span>
              </button>
              {editorSettings.enableGiaExport && (
                <button
                  type="button"
                  className="action_dock__button"
                  onClick={handleExportGiaPrototype}
                  title={
                    editorSettings.giaUidMode === 'fixed' && !isGiaFixedUidValid
                      ? t('app.giaExportExperimental.uidRequiredTooltip')
                      : t('app.giaExportExperimental.action')
                  }
                  disabled={!isGiaExportButtonEnabled}
                >
                  <img
                    src={ICON_EXPORT}
                    alt=""
                    aria-hidden="true"
                    className="action_dock__icon-img"
                  />
                  <span className="sr-only">{t('app.giaExportExperimental.action')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {projectInfoDialog && (
        <div
          className="app__modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={handleProjectInfoCancel}
        >
          <form
            className="app__modal"
            role="document"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              handleProjectInfoConfirm();
            }}
          >
            <h3>{t('app.projectInfo.title')}</h3>
            <div className="app__modal-field">
              <label htmlFor="project-info-name">{t('app.projectInfo.nameLabel')}</label>
              <input
                id="project-info-name"
                value={projectInfoDialog.name}
                onChange={(event) => handleProjectInfoNameChange(event.target.value)}
                placeholder={t('app.projectInfo.namePlaceholder')}
              />
            </div>
            {projectInfoDialog.error && (
              <div className="app__modal-error" role="status">
                {projectInfoDialog.error}
              </div>
            )}
            <div className="app__modal-actions">
              <button type="submit">{t('common.save')}</button>
              <button type="button" onClick={handleProjectInfoCancel}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
      {saveAsDialog && (
        <div
          className="app__modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={handleSaveAsCancel}
        >
          <form
            className="app__modal app__modal--save-as"
            role="document"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveAsConfirm();
            }}
          >
            <h3>{t('app.saveAs.title')}</h3>
            <div className="app__modal-field">
              <label>{t('app.saveAs.topFolderLabel')}</label>
              <div className="app__modal-static">{saveAsTopFolderLabel}</div>
            </div>
            <div className="app__modal-field">
              <label htmlFor="save-as-category">{t('common.category')}</label>
              <select
                id="save-as-category"
                value={selectedCategory?.key ?? ''}
                onChange={(event) => handleSaveAsCategoryChange(event.target.value)}
              >
                {saveAsCategories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {t(category.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="app__modal-field">
              <label htmlFor="save-as-folder">{t('common.folder')}</label>
              <select
                id="save-as-folder"
                value={selectedGroup?.groupSlug ?? saveAsDialog.groupSlug}
                onChange={(event) => handleSaveAsGroupChange(event.target.value)}
              >
                {saveAsGroups.map((group) => (
                  <option key={group.groupSlug} value={group.groupSlug}>
                    {group.groupSlug === DEFAULT_GROUP_SLUG && group.groupName === DEFAULT_GROUP_NAME
                      ? t('common.defaultGroupName')
                      : group.groupName}
                  </option>
                ))}
              </select>
            </div>
            <div className="app__modal-field">
              <label htmlFor="save-as-name">{t('graph.nameLabel')}</label>
              <input
                id="save-as-name"
                value={saveAsDialog.name}
                onChange={(event) => handleSaveAsNameChange(event.target.value)}
                placeholder={t('graph.namePlaceholder')}
              />
            </div>
            {saveAsPathPreview && (
              <div className="app__modal-path" aria-live="polite">
                {t('app.saveAs.pathPreview', { path: saveAsPathPreview })}
              </div>
            )}
            {saveAsError && <div className="app__modal-error">{saveAsError}</div>}
            <div className="app__modal-actions">
              <button type="submit">{t('common.save')}</button>
              <button type="button" onClick={handleSaveAsCancel}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
    );
  };

  const renderEffects = () => (
    <EffectsPage version={VERSION_INFO.effects} onBack={handleGoHome} />
  );

  const renderSettings = () => (
    <SettingsPage
      iconBack={ICON_BACK}
      settings={editorSettings}
      onUpdateSettings={updateEditorSettings}
      onClose={handleCloseSettings}
      returnTarget={settingsReturnViewRef.current ?? 'home'}
      isTouchEnvironment={isMobileMode}
    />
  );

  const renderHome = () => (
    <>
      <HomePage
        projects={history}
        duplicateNameCounts={duplicateNameCounts}
        onCreateNew={handleCreateNewProject}
        onImportClick={() => projectFileInputRef.current?.click()}
        onDropFiles={handleProjectFiles}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onSaveAll={handleSaveAll}
        githubUrl={GITHUB_URL}
        onOpenTutorial={handleOpenTutorial}
        onOpenEffects={handleOpenEffects}
        onOpenSettings={handleOpenSettingsFromHome}
        isDecodingGia={isDecodingGia}
        onDecodeGia={handleDecodeGiaFile}
      />
    </>
  );

  const renderTutorial = () => (
    <TutorialPage route={tutorialRoute} onNavigate={handleTutorialNavigate} onClose={handleGoHome} />
  );

  const renderNotFound = () => (
    <div className="app__not-found">
      <h1>404</h1>
      <p>{t('app.notFound.message', { path: notFoundPath ?? '/' })}</p>
      <button type="button" onClick={handleGoHome}>
        {t('common.goHome')}
      </button>
    </div>
  );

  const isScrollableView = view === 'home' || view === 'effects' || view === 'settings';
  const appClassName = [
    'app',
    isScrollableView ? 'app--scrollable' : '',
    editorSettings.pointerStyle === 'system' ? 'app--system-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <I18nProvider
      primaryLanguage={editorSettings.uiPrimaryLanguage}
      secondaryLanguage={editorSettings.uiSecondaryLanguage}
    >
      <div className={appClassName} onClick={() => setOpenMenu(null)}>
      {(view === 'home' || view === 'settings') && (
        <div className="app__version-info">{VERSION_INFO.homepage}</div>
      )}
      {view === 'tutorial' && <div className="app__version-info">{VERSION_INFO.tutorial}</div>}
      {view === 'effects' && <div className="app__version-info">{VERSION_INFO.effects}</div>}
      {view === 'editor' && <div className="app__version-info app__version-info--hidden" />}
      {view === 'editor'
       ? renderEditor()
       : view === 'tutorial'
         ? renderTutorial()
         : view === 'effects'
           ? renderEffects()
           : view === 'settings'
             ? renderSettings()
             : view === 'notFound'
               ? renderNotFound()
               : renderHome()}
      {giaModal && (
        <div className="gia-modal-overlay" role="dialog" aria-modal="true">
          <div className="gia-modal" role="document">
            <div className="gia-modal__header">
              <div className="gia-modal__title">
                <h3>{t('app.giaDecode.modalTitle')}</h3>
                <p>{giaModal.fileName}</p>
              </div>
            </div>
            <div className="gia-modal__body">
              <pre
                className="gia-modal__code"
                dangerouslySetInnerHTML={{ __html: giaModal.highlightedJson }}
              />
            </div>
            <div className="gia-modal__actions">
              <button type="button" onClick={handleDownloadGiaJson}>
                {t('common.downloadJson')}
              </button>
              <button type="button" onClick={closeGiaModal}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {gilDialog && (
        <div
          className="home__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            gilDialog.onCancel?.();
            setGilDialog(null);
          }}
        >
          <div
            className="home__confirm"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{gilDialog.title}</h3>
            <p>{gilDialog.message}</p>
            <div className="home__confirm-actions">
              <button
                type="button"
                className={gilDialog.cancelLabel ? '' : 'is-danger'}
                onClick={() => {
                  gilDialog.onConfirm?.();
                  if (!gilDialog.onConfirm) {
                    setGilDialog(null);
                  }
                }}
              >
                {gilDialog.confirmLabel}
              </button>
              {gilDialog.cancelLabel && (
                <button
                  type="button"
                  onClick={() => {
                    gilDialog.onCancel?.();
                    setGilDialog(null);
                  }}
                >
                  {gilDialog.cancelLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        accept=".zip,application/zip"
        ref={projectFileInputRef}
        onChange={handleProjectFileChange}
        hidden
      />
      {saveToast && <div className="app__save-toast">{saveToast}</div>}
      </div>
    </I18nProvider>
  );
};

export default App;
