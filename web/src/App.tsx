import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import JSZip from 'jszip';
import GraphCanvas from './components/GraphCanvas';
import HomePage from './components/HomePage';
import TutorialPage, { type TutorialRoute } from './components/TutorialPage';
import NodeInspector from './components/NodeInspector';
import NodePalette from './components/NodePalette';
import { useGraphStore } from './state/graphStore';
import { graphDocumentSchema } from './utils/validation';
import type { GraphDocument } from './types/node';
import type { AutoSaveEntry, LayoutState, StoredProject } from './utils/storage';
import {
  AUTOSAVE_LIMIT,
  clearAutoSavesForProject,
  loadAutoSaveMap,
  loadLayoutState,
  loadProjects,
  loadSessionState,
  persistAutoSaveEntry,
  persistLayoutState,
  replaceAutoSavesForProject,
  removeProjectRecord,
  updateSessionState,
  upsertProjectRecord,
} from './utils/storage';
import './App.css';

const AUTO_SAVE_INTERVAL = 30_000;
const AUTO_SAVE_RECOVERY_THRESHOLD = 30_000;
const GITHUB_PLACEHOLDER_URL = 'https://github.com/Columbina-Dev/WebMiliastraNodesEditor';
const APP_BASE_PATH = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const TUTORIAL_BASE_PATH = '/ys/ugc/tutorial';

const ICON_BACK = new URL('./assets/icons/back.png', import.meta.url).href;
const ICON_SAVE = new URL('./assets/icons/save.png', import.meta.url).href;
const ICON_FILE = new URL('./assets/icons/file.png', import.meta.url).href;
const ICON_EXPORT = new URL('./assets/icons/export.png', import.meta.url).href;
const ICON_UNDO = new URL('./assets/icons/undo.png', import.meta.url).href;
const ICON_REDO = new URL('./assets/icons/redo.png', import.meta.url).href;
const ICON_TUTORIAL = new URL('./assets/icons/tutorial.png', import.meta.url).href;

const isMac = () =>
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

const INVALID_FILENAME_CHARS = new Set(["\\","/",":","*","?","\"","<",">","|"]);

const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const safe = Array.from(trimmed)
    .map((char) => (INVALID_FILENAME_CHARS.has(char) ? '_' : char))
    .join('');
  return safe.length ? safe : 'graph';
};

const ensureLeadingSlash = (path: string) => (path.startsWith('/') ? path : '/' + path);

const buildAppPath = (path: string) => {
  const relative = ensureLeadingSlash(path);
  if (!APP_BASE_PATH || APP_BASE_PATH === '/') {
    return relative;
  }
  return APP_BASE_PATH + (relative === '/' ? '' : relative);
};

const stripAppBase = (pathname: string) => {
  const normalized = pathname || '/';
  if (!APP_BASE_PATH || APP_BASE_PATH === '/') {
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }
  if (normalized.startsWith(APP_BASE_PATH)) {
    const rest = normalized.slice(APP_BASE_PATH.length) || '/';
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const isTutorialPath = (path: string) =>
  path === TUTORIAL_BASE_PATH ||
  path.startsWith(`${TUTORIAL_BASE_PATH}/`) ||
  path.startsWith(`${TUTORIAL_BASE_PATH}//`);

const buildTutorialPath = (path: string) => {
  const trimmed = path.replace(/^\/+/, '');
  if (!trimmed) {
    return TUTORIAL_BASE_PATH;
  }
  return `${TUTORIAL_BASE_PATH}/${trimmed}`.replace(/\/{2,}/g, '/');
};

const parseTutorialRouteFromPath = (pathname: string): TutorialRoute => {
  if (!isTutorialPath(pathname)) {
    return { kind: 'landing' };
  }

  const rest = pathname.slice(TUTORIAL_BASE_PATH.length);
  const segments = rest.split('/').filter((segment) => segment.length > 0);

  if (!segments.length) {
    return { kind: 'landing' };
  }

  const first = segments[0];
  let kind: 'knowledge' | 'course' = 'knowledge';
  let remaining = segments;

  if (first === 'knowledge' || first === 'course') {
    kind = first;
    remaining = segments.slice(1);
  } else {
    kind = 'knowledge';
  }

  let entryId: string | null = null;
  if (remaining[0] === 'detail') {
    entryId = remaining[1] ?? null;
  } else if (remaining[0]) {
    entryId = remaining[0];
  }

  return { kind, entryId };
};

type ViewMode = 'home' | 'editor' | 'tutorial' | 'notFound';

type RouteResolution =
  | { view: 'home' }
  | { view: 'tutorial'; tutorialRoute: TutorialRoute }
  | { view: 'notFound'; path: string };

const resolveViewFromPath = (relativePath: string): RouteResolution => {
  const normalized = relativePath.replace(/\/+$/, '') || '/';
  if (normalized === '/') {
    return { view: 'home' };
  }
  if (isTutorialPath(normalized)) {
    return { view: 'tutorial', tutorialRoute: parseTutorialRouteFromPath(normalized) };
  }
  return { view: 'notFound', path: normalized };
};

const fingerprintDocument = (doc: GraphDocument) => {
  const clone = JSON.parse(JSON.stringify({ ...doc, updatedAt: undefined }));
  return JSON.stringify(clone);
};

const readGraphFile = (file: File): Promise<GraphDocument> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const parsed = graphDocumentSchema.parse(raw);
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsText(file);
  });

const App = () => {
  const projectId = useGraphStore((state) => state.projectId);
  const name = useGraphStore((state) => state.name);
  const setName = useGraphStore((state) => state.setName);
  const exportGraph = useGraphStore((state) => state.exportGraph);
  const importGraph = useGraphStore((state) => state.importGraph);
  const resetGraph = useGraphStore((state) => state.reset);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const canUndo = useGraphStore((state) => state.past.length > 0);
  const canRedo = useGraphStore((state) => state.future.length > 0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveToastTimerRef = useRef<number | null>(null);
  const autoSaveFingerprintRef = useRef<string | null>(null);
  const previousProjectIdRef = useRef<string | undefined>(projectId);

  const initialRelativePath =
    typeof window !== 'undefined' ? stripAppBase(window.location.pathname) : '/';
  const initialRouteState = resolveViewFromPath(initialRelativePath);
  const [view, setView] = useState<ViewMode>(() => {
    if (initialRouteState.view === 'tutorial') return 'tutorial';
    if (initialRouteState.view === 'notFound') return 'notFound';
    return 'home';
  });
  const [tutorialRoute, setTutorialRoute] = useState<TutorialRoute>(() =>
    initialRouteState.view === 'tutorial' ? initialRouteState.tutorialRoute : { kind: 'landing' }
  );
  const [notFoundPath, setNotFoundPath] = useState<string | null>(
    initialRouteState.view === 'notFound' ? initialRouteState.path : null
  );
  const skipInitialRecoveryRef = useRef(
    initialRouteState.view === 'tutorial' || initialRouteState.view === 'notFound'
  );
  const [history, setHistory] = useState<StoredProject[]>(() => loadProjects());
  const [panelState, setPanelState] = useState<LayoutState>(() => loadLayoutState());
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const { paletteCollapsed, inspectorCollapsed } = panelState;

  const pushAppHistory = useCallback((path: string, replace = false) => {
    if (typeof window === 'undefined') return;
    const target = buildAppPath(path);
    if (replace) {
      window.history.replaceState({}, '', target);
    } else {
      window.history.pushState({}, '', target);
    }
  }, []);

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
    [pushAppHistory]
  );

  const handleOpenTutorial = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetPath = buildTutorialPath('');
    const targetUrl = new URL(targetPath, window.location.origin).toString();
    window.open(targetUrl, '_blank', 'noopener');
  }, []);

  const togglePalette = () =>
    setPanelState((prev: LayoutState) => {
      const next = { ...prev, paletteCollapsed: !prev.paletteCollapsed };
      persistLayoutState(next);
      return next;
    });

  const toggleInspector = () =>
    setPanelState((prev: LayoutState) => {
      const next = { ...prev, inspectorCollapsed: !prev.inspectorCollapsed };
      persistLayoutState(next);
      return next;
    });

  const bodyStyle = useMemo(
    () =>
      ({
        '--palette-width': paletteCollapsed ? '48px' : '320px',
        '--inspector-width': inspectorCollapsed ? '48px' : '300px',
      }) as CSSProperties,
    [paletteCollapsed, inspectorCollapsed]
  );

  const refreshHistory = () => setHistory(loadProjects());

  const showSaveToast = (message: string) => {
    if (saveToastTimerRef.current) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    setSaveToast(message);
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 2200);
  };

  const switchToEditor = (nextProjectId: string) => {
    setNotFoundPath(null);
    setView('editor');
    updateSessionState(() => ({
      lastActiveProjectId: nextProjectId,
      lastVisitedView: 'editor',
    }));
  };

  const handleManualSave = () => {
    const doc = exportGraph();
    const record: StoredProject = {
      id: doc.metadata?.projectId ? String(doc.metadata.projectId) : projectId,
      name: doc.name,
      savedAt: doc.updatedAt ?? new Date().toISOString(),
      document: doc,
    };
    upsertProjectRecord(record);
    refreshHistory();
    autoSaveFingerprintRef.current = fingerprintDocument(doc);
    showSaveToast('已保存到浏览器本地存储');
  };

  const handleExport = () => {
    const doc = exportGraph();
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitizeFileName(doc.name || 'graph') + '.uinf.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadDocumentIntoEditor = (
    doc: GraphDocument,
    options?: { projectId?: string; recordHistory?: boolean }
  ) => {
    const previousId = useGraphStore.getState().projectId;
    importGraph(doc, options);
    const nextId = useGraphStore.getState().projectId;
    if (previousId && previousId !== nextId) {
      clearAutoSavesForProject(previousId);
    }
    autoSaveFingerprintRef.current = null;
    switchToEditor(nextId);
  };

  const handleImportedDocument = (doc: GraphDocument) => {
    const targetProjectId =
      typeof doc.metadata?.projectId === 'string' ? doc.metadata.projectId : undefined;
    loadDocumentIntoEditor(doc, { projectId: targetProjectId });
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const doc = await readGraphFile(file);
      handleImportedDocument(doc);
    } catch (error) {
      console.error(error);
      window.alert('导入失败，请确认文件内容符合节点图结构规范。');
    } finally {
      event.target.value = '';
    }
  };

  const handleDropFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const candidate = list.find((file) => file.name.toLowerCase().endsWith('.json')) ?? list[0];
    if (!candidate) return;
    try {
      const doc = await readGraphFile(candidate);
      handleImportedDocument(doc);
    } catch (error) {
      console.error(error);
      window.alert('导入失败，请确认文件内容符合节点图结构规范。');
    }
  };

  const handleCreateNew = () => {
    const previousId = useGraphStore.getState().projectId;
    resetGraph();
    const nextId = useGraphStore.getState().projectId;
    if (previousId && previousId !== nextId) {
      clearAutoSavesForProject(previousId);
    }
    autoSaveFingerprintRef.current = null;
    switchToEditor(nextId);
  };

  const navigateHome = useCallback(
    (replace: boolean) => {
      pushAppHistory('/', replace);
      setView('home');
      setTutorialRoute({ kind: 'landing' });
      setNotFoundPath(null);
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'home' }));
    },
    [pushAppHistory]
  );

  const handleGoHome = useCallback(() => navigateHome(false), [navigateHome]);

  const handleOpenProject = (project: StoredProject) => {
    try {
      const doc = graphDocumentSchema.parse(project.document);
      loadDocumentIntoEditor(doc, { projectId: project.id });
    } catch (error) {
      console.error(error);
      window.alert('读取历史项目失败，数据可能已损坏。');
      refreshHistory();
    }
  };

  const handleSaveAll = async () => {
    if (!history.length) return;
    try {
      const zip = new JSZip();
      history.forEach((project) => {
        const filename = sanitizeFileName(project.name || 'graph') + '_' + project.id + '.uinf.json';
        zip.file(filename, JSON.stringify(project.document, null, 2));
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'miliastra-nodes-' + new Date().toISOString().replace(/[:.]/g, '-') + '.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error(error);
      window.alert('导出压缩包时出错，请稍后再试。');
    }
  };

  useEffect(() => {
    const detachables: Array<() => void> = [];
    if (view === 'editor') {
      const handleKeyDown = (event: KeyboardEvent) => {
        const meta = isMac() ? event.metaKey : event.ctrlKey;
        if (!meta) return;
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          handleManualSave();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      detachables.push(() => window.removeEventListener('keydown', handleKeyDown));
    }
    return () => detachables.forEach((detach) => detach());
  }, [redo, undo, view]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const relative = stripAppBase(window.location.pathname);
      const routeState = resolveViewFromPath(relative);

      if (routeState.view === 'tutorial') {
        setTutorialRoute(routeState.tutorialRoute);
        setView('tutorial');
        setNotFoundPath(null);
        updateSessionState((prev) => ({ ...prev, lastVisitedView: 'tutorial' }));
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
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (view !== 'editor') return undefined;
    const tick = () => {
      const state = useGraphStore.getState();
      const currentId = state.projectId;
      if (!currentId) return;
      const doc = state.exportGraph();
      const fingerprint = fingerprintDocument(doc);
      if (autoSaveFingerprintRef.current === fingerprint) {
        return;
      }
      autoSaveFingerprintRef.current = fingerprint;
      const savedAt = doc.updatedAt ?? new Date().toISOString();
      persistAutoSaveEntry(currentId, { savedAt, document: doc }, AUTOSAVE_LIMIT);
      updateSessionState(() => ({
        lastActiveProjectId: currentId,
        lastVisitedView: 'editor',
      }));
    };
    const interval = window.setInterval(tick, AUTO_SAVE_INTERVAL);
    return () => window.clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (previousProjectIdRef.current && previousProjectIdRef.current !== projectId) {
      autoSaveFingerprintRef.current = null;
    }
    previousProjectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
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
        const parsed = graphDocumentSchema.parse(entry.document);
        useGraphStore.getState().importGraph(parsed, {
          projectId: lastProjectId,
          recordHistory: false,
        });
        autoSaveFingerprintRef.current = fingerprintDocument(parsed);
        recovered = true;
        validEntries.push(entry);
        switchToEditor(lastProjectId);
        break;
      } catch (error) {
        console.error('Failed to recover autosave entry', error);
      }
    }

      if (!recovered) {
        navigateHome(true);
      }

    if (validEntries.length !== entries.length) {
      replaceAutoSavesForProject(lastProjectId, validEntries);
    }
  }, []);

  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((project) => {
      const key = project.name || '未命名';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [history]);

  const handleDeleteProject = (projectId: string) => {
    removeProjectRecord(projectId);
    clearAutoSavesForProject(projectId);
    setHistory(loadProjects());
    updateSessionState((prev) => {
      const next = { ...prev };
      if (next.lastActiveProjectId === projectId) {
        delete next.lastActiveProjectId;
      }
      return next;
    });
  };

  const renderEditor = () => (
    <>
      <header className="app__topbar">
        <div className="app__topbar-left">
          <div className="app__history">
            <button type="button" onClick={undo} disabled={!canUndo}>
              <img src={ICON_UNDO} alt="撤销" className="app__button-icon" />
              <span className="sr-only">撤销</span>
            </button>
            <button type="button" onClick={redo} disabled={!canRedo}>
              <img src={ICON_REDO} alt="重做" className="app__button-icon" />
              <span className="sr-only">重做</span>
            </button>
          </div>
          <input
            className="app__name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="节点图名称"
          />
        </div>
        <div className="app__actions">
          <button type="button" onClick={handleGoHome}>
            <img src={ICON_BACK} alt="" aria-hidden="true" className="app__button-icon" />
            <span>主页</span>
          </button>
          <button type="button" onClick={handleManualSave}>
            <img src={ICON_SAVE} alt="" aria-hidden="true" className="app__button-icon" />
            <span>保存</span>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <img src={ICON_FILE} alt="" aria-hidden="true" className="app__button-icon" />
            <span>导入JSON</span>
          </button>
          <button type="button" onClick={handleExport}>
            <img src={ICON_EXPORT} alt="" aria-hidden="true" className="app__button-icon" />
            <span>导出JSON</span>
          </button>
          <button type="button" onClick={handleOpenTutorial}>
            <img src={ICON_TUTORIAL} alt="" aria-hidden="true" className="app__button-icon" />
            <span>教程</span>
          </button>
        </div>
        <input
          type="file"
          accept="application/json"
          ref={fileInputRef}
          onChange={handleImportFileChange}
          hidden
        />
      </header>
      <div className="app__body" style={bodyStyle}>
        <NodePalette collapsed={paletteCollapsed} onToggle={togglePalette} />
        <GraphCanvas />
        <NodeInspector collapsed={inspectorCollapsed} onToggle={toggleInspector} />
      </div>
    </>
  );

  const renderHome = () => (
    <>
      <HomePage
        projects={history}
        duplicateNameCounts={duplicateNameCounts}
        onCreateNew={handleCreateNew}
        onImportClick={() => fileInputRef.current?.click()}
        onDropFiles={handleDropFiles}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onSaveAll={handleSaveAll}
        githubUrl={GITHUB_PLACEHOLDER_URL}
        onOpenTutorial={handleOpenTutorial}
      />
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={handleImportFileChange}
        hidden
      />
    </>
  );

  const renderTutorial = () => (
    <TutorialPage
      route={tutorialRoute}
      onNavigate={handleTutorialNavigate}
      onClose={handleGoHome}
    />
  );

  const renderNotFound = () => (
    <div className="app__not-found">
      <h1>404</h1>
      <p>未找到页面：{notFoundPath ?? '/'}</p>
      <button type="button" onClick={handleGoHome}>
        返回主页
      </button>
    </div>
  );

  return (
    <div className="app">
      <div className="app__version-info">v0.9.53 (节点 OS 6.0.53.38255959 | 指南 v2.3.5_apps-ugc-wiki-sea)</div>
      {view === 'editor'
        ? renderEditor()
        : view === 'tutorial'
          ? renderTutorial()
          : view === 'notFound'
            ? renderNotFound()
            : renderHome()}
      {saveToast && <div className="app__save-toast">{saveToast}</div>}
    </div>
  );
};

export default App;
