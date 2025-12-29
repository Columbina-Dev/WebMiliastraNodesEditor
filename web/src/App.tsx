import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { nanoid } from "nanoid/non-secure";
import JSZip from "jszip";

import GraphCanvas from "./components/GraphCanvas";
import HomePage, { type NetworkProject } from "./components/HomePage";
import ResourceExplorer from "./components/ResourceExplorer";
import StructureManager from "./components/StructureManager";
import TutorialPage, { type TutorialRoute } from "./components/TutorialPage";
import EffectsPage from "./components/EffectsPage";
import NodeInspector from "./components/NodeInspector";
import NodePalette from "./components/NodePalette";
import Avatar from "./components/Avatar";
import SettingsPage from "./components/SettingsPage";
import { useGraphStore } from "./state/graphStore";
import { useProjectStore, type ProjectTab, type TabId } from "./state/projectStore";
import type { GraphComment, GraphDocument, GraphEnvironment } from "./types/node";
import { GRAPH_SCHEMA_VERSION } from "./types/node";
import type { StructDocument } from "./types/struct";
import {
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_SLUG,
  PROJECT_CATEGORIES_BY_TOP,
  type ProjectDocument,
  type ProjectGraphLocation,
  type ProjectTopFolder,
} from "./types/project";
import {
  buildGraphPath,
  createEmptyProjectDocument,
  createProjectId,
  ensureManifestGroups,
  resolveGraphLocation,
  sanitizeName,
  slugifyGroupName,
  upsertManifestGroup,
} from "./utils/project";
import {
  clientKindFromCategoryKey,
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
import { importGiaRoot } from "./lib/gia/importer";
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
import { isLocalizedError, type LocalizedText } from "./utils/localizedText";
import { sanitizeNickname } from "./utils/collaborationProfile";
import { graphDocumentSchema } from "./utils/validation";
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
const ICON_EFFECTS = new URL("./assets/icons/effects.png", import.meta.url).href;
const ICON_PROJECT = new URL("./assets/icons/file.png", import.meta.url).href;
const ICON_SETTING = new URL("./assets/icons/setting.png", import.meta.url).href;
const ICON_RELOAD = new URL("./assets/icons/reload.png", import.meta.url).href;
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
const ICON_SHARE_LOCK = new URL("./assets/icons/lock.png", import.meta.url).href;
const ICON_SHARE_GLOBAL = new URL("./assets/icons/global.png", import.meta.url).href;
const ICON_CHAT = new URL("./assets/icons/chat.png", import.meta.url).href;
const ICON_CURSOR_DEFAULT = new URL("./assets/cursor/Default-60.png", import.meta.url).href;
const ICON_CURSOR_DRAG = new URL("./assets/cursor/Drag-60.png", import.meta.url).href;

const INVALID_FILENAME_CHARS = new Set(["\\", "/", ":", "*", "?", "\"", "<", ">", "|"]);
const MAX_COLLAB_MEMBERS = 6;
const COLLAB_CURSOR_COLORS = [
  '#6AB3FF',
  '#F7B955',
  '#8CE99A',
  '#C77DFF',
  '#FF6B6B',
  '#63E6BE',
] as const;
const COLLAB_SIGNAL_PORT = 5174;
const COLLAB_PUBLIC_DEFAULT_PORT = 51982;
const COLLAB_ROOM_ID_LENGTH = 16;
const COLLAB_CURSOR_SYNC_MS = 34;
const COLLAB_DRAG_SYNC_MS = 80;
const PUBLIC_JOIN_LOOKUP_INTERVAL_MS = 2000;
const COLLAB_CLIENT_ID_KEY = 'miliastra-editor:collab:clientId';
const PUBLIC_SERVER_STORAGE_KEY = 'miliastra-editor:collab:publicServers';
const PUBLIC_SHARE_DEFAULTS_KEY = 'miliastra-editor:collab:publicShareDefaults';
const COLLAB_SIGNAL_RECONNECT_MS = 3000;
const COLLAB_NETWORK_REFRESH_MS = 8000;
const OFFICIAL_HOSTNAMES = new Set(['miliastra.columbina.dev', 'beta.miliastra.columbina.dev']);
const OFFICIAL_SIGNAL_HOST = 'signal.columbina.dev';

type LightweightDialog = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmClassName?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};
type DialogRequest = Omit<LightweightDialog, 'onConfirm' | 'onCancel'>;

type CollaborationAccess = 'restricted' | 'local-open' | 'local-password' | 'link';
type CollaborationPermission = 'viewer' | 'editor';
type CollaborationMode = 'idle' | 'host' | 'client';

type CollaborationMember = {
  id: string;
  nickname: string;
  avatar?: string;
  permission: CollaborationPermission;
  isOwner?: boolean;
  activeTabId?: TabId | null;
};

type CollaborationRequest = {
  id: string;
  clientId: string;
  nickname: string;
  avatar?: string;
  requestedAt: number;
};

type CollaborationCursor = {
  id: string;
  nickname: string;
  x: number;
  y: number;
  color: string;
  avatar?: string;
  cursorImage?: string;
};

type SignalShareEntry = {
  roomId: string;
  hostId: string;
  projectId: string;
  name: string;
  appVersion: string;
  address: string;
  requiresPassword: boolean;
  ownerNickname: string;
  permission?: CollaborationPermission;
  visibility?: 'public' | 'private';
  updatedAt: number;
};

type PublicServerEntry = {
  id: string;
  name: string;
  host: string;
  port?: string;
};

type PublicShareDefaults = {
  server: string;
  port: string;
  apiKey: string;
};

type PublicRoomEntry = {
  roomId: string;
  name: string;
  requiresPassword: boolean;
  permission: CollaborationPermission;
  visibility?: 'public' | 'private';
  appVersion?: string;
};

const arePublicRoomsEqual = (left: PublicRoomEntry, right: PublicRoomEntry) =>
  left.roomId === right.roomId &&
  left.name === right.name &&
  left.requiresPassword === right.requiresPassword &&
  left.permission === right.permission &&
  left.visibility === right.visibility &&
  left.appVersion === right.appVersion;

type PublicJoinTarget = {
  server: PublicServerEntry;
  room: PublicRoomEntry;
  password?: string;
};

type SignalMessage =
  | { type: 'share:list'; shares: SignalShareEntry[] }
  | { type: 'room:list'; rooms: PublicRoomEntry[]; query?: string }
  | { type: 'room:info'; roomId: string; room?: PublicRoomEntry | null }
  | { type: 'room:created'; roomId: string }
  | { type: 'room:error'; reason?: string; message?: string }
  | { type: 'join:request'; roomId: string; clientId: string; nickname: string; avatar?: string; password?: string; requestId?: string }
  | { type: 'join:approved'; roomId: string; hostId: string; permission?: string }
  | { type: 'join:denied'; roomId: string; reason?: string }
  | { type: 'client:message'; roomId: string; clientId: string; payload: unknown }
  | { type: 'room:message'; roomId: string; payload: unknown }
  | { type: 'room:member-left'; roomId: string; clientId: string }
  | { type: 'room:closed'; roomId: string };

type ChatMessage = {
  id: string;
  senderId: string;
  nickname: string;
  avatar?: string;
  content: string;
  createdAt: number;
};

const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const safe = Array.from(trimmed)
    .map((char) => (INVALID_FILENAME_CHARS.has(char) ? "_" : char))
    .join("");
  return safe.length ? safe : "project";
};

const createCollabId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const generateRoomId = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(COLLAB_ROOM_ID_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => (value % 10).toString()).join('');
  }
  let output = '';
  while (output.length < COLLAB_ROOM_ID_LENGTH) {
    output += Math.floor(Math.random() * 10).toString();
  }
  return output.slice(0, COLLAB_ROOM_ID_LENGTH);
};

const stripWsProtocol = (value: string) => value.replace(/^wss?:\/\//i, '');

const parseServerAddress = (address: string, portValue: string) => {
  let host = address.trim();
  let protocolHint: 'ws' | 'wss' | null = null;
  const protocolMatch = /^(wss?):\/\//i.exec(host);
  if (protocolMatch) {
    protocolHint = protocolMatch[1].toLowerCase() as 'ws' | 'wss';
    host = host.slice(protocolMatch[0].length);
  }
  let port = portValue.trim();
  if (!port) {
    const bracketMatch = /^\[(.+)](?::(\d+))?$/.exec(host);
    if (bracketMatch) {
      host = bracketMatch[1];
      if (bracketMatch[2]) {
        port = bracketMatch[2];
      }
    } else {
      const lastColon = host.lastIndexOf(':');
      if (lastColon > 0) {
        const candidatePort = host.slice(lastColon + 1);
        if (/^\d+$/.test(candidatePort)) {
          port = candidatePort;
          host = host.slice(0, lastColon);
        }
      }
    }
  }
  return { host: host.trim(), port, protocolHint };
};

const buildSignalProtocol = (hint: 'ws' | 'wss' | null) => {
  if (hint) return hint;
  if (typeof window === 'undefined') return 'ws';
  return window.location.protocol === 'https:' ? 'wss' : 'ws';
};

const buildPublicSignalUrl = (server: PublicServerEntry) => {
  const parsed = parseServerAddress(server.host, server.port ?? '');
  const protocol = buildSignalProtocol(parsed.protocolHint);
  const host = stripWsProtocol(parsed.host);
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${protocol}://${host}${port}`;
};

const formatServerParam = (server: PublicServerEntry) => {
  const parsed = parseServerAddress(server.host, server.port ?? '');
  const host = stripWsProtocol(parsed.host);
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${host}${port}`;
};

const buildJoinServerParam = (server: PublicServerEntry, socketUrl?: string | null) => {
  if (socketUrl) {
    try {
      const url = new URL(socketUrl);
      const protocol = url.protocol.replace(':', '');
      if (protocol === 'ws' || protocol === 'wss') {
        const host = url.hostname.includes(':') ? `[${url.hostname}]` : url.hostname;
        const port = url.port ? `:${url.port}` : '';
        return `${protocol}://${host}${port}`;
      }
    } catch {
      // fall through
    }
  }
  return formatServerParam(server);
};

const loadPublicServers = (): PublicServerEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PUBLIC_SERVER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.host === 'string')
      .map((item) => ({
        id: String(item.id ?? createCollabId()),
        name: String(item.name ?? 'Collab Server'),
        host: String(item.host ?? ''),
        port: typeof item.port === 'string' ? item.port : '',
      }));
  } catch {
    return [];
  }
};

const loadPublicShareDefaults = (): PublicShareDefaults => {
  if (typeof window === 'undefined') return { server: '', port: '', apiKey: '' };
  try {
    const raw = window.localStorage.getItem(PUBLIC_SHARE_DEFAULTS_KEY);
    if (!raw) return { server: '', port: '', apiKey: '' };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { server: '', port: '', apiKey: '' };
    }
    return {
      server: typeof parsed.server === 'string' ? parsed.server : '',
      port: typeof parsed.port === 'string' ? parsed.port : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
  } catch {
    return { server: '', port: '', apiKey: '' };
  }
};

const persistPublicShareDefaults = (defaults: PublicShareDefaults) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PUBLIC_SHARE_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // ignore storage errors
  }
};

const persistPublicServers = (servers: PublicServerEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PUBLIC_SERVER_STORAGE_KEY, JSON.stringify(servers));
  } catch {
    // ignore storage errors
  }
};

const normalizeCollabPermission = (value?: string): CollaborationPermission =>
  value === 'viewer' ? 'viewer' : 'editor';

const dedupeCollabMembers = (members: CollaborationMember[]) => {
  const map = new Map<string, CollaborationMember>();
  members.forEach((member) => {
    if (!member?.id) return;
    const existing = map.get(member.id);
    map.set(member.id, { ...existing, ...member });
  });
  return Array.from(map.values());
};

const getCollabClientId = () => {
  if (typeof window === 'undefined') {
    return createCollabId();
  }
  const existing = window.localStorage.getItem(COLLAB_CLIENT_ID_KEY);
  if (existing) return existing;
  const created = createCollabId();
  window.localStorage.setItem(COLLAB_CLIENT_ID_KEY, created);
  return created;
};

const buildSignalUrl = () => {
  if (typeof window === 'undefined') return '';
  const explicitUrl = import.meta.env.VITE_COLLAB_SIGNAL_URL;
  if (explicitUrl) return explicitUrl;
  const hostname = window.location.hostname || '127.0.0.1';
  if (OFFICIAL_HOSTNAMES.has(hostname)) {
    return `wss://${OFFICIAL_SIGNAL_HOST}:${COLLAB_PUBLIC_DEFAULT_PORT}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const resolvedHost = import.meta.env.VITE_COLLAB_SIGNAL_HOST || hostname;
  const port = import.meta.env.VITE_COLLAB_SIGNAL_PORT || String(COLLAB_SIGNAL_PORT);
  return `${protocol}://${resolvedHost}:${port}`;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
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
  importedGraph?: GraphDocument | null;
  importWarnings?: LocalizedText[];
  importErrors?: LocalizedText[];
};

type GiaConvertModalState = {
  fileName: string;
  graph: GraphDocument | null;
  warnings: LocalizedText[];
  errors: string[];
  uid: string;
};

type GiaSaveDialogState = {
  graph: GraphDocument;
  name: string;
  topFolder: ProjectTopFolder;
  categoryKey: string;
  groupSlug: string;
  targetProjectId: string;
  newProjectName: string;
};

const ensureLeadingSlash = (path: string) => (path.startsWith("/") ? path : "/" + path);

const getUniqueGraphName = (
  document: ProjectDocument,
  location: ProjectGraphLocation,
  baseName: string,
) => {
  const usedNames = new Set<string>();
  document.manifest.graphs.forEach((entry) => {
    const resolved = resolveGraphLocation(entry.graphId, entry.path, {
      groupNameHint: entry.groupName,
      preferredTopFolder: location.topFolder,
      fallbackCategoryKey: location.categoryKey,
    });
    if (
      resolved.location.topFolder === location.topFolder &&
      resolved.location.categoryKey === location.categoryKey &&
      resolved.location.groupSlug === location.groupSlug
    ) {
      usedNames.add(entry.name);
    }
  });
  let candidate = baseName;
  let index = 2;
  while (usedNames.has(candidate)) {
    candidate = `${baseName}_${index}`;
    index += 1;
  }
  return candidate;
};

const buildAppPath = (path: string) => {
  const relative = ensureLeadingSlash(path);
  if (!APP_BASE_PATH || APP_BASE_PATH === "/") {
    return relative;
  }
  return APP_BASE_PATH + (relative === "/" ? "" : relative);
};

const getJoinBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (OFFICIAL_HOSTNAMES.has(hostname)) {
    return `https://${hostname}`;
  }
  return window.location.origin;
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

const parseJoinRequest = (pathname: string, search: string) => {
  const normalized = pathname.replace(/\/+$/, '');
  if (normalized !== '/join') return null;
  const params = new URLSearchParams(search);
  const server = (params.get('server') ?? '').trim();
  const roomId = (params.get('roomId') ?? '').trim();
  const password = (params.get('pwd') ?? '').trim();
  if (!server || !roomId) return null;
  return {
    server,
    roomId,
    password: password || undefined,
  };
};

const isTabId = (value: string): value is TabId =>
  value === 'structs' || value.startsWith('graph:') || value.startsWith('explorer:');

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
  if (normalized === "/join") {
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
const GIA_SAVE_NEW_PROJECT_ID = "__new__";
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
  const isJoinPath = initialRelativePath.replace(/\/+$/, '') === '/join';
  const initialJoinRequest = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseJoinRequest(initialRelativePath, window.location.search);
  }, [initialRelativePath]);
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
  useEffect(() => {
    if (!initialJoinRequest) return;
    const parsed = parseServerAddress(initialJoinRequest.server, '');
    const server: PublicServerEntry = {
      id: createCollabId(),
      name: initialJoinRequest.server,
      host: parsed.host,
      port: parsed.port || String(COLLAB_PUBLIC_DEFAULT_PORT),
    };
    const room: PublicRoomEntry = {
      roomId: initialJoinRequest.roomId,
      name: initialJoinRequest.roomId,
      requiresPassword: Boolean(initialJoinRequest.password),
      permission: 'editor',
    };
    setPublicJoinTarget({ server, room, password: initialJoinRequest.password });
    setPublicJoinPassword(initialJoinRequest.password ?? '');
    setPublicJoinResolved(false);
  }, [initialJoinRequest]);

  const [tutorialRoute, setTutorialRoute] = useState<TutorialRoute>(() =>
    initialRouteState.view === "tutorial" ? initialRouteState.tutorialRoute : { kind: "landing" },
  );
  const [notFoundPath, setNotFoundPath] = useState<string | null>(
    initialRouteState.view === "notFound" ? initialRouteState.path : null,
  );
  const skipInitialRecoveryRef = useRef(
    Boolean(initialJoinRequest) ||
    isJoinPath ||
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
  const shareTargetName = graphName || projectName || defaultProjectName;
  const shareProjectName =
    projectDocument?.manifest.project.name || projectName || defaultProjectName;
  const fallbackNickname = t('collab.nickname.fallback');
  const localNickname = sanitizeNickname(editorSettings.collabDefaultNickname) || fallbackNickname;
  const localAvatar = editorSettings.collabAvatar || undefined;
  const publicShareDefaults = useMemo(() => loadPublicShareDefaults(), []);
  const [collabMode, setCollabMode] = useState<CollaborationMode>('idle');
  const [collabAccessMode, setCollabAccessMode] = useState<CollaborationAccess>('restricted');
  const [collabPermission, setCollabPermission] = useState<CollaborationPermission>('editor');
  const [collabEditorLimit, setCollabEditorLimit] = useState(0);
  const [collabPassword, setCollabPassword] = useState('');
  const [collabLinkServer, setCollabLinkServer] = useState(publicShareDefaults.server);
  const [collabLinkPort, setCollabLinkPort] = useState(publicShareDefaults.port);
  const [collabLinkApiKey, setCollabLinkApiKey] = useState(publicShareDefaults.apiKey);
  const [collabLinkPassword, setCollabLinkPassword] = useState('');
  const [collabLinkVisibility, setCollabLinkVisibility] = useState<'public' | 'private'>('public');
  const [collabLinkIncludePassword, setCollabLinkIncludePassword] = useState(true);
  const [collabLinkUrl, setCollabLinkUrl] = useState('');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [collabOwnerNickname, setCollabOwnerNickname] = useState('');
  const [collabClientNickname, setCollabClientNickname] = useState('');
  const [collabMembers, setCollabMembers] = useState<CollaborationMember[]>([]);
  const [collabRequests, setCollabRequests] = useState<CollaborationRequest[]>([]);
  const [collabCursors, setCollabCursors] = useState<CollaborationCursor[]>([]);
  const collabMembersRef = useRef<CollaborationMember[]>([]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [collabDisconnectReason, setCollabDisconnectReason] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [lastChatReadAt, setLastChatReadAt] = useState(() => Date.now());
  const [showChatScrollButton, setShowChatScrollButton] = useState(false);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);
  const chatStickToBottomRef = useRef(true);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const clientIdRef = useRef<string>(getCollabClientId());
  const [signalStatus, setSignalStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const signalSocketRef = useRef<WebSocket | null>(null);
  const collabSignalSocketRef = useRef<WebSocket | null>(null);
  const collabSignalKindRef = useRef<'lan' | 'public'>('lan');
  const reconnectTimeoutRef = useRef<number | null>(null);
  const handleSignalMessageRef = useRef<(message: SignalMessage) => void>(() => undefined);
  const handlePublicSignalMessageRef = useRef<(message: SignalMessage) => void>(() => undefined);
  const [signalShares, setSignalShares] = useState<SignalShareEntry[]>([]);
  const pendingNetworkRefreshRef = useRef(false);
  const [publicServers, setPublicServers] = useState<PublicServerEntry[]>(() => loadPublicServers());
  const [publicSignalStatus, setPublicSignalStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'failed'
  >('disconnected');
  const publicSignalSocketRef = useRef<WebSocket | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomEntry[]>([]);
  const [activePublicServer, setActivePublicServer] = useState<PublicServerEntry | null>(null);
  const publicConnectResolverRef = useRef<(() => void) | null>(null);
  const publicConnectRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  const publicConnectPromiseRef = useRef<Promise<PublicServerEntry> | null>(null);
  const pendingPublicRoomCreateRef = useRef<{
    server: PublicServerEntry;
    includePassword: boolean;
    password?: string;
    apiKey?: string;
  } | null>(null);
  const publicJoinRoomIdRef = useRef<string | null>(null);
  const [publicJoinTarget, setPublicJoinTarget] = useState<PublicJoinTarget | null>(null);
  const [publicJoinNickname, setPublicJoinNickname] = useState('');
  const [publicJoinPassword, setPublicJoinPassword] = useState('');
  const [publicJoinRequestCooldown, setPublicJoinRequestCooldown] = useState(0);
  const [publicJoinError, setPublicJoinError] = useState<string | null>(null);
  const [publicJoinResolved, setPublicJoinResolved] = useState(false);
  const publicJoinLookupRef = useRef<{ key: string; lastSentAt: number } | null>(null);
  const [collabRoomId, setCollabRoomId] = useState<string | null>(null);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const collabModeRef = useRef<CollaborationMode>(collabMode);
  const collabRoomIdRef = useRef<string | null>(collabRoomId);
  const pendingJoinRoomIdRef = useRef<string | null>(pendingJoinRoomId);
  const collabPermissionRef = useRef<CollaborationPermission>(collabPermission);
  const collabSyncSuppressedRef = useRef(0);
  const collabProjectFingerprintRef = useRef<string | null>(null);
  const collabSaveInProgressRef = useRef(false);
  const collabSaveQueuedRef = useRef(false);
  const [collabSaving, setCollabSaving] = useState(false);
  const collabClientSavingTimerRef = useRef<number | null>(null);
  const collabLockedNodesRef = useRef<Map<string, Set<string>>>(new Map());
  const collabCursorPendingRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const collabCursorFrameRef = useRef<number | null>(null);
  const collabCursorLastSentRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const collabCursorLastSentAtRef = useRef(0);
  const collabCursorLastKnownRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const localCursorDraggingRef = useRef(false);
  const collabDraggingNodesRef = useRef<Set<string>>(new Set());
  const collabDragPendingDocRef = useRef<ProjectDocument | null>(null);
  const collabDragSyncTimerRef = useRef<number | null>(null);
  const collabProjectRevisionRef = useRef(0);
  const collabLastRevisionBySenderRef = useRef<Map<string, number>>(new Map());
  const [lockedNodeIds, setLockedNodeIds] = useState<string[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const defaultGroupNameLabelRaw = t('common.defaultGroupName');
  const defaultGroupNameLabel = defaultGroupNameLabelRaw.trim() &&
    defaultGroupNameLabelRaw.trim() !== 'structure-manager__group-label'
    ? defaultGroupNameLabelRaw
    : DEFAULT_GROUP_NAME;
  const isSharing = collabMode === 'host';
  const isCollaborating = collabMode !== 'idle';
  const shareReadOnly = collabMode === 'client';
  const ownerNicknameValue = collabOwnerNickname || localNickname;
  const localMemberNickname =
    collabMode === 'host'
      ? ownerNicknameValue
      : collabMode === 'client'
        ? collabClientNickname || localNickname
        : localNickname;
  const localMemberPermission: CollaborationPermission =
    collabMode === 'client' ? collabPermission : 'editor';
  const localMember: CollaborationMember = {
    id: clientIdRef.current,
    nickname: localMemberNickname,
    avatar: localAvatar,
    permission: localMemberPermission,
    isOwner: collabMode === 'host',
    activeTabId: activeTabId ?? null,
  };
  const presenceMembers = useMemo(() => {
    if (!isCollaborating) return [];
    const map = new Map<string, CollaborationMember>();
    map.set(localMember.id, localMember);
    collabMembers.forEach((member) => {
      map.set(member.id, member);
    });
    return Array.from(map.values());
  }, [collabMembers, isCollaborating, localMember]);
  const presenceByTab = useMemo(() => {
    const map = new Map<TabId, CollaborationMember[]>();
    presenceMembers.forEach((member) => {
      if (!member.activeTabId) return;
      const list = map.get(member.activeTabId) ?? [];
      list.push(member);
      map.set(member.activeTabId, list);
    });
    return map;
  }, [presenceMembers]);
  const isViewer = collabMode === 'client' && collabPermission === 'viewer';
  const isProjectMetadataLocked = collabMode === 'client';
  const signalConnected = signalStatus === 'connected';
  const publicSignalConnected = publicSignalStatus === 'connected';
  const sendLanSignalMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);
  const sendPublicSignalMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = publicSignalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);
  const sendCollabSignalMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = collabSignalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }, []);
  const refreshNetworkProjects = useCallback(() => {
    sendLanSignalMessage({
      type: 'hello',
      clientId: clientIdRef.current,
      nickname: localNickname,
      avatar: localAvatar,
    });
  }, [localAvatar, localNickname, sendLanSignalMessage]);
  const leaveCollaboratorSession = useCallback(
    (reasonKey?: string) => {
      if (collabModeRef.current !== 'client') return;
      const roomId = collabRoomIdRef.current;
      if (roomId) {
        sendCollabSignalMessage({
          type: 'room:leave',
          roomId,
          clientId: clientIdRef.current,
        });
      }
      if (reasonKey) {
        setCollabDisconnectReason(reasonKey);
      }
      collabModeRef.current = 'idle';
      collabRoomIdRef.current = null;
      pendingJoinRoomIdRef.current = null;
      setCollabMode('idle');
      setCollabRoomId(null);
      setPendingJoinRoomId(null);
      resetProjectStore();
      resetGraphStore({ graphId: createProjectId() });
      autoSaveFingerprintRef.current = null;
      graphFingerprintRef.current.clear();
      if (typeof window !== 'undefined') {
        window.history.replaceState({ view: 'home' }, '', buildAppPath('/'));
      }
      setTutorialRoute({ kind: 'landing' });
      setNotFoundPath(null);
      setView('home');
      updateSessionState((prev) => ({ ...prev, lastVisitedView: 'home' }));
    },
    [
      resetProjectStore,
      resetGraphStore,
      sendCollabSignalMessage,
      setNotFoundPath,
      setTutorialRoute,
      setView,
      updateSessionState,
    ],
  );
  const endHostSession = useCallback(() => {
    if (collabModeRef.current !== 'host') return false;
    const roomId = collabRoomIdRef.current;
    if (roomId) {
      sendCollabSignalMessage({
        type: 'room:message',
        roomId,
        payload: { type: 'session:end', reason: 'host-left' },
      });
      sendCollabSignalMessage({
        type: 'room:close',
        roomId,
      });
    }
    collabModeRef.current = 'idle';
    collabRoomIdRef.current = null;
    pendingJoinRoomIdRef.current = null;
    setCollabMode('idle');
    setCollabRoomId(null);
    setPendingJoinRoomId(null);
    return true;
  }, [sendCollabSignalMessage]);
  const networkProjects = useMemo<NetworkProject[]>(
    () =>
      signalShares.map((entry) => ({
        id: entry.roomId,
        roomId: entry.roomId,
        hostId: entry.hostId,
        projectId: entry.projectId,
        name: entry.name || defaultProjectName,
        appVersion: entry.appVersion,
        address: entry.address || '127.0.0.1',
        requiresPassword: entry.requiresPassword,
        ownerNickname: entry.ownerNickname,
      })),
    [defaultProjectName, signalShares],
  );
  useEffect(() => {
    if (view !== 'home' || !signalConnected) return;
    refreshNetworkProjects();
    const intervalId = window.setInterval(refreshNetworkProjects, COLLAB_NETWORK_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshNetworkProjects, signalConnected, view]);
  const effectiveEditorLimit =
    collabEditorLimit === 0 ? MAX_COLLAB_MEMBERS : Math.min(MAX_COLLAB_MEMBERS, collabEditorLimit);
  const currentMemberCount = (isSharing ? 1 : 0) + collabMembers.length;
  const isAtCapacity = effectiveEditorLimit > 0 && currentMemberCount >= effectiveEditorLimit;
  const unreadCount = useMemo(
    () =>
      chatMessages.filter(
        (message) => message.senderId !== localMember.id && message.createdAt > lastChatReadAt,
      ).length,
    [chatMessages, lastChatReadAt, localMember.id],
  );
  const displayedCursors = useMemo(
    () =>
      collabCursors
        .filter((cursor) => cursor.id !== clientIdRef.current)
        .map((cursor, index) => ({
          ...cursor,
          color: cursor.color || COLLAB_CURSOR_COLORS[index % COLLAB_CURSOR_COLORS.length],
          cursorImage: cursor.cursorImage || ICON_CURSOR_DEFAULT,
        })),
    [collabCursors],
  );
  const shareLinkValue = useMemo(() => {
    if (!collabLinkUrl) return '';
    const linkPassword = collabLinkPassword.trim();
    if (collabLinkIncludePassword && linkPassword) {
      const separator = collabLinkUrl.includes('?') ? '&' : '?';
      return `${collabLinkUrl}${separator}pwd=${encodeURIComponent(linkPassword)}`;
    }
    return collabLinkUrl;
  }, [collabLinkIncludePassword, collabLinkPassword, collabLinkUrl]);
  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);
  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }
    const temp = window.document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    window.document.body.appendChild(temp);
    temp.select();
    const ok = window.document.execCommand('copy');
    window.document.body.removeChild(temp);
    return ok;
  }, []);
  const handleShareLinkCopy = useCallback(async () => {
    if (!shareLinkValue) return;
    const ok = await copyToClipboard(shareLinkValue);
    if (!ok) return;
    setShareLinkCopied(true);
    if (shareLinkCopyTimerRef.current) {
      window.clearTimeout(shareLinkCopyTimerRef.current);
    }
    shareLinkCopyTimerRef.current = window.setTimeout(() => {
      setShareLinkCopied(false);
      shareLinkCopyTimerRef.current = null;
    }, 1400);
  }, [copyToClipboard, shareLinkValue]);

  const updateChatScrollState = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 8;
    chatStickToBottomRef.current = atBottom;
    setShowChatScrollButton(scrollHeight >= clientHeight * 1.5 && !atBottom);
  }, []);

  const resizeChatInput = useCallback(() => {
    const input = chatInputRef.current;
    if (!input) return;
    const hasMultipleLines = chatDraft.includes('\n');
    input.style.height = '';
    input.style.overflowY = 'hidden';
    if (!hasMultipleLines) {
      return;
    }
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 140);
    input.style.height = `${nextHeight}px`;
    if (input.scrollHeight > nextHeight) {
      input.style.overflowY = 'auto';
    }
  }, [chatDraft]);
  useEffect(() => {
    if (isShareOpen && !collabOwnerNickname) {
      setCollabOwnerNickname(localNickname);
    }
  }, [collabOwnerNickname, isShareOpen, localNickname]);
  useEffect(() => {
    setShareLinkCopied(false);
  }, [isShareOpen, shareLinkValue]);
  useEffect(() => {
    if (!isCollaborating) {
      setIsChatOpen(false);
      return;
    }
    if (isChatOpen) {
      setLastChatReadAt(Date.now());
    }
  }, [isChatOpen, isCollaborating]);
  useEffect(() => {
    if (!isChatOpen) return;
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      if (!chatPanelRef.current) return;
      if (!chatPanelRef.current.contains(event.target as Node)) {
        setIsChatOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isChatOpen]);
  useEffect(() => {
    if (!isChatOpen) return;
    updateChatScrollState();
    const container = chatMessagesRef.current;
    if (!container) return;
    const handleScroll = () => updateChatScrollState();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isChatOpen, updateChatScrollState]);
  useEffect(() => {
    if (!isChatOpen) return;
    resizeChatInput();
  }, [isChatOpen, resizeChatInput]);
  useEffect(() => {
    if (!isChatOpen) return;
    if (chatStickToBottomRef.current) {
      scrollChatToBottom('auto');
    } else {
      updateChatScrollState();
    }
  }, [chatMessages, isChatOpen, scrollChatToBottom, updateChatScrollState]);
  useEffect(() => {
    if (collabMode === 'idle') {
      setCollabMembers([]);
      setCollabRequests([]);
      setCollabCursors([]);
      setShareError(null);
      setChatMessages([]);
      setPendingJoinRoomId(null);
      setCollabRoomId(null);
      setCollabClientNickname('');
      pendingJoinRoomIdRef.current = null;
      collabRoomIdRef.current = null;
      collabLockedNodesRef.current.clear();
      collabSaveInProgressRef.current = false;
      collabSaveQueuedRef.current = false;
      collabProjectRevisionRef.current = 0;
      collabLastRevisionBySenderRef.current.clear();
      if (collabClientSavingTimerRef.current) {
        window.clearTimeout(collabClientSavingTimerRef.current);
        collabClientSavingTimerRef.current = null;
      }
      setLockedNodeIds([]);
      setCollabSaving(false);
      localCursorDraggingRef.current = false;
      collabSignalKindRef.current = 'lan';
      collabSignalSocketRef.current = signalSocketRef.current;
      setCollabLinkUrl('');
      setCollabLinkIncludePassword(true);
      if (collabCursorFrameRef.current) {
        window.cancelAnimationFrame(collabCursorFrameRef.current);
        collabCursorFrameRef.current = null;
      }
      collabCursorPendingRef.current = null;
      collabCursorLastKnownRef.current = null;
      collabDraggingNodesRef.current.clear();
      collabDragPendingDocRef.current = null;
      if (collabDragSyncTimerRef.current) {
        window.clearTimeout(collabDragSyncTimerRef.current);
        collabDragSyncTimerRef.current = null;
      }
    }
  }, [collabMode]);
  useEffect(() => {
    persistPublicServers(publicServers);
  }, [publicServers]);
  useEffect(() => {
    setPublicJoinError(null);
    if (!publicJoinTarget) {
      publicJoinRoomIdRef.current = null;
      setPublicJoinResolved(false);
      return;
    }
    const roomId = publicJoinTarget.room.roomId;
    if (publicJoinRoomIdRef.current === roomId) return;
    publicJoinRoomIdRef.current = roomId;
    setPublicJoinNickname(localNickname);
    setPublicJoinPassword(publicJoinTarget.password ?? '');
  }, [localNickname, publicJoinTarget]);
  useEffect(() => {
    if (!publicJoinTarget) {
      setPublicJoinRequestCooldown(0);
    }
  }, [publicJoinTarget]);
  useEffect(() => {
    if (publicJoinRequestCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setPublicJoinRequestCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [publicJoinRequestCooldown]);
  useEffect(() => {
    if (isChatOpen) {
      setLastChatReadAt(Date.now());
    }
  }, [chatMessages, isChatOpen]);
  useEffect(() => {
    if (!collabSaving) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [collabSaving]);
  useEffect(() => {
    collabModeRef.current = collabMode;
  }, [collabMode]);
  useEffect(() => {
    collabRoomIdRef.current = collabRoomId;
    collabProjectRevisionRef.current = 0;
    collabLastRevisionBySenderRef.current.clear();
  }, [collabRoomId]);
  useEffect(() => {
    pendingJoinRoomIdRef.current = pendingJoinRoomId;
  }, [pendingJoinRoomId]);
  useEffect(() => {
    collabMembersRef.current = collabMembers;
  }, [collabMembers]);
  useEffect(() => {
    collabPermissionRef.current = collabPermission;
  }, [collabPermission]);
  useEffect(() => {
    if (signalConnected) {
      sendLanSignalMessage({
        type: 'profile:update',
        clientId: clientIdRef.current,
        nickname: localNickname,
        avatar: localAvatar,
      });
    }
    if (publicSignalConnected) {
      sendPublicSignalMessage({
        type: 'profile:update',
        clientId: clientIdRef.current,
        nickname: localNickname,
        avatar: localAvatar,
      });
    }
  }, [
    localAvatar,
    localNickname,
    publicSignalConnected,
    sendLanSignalMessage,
    sendPublicSignalMessage,
    signalConnected,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = buildSignalUrl();
    if (!url) return;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setSignalStatus('connecting');
      const socket = new WebSocket(url);
      signalSocketRef.current = socket;

      socket.addEventListener('open', () => {
        setSignalStatus('connected');
        socket.send(
          JSON.stringify({
            type: 'hello',
            clientId: clientIdRef.current,
            nickname: localNickname,
            avatar: localAvatar,
          }),
        );
        if (collabSignalKindRef.current === 'lan') {
          collabSignalSocketRef.current = socket;
        }
      });

      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!message || typeof message.type !== 'string') return;
        handleSignalMessageRef.current(message as SignalMessage);
      });

      socket.addEventListener('close', () => {
        if (signalSocketRef.current === socket) {
          signalSocketRef.current = null;
        }
        if (collabSignalSocketRef.current === socket) {
          collabSignalSocketRef.current = null;
        }
        setSignalStatus('disconnected');
        setSignalShares([]);
        if (collabModeRef.current === 'client') {
          leaveCollaboratorSession('collab.disconnect.owner');
        } else if (collabModeRef.current === 'host') {
          setCollabMode('idle');
          setCollabRoomId(null);
        }
        if (!cancelled) {
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = window.setTimeout(connect, COLLAB_SIGNAL_RECONNECT_MS);
        }
      });

      socket.addEventListener('error', () => {
        socket.close();
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (signalSocketRef.current) {
        signalSocketRef.current.close();
        signalSocketRef.current = null;
      }
    };
  }, []);

  const [history, setHistory] = useState<StoredProject[]>(() => loadProjects());
  const [panelState, setPanelState] = useState<LayoutState>(() => loadLayoutState());
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<'window' | 'file' | null>(null);
  const [gilDialog, setGilDialog] = useState<LightweightDialog | null>(null);
  const [giaModal, setGiaModal] = useState<GiaModalState | null>(null);
  const [isDecodingGia, setIsDecodingGia] = useState(false);
  const [giaConvertModal, setGiaConvertModal] = useState<GiaConvertModalState | null>(null);
  const [isConvertingGia, setIsConvertingGia] = useState(false);
  const [giaSaveDialog, setGiaSaveDialog] = useState<GiaSaveDialogState | null>(null);
  const [giaSaveFolderName, setGiaSaveFolderName] = useState('');
  const [giaSaveError, setGiaSaveError] = useState<string | null>(null);
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
  const openInfoDialog = useCallback(
    (title: string, message: ReactNode, confirmLabel?: string) => {
      setGilDialog({
        title,
        message,
        confirmLabel: confirmLabel ?? t('common.close'),
      });
    },
    [setGilDialog, t],
  );
  const cloneProjectDocument = useCallback((document: ProjectDocument): ProjectDocument => ({
    manifest: {
      ...document.manifest,
      project: { ...document.manifest.project },
      graphs: document.manifest.graphs.map((entry) => ({ ...entry })),
      groups: document.manifest.groups.map((group) => ({ ...group })),
      structGroups: (document.manifest.structGroups ?? []).map((group) => ({ ...group })),
      structures: (document.manifest.structures ?? []).map((entry) => ({ ...entry })),
      manifestVersion: document.manifest.manifestVersion,
      appVersion: document.manifest.appVersion,
    },
    graphs: { ...document.graphs },
    structs: document.structs ? { ...document.structs } : {},
  }), []);
  const generateUniqueGroupInfo = useCallback(
    (
      manifest: ProjectDocument['manifest'],
      topFolder: ProjectTopFolder,
      categoryKey: string,
      requestedName?: string,
    ) => {
      ensureManifestGroups(manifest);
      const candidates = manifest.groups.filter(
        (group) => group.topFolder === topFolder && group.categoryKey === categoryKey,
      );
      const existingNames = new Set(candidates.map((group) => group.groupName));
      const existingSlugs = new Set(candidates.map((group) => group.groupSlug));
      const fallbackName = t('resourceExplorer.defaultFolderName');
      const baseName = sanitizeName(requestedName ?? fallbackName, fallbackName);
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
    },
    [t],
  );
  useEffect(() => {
    if (!collabDisconnectReason) return;
    openInfoDialog(t('common.info'), t(collabDisconnectReason));
    setCollabDisconnectReason(null);
  }, [collabDisconnectReason, openInfoDialog, t]);
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
        confirmClassName: 'is-danger',
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
  const shareLinkCopyTimerRef = useRef<number | null>(null);
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
    if (isViewer) return;
    setExecutionIntervalInput(value);
  }, [isViewer]);

  const restoreExecutionIntervalInput = useCallback(() => {
    if (shouldShowExecutionInterval && typeof executionIntervalSeconds === 'number') {
      setExecutionIntervalInput(formatExecutionInterval(executionIntervalSeconds));
    } else {
      setExecutionIntervalInput('');
    }
  }, [executionIntervalSeconds, shouldShowExecutionInterval]);

  const commitExecutionInterval = useCallback(() => {
    if (isViewer) return;
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
    isViewer,
    restoreExecutionIntervalInput,
    setExecutionIntervalSeconds,
    shouldShowExecutionInterval,
  ]);

  const showSaveToast = useCallback((message: string) => {
    setSaveToast(message);
  }, []);
  useEffect(() => {
    if (!saveToast) return;
    if (saveToastTimerRef.current) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 3000);
    return () => {
      if (saveToastTimerRef.current) {
        window.clearTimeout(saveToastTimerRef.current);
        saveToastTimerRef.current = null;
      }
    };
  }, [saveToast]);
  const handleRefreshNetwork = useCallback(() => {
    pendingNetworkRefreshRef.current = true;
    showSaveToast(t('home.network.refreshingToast'));
    refreshNetworkProjects();
  }, [refreshNetworkProjects, showSaveToast, t]);
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

  const handleZoomButtonClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
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
    if (isViewer) return;
    if (commentMode === "selecting") {
      setCommentMode("inactive");
      setSelectedComment(undefined);
    } else {
      setCommentMode("selecting");
    }
  }, [commentMode, isViewer, setCommentMode, setSelectedComment]);

  const refreshHistory = useCallback(() => {
    setHistory(loadProjects());
  }, []);

  const switchToEditor = useCallback((nextProjectId: string) => {
    setNotFoundPath(null);
    setView('editor');
    updateSessionState((prev) => ({
      lastActiveProjectId:
        collabModeRef.current === 'client' ? prev.lastActiveProjectId : nextProjectId,
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
    if (collabModeRef.current === 'client') {
      leaveCollaboratorSession();
      return;
    }
    if (collabModeRef.current === 'host') {
      endHostSession();
    }
    navigateHome(false);
  }, [endHostSession, leaveCollaboratorSession, navigateHome]);

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
    if (isViewer) {
      return;
    }
    if (!projectDocument || !projectId) {
      openInfoDialog(t('common.info'), t('common.noProjectOpen'));
      return;
    }
    setProjectInfoDialog({
      name: projectDocument.manifest.project.name || projectName || defaultProjectName,
      error: null,
    });
  }, [defaultProjectName, isViewer, openInfoDialog, projectDocument, projectId, projectName, t]);

  const handleProjectInfoNameChange = useCallback(
    (value: string) => {
      if (isViewer || isProjectMetadataLocked) return;
      setProjectInfoDialog((prev) => (prev ? { ...prev, name: value, error: null } : prev));
    },
    [isProjectMetadataLocked, isViewer],
  );

  const handleProjectInfoCancel = useCallback(() => {
    setProjectInfoDialog(null);
  }, []);

  const handleProjectInfoConfirm = useCallback(() => {
    if (!projectInfoDialog) return;
    if (isViewer || isProjectMetadataLocked) {
      setProjectInfoDialog(null);
      return;
    }
    if (!projectDocument || !projectId) {
      openInfoDialog(t('common.info'), t('common.noProjectOpen'));
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
    isProjectMetadataLocked,
    isViewer,
    openInfoDialog,
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
          openInfoDialog(
            t('common.info'),
            <>
              {combinedWarnings.map((warning, index) => (
                <span key={`${index}-${warning}`}>
                  {warning}
                  <br />
                </span>
              ))}
            </>,
          );
        } else {
          showSaveToast(t('app.importProject.successToast'));
        }
      } catch (error) {
        console.error(error);
        openInfoDialog(t('common.error'), t('app.importProject.failedAlert'));
      }
    },
    [
      applyProjectDocument,
      ensureImportVersionSafe,
      openInfoDialog,
      prepareProjectDocument,
      showSaveToast,
      t,
    ],
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

  const checkCollabVersionMismatch = useCallback(
    (incomingVersion?: string) => {
      const currentVersion = VERSION_INFO.editor;
      if (!incomingVersion || !currentVersion) {
        return false;
      }
      if (compareAppVersions(incomingVersion, currentVersion) === 0) {
        return false;
      }
      openInfoDialog(
        t('collab.versionMismatch.title'),
        t('collab.versionMismatch.message', { incomingVersion, currentVersion }),
      );
      return true;
    },
    [openInfoDialog, t],
  );

  const handleJoinNetworkProject = useCallback(
    (project: NetworkProject, nickname: string, password?: string) => {
      if (checkCollabVersionMismatch(project.appVersion)) {
        return;
      }
      const cleanedNickname = sanitizeNickname(nickname) || localNickname;
      setCollabClientNickname(cleanedNickname);
      if (!signalConnected) {
        openInfoDialog(t('common.error'), t('collab.signal.offline'));
        return;
      }
      if (project.requiresPassword && !/^\d{6}$/.test((password ?? '').trim())) {
        openInfoDialog(t('common.error'), t('collab.join.password.invalid'));
        return;
      }
      const roomId = project.roomId ?? project.id;
      setPendingJoinRoomId(roomId);
      pendingJoinRoomIdRef.current = roomId;
      setCollabOwnerNickname(project.ownerNickname ?? cleanedNickname);
      collabSignalSocketRef.current = signalSocketRef.current;
      collabSignalKindRef.current = 'lan';
      sendLanSignalMessage({
        type: 'join:request',
        roomId,
        clientId: clientIdRef.current,
        nickname: cleanedNickname,
        avatar: localAvatar,
        password: password?.trim() || undefined,
        requestId: createCollabId(),
      });
    },
    [
      localAvatar,
      localNickname,
      openInfoDialog,
      sendLanSignalMessage,
      checkCollabVersionMismatch,
      signalConnected,
      t,
    ],
  );

  const handleSendJoinRequest = useCallback(
    (project: NetworkProject, nickname: string) => {
      if (checkCollabVersionMismatch(project.appVersion)) {
        return false;
      }
      const cleanedNickname = sanitizeNickname(nickname) || localNickname;
      setCollabClientNickname(cleanedNickname);
      if (!signalConnected) {
        openInfoDialog(t('common.error'), t('collab.signal.offline'));
        return false;
      }
      const roomId = project.roomId ?? project.id;
      setPendingJoinRoomId(roomId);
      pendingJoinRoomIdRef.current = roomId;
      setCollabOwnerNickname(project.ownerNickname ?? cleanedNickname);
      collabSignalSocketRef.current = signalSocketRef.current;
      collabSignalKindRef.current = 'lan';
      sendLanSignalMessage({
        type: 'join:request',
        roomId,
        clientId: clientIdRef.current,
        nickname: cleanedNickname,
        avatar: localAvatar,
        requestId: createCollabId(),
      });
      return true;
    },
    [
      checkCollabVersionMismatch,
      localAvatar,
      localNickname,
      openInfoDialog,
      sendLanSignalMessage,
      signalConnected,
      t,
    ],
  );

  const connectPublicSignal = useCallback(
    (server: PublicServerEntry) => {
      const parsed = parseServerAddress(server.host, server.port ?? '');
      const normalizedServer: PublicServerEntry = {
        ...server,
        host: parsed.host,
        port: parsed.port || String(COLLAB_PUBLIC_DEFAULT_PORT),
      };
      if (!normalizedServer.host) {
        return Promise.reject(new Error('invalid-host'));
      }
      const isSameServer =
        Boolean(activePublicServer) &&
        activePublicServer?.host === normalizedServer.host &&
        activePublicServer?.port === normalizedServer.port;
      const existingSocket = publicSignalSocketRef.current;
      if (
        publicSignalConnected &&
        existingSocket?.readyState === WebSocket.OPEN &&
        isSameServer
      ) {
        return Promise.resolve(normalizedServer);
      }
      if (publicSignalStatus === 'connecting' && isSameServer && publicConnectPromiseRef.current) {
        return publicConnectPromiseRef.current;
      }
      const connectPromise = new Promise<PublicServerEntry>((resolve, reject) => {
        if (publicSignalSocketRef.current) {
          publicSignalSocketRef.current.close();
          publicSignalSocketRef.current = null;
        }
        setPublicSignalStatus('connecting');
        setActivePublicServer(normalizedServer);
        setPublicRooms([]);
        const url = buildPublicSignalUrl(normalizedServer);
        const socket = new WebSocket(url);
        let didOpen = false;
        publicSignalSocketRef.current = socket;
        publicConnectResolverRef.current = () => {
          resolve(normalizedServer);
          publicConnectResolverRef.current = null;
          publicConnectRejectRef.current = null;
          publicConnectPromiseRef.current = null;
        };
        publicConnectRejectRef.current = (reason) => {
          reject(reason);
          publicConnectResolverRef.current = null;
          publicConnectRejectRef.current = null;
          publicConnectPromiseRef.current = null;
        };

        socket.addEventListener('open', () => {
          didOpen = true;
          setPublicSignalStatus('connected');
          socket.send(
            JSON.stringify({
              type: 'hello',
              clientId: clientIdRef.current,
              nickname: localNickname,
              avatar: localAvatar,
            }),
          );
          if (collabSignalKindRef.current === 'public') {
            collabSignalSocketRef.current = socket;
          }
          if (publicConnectResolverRef.current) {
            publicConnectResolverRef.current();
          }
        });

        socket.addEventListener('message', (event) => {
          let message;
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (!message || typeof message.type !== 'string') return;
          handlePublicSignalMessageRef.current(message as SignalMessage);
        });

        socket.addEventListener('close', () => {
          const isActiveSocket = publicSignalSocketRef.current === socket;
          if (isActiveSocket) {
            publicSignalSocketRef.current = null;
            setPublicSignalStatus(didOpen ? 'disconnected' : 'failed');
            setPublicRooms([]);
            if (collabSignalKindRef.current === 'public' && collabModeRef.current !== 'idle') {
              leaveCollaboratorSession('collab.disconnect.owner');
            }
            if (publicConnectRejectRef.current) {
              publicConnectRejectRef.current(new Error('connection-closed'));
            }
          }
          if (publicConnectPromiseRef.current === connectPromise) {
            publicConnectPromiseRef.current = null;
          }
        });

        socket.addEventListener('error', () => {
          socket.close();
        });
      });
      publicConnectPromiseRef.current = connectPromise;
      return connectPromise;
    },
    [
      activePublicServer,
      localAvatar,
      localNickname,
      leaveCollaboratorSession,
      publicSignalConnected,
      publicSignalStatus,
    ],
  );

  const handleSavePublicServer = useCallback(
    (server: PublicServerEntry, shouldConnect: boolean) => {
      setPublicServers((prev) => {
        const next = prev.filter((item) => item.id !== server.id);
        return [...next, server];
      });
      if (shouldConnect) {
        void connectPublicSignal(server).catch(() => undefined);
      }
    },
    [connectPublicSignal],
  );

  const handleSearchPublicRooms = useCallback(
    async (server: PublicServerEntry, query: string) => {
      try {
        await connectPublicSignal(server);
        sendPublicSignalMessage({
          type: 'room:list',
          query,
          clientId: clientIdRef.current,
        });
        if (query) {
          sendPublicSignalMessage({
            type: 'room:info',
            roomId: query,
          });
        }
      } catch (error) {
        console.error(error);
        setPublicSignalStatus('failed');
      }
    },
    [connectPublicSignal, sendPublicSignalMessage, setPublicSignalStatus],
  );

  const handleRequestPublicJoin = useCallback((server: PublicServerEntry, room: PublicRoomEntry) => {
    setPublicJoinResolved(true);
    setPublicJoinTarget({ server, room });
  }, []);

  const requestPublicJoinRoomInfo = useCallback(
    async (target: PublicJoinTarget) => {
      const roomId = target.room.roomId;
      if (!roomId) return;
      const lookupKey = `${target.server.host}:${target.server.port ?? ''}:${roomId}`;
      const now = Date.now();
      const lastLookup = publicJoinLookupRef.current;
      if (
        lastLookup &&
        lastLookup.key === lookupKey &&
        now - lastLookup.lastSentAt < PUBLIC_JOIN_LOOKUP_INTERVAL_MS
      ) {
        return;
      }
      publicJoinLookupRef.current = { key: lookupKey, lastSentAt: now };
      try {
        await connectPublicSignal(target.server);
        sendPublicSignalMessage({
          type: 'room:list',
          query: roomId,
          clientId: clientIdRef.current,
        });
        sendPublicSignalMessage({
          type: 'room:info',
          roomId,
        });
      } catch (error) {
        console.error(error);
      }
    },
    [connectPublicSignal, sendPublicSignalMessage],
  );

  useEffect(() => {
    if (!publicJoinTarget) {
      publicJoinLookupRef.current = null;
      return;
    }
    if (
      publicJoinTarget.room.name &&
      publicJoinTarget.room.name !== publicJoinTarget.room.roomId
    ) {
      return;
    }
    void requestPublicJoinRoomInfo(publicJoinTarget);
  }, [publicJoinTarget, requestPublicJoinRoomInfo]);

  useEffect(() => {
    if (!publicJoinTarget || publicJoinResolved || publicJoinError) return;
    const intervalId = window.setInterval(() => {
      void requestPublicJoinRoomInfo(publicJoinTarget);
    }, PUBLIC_JOIN_LOOKUP_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [publicJoinError, publicJoinResolved, publicJoinTarget, requestPublicJoinRoomInfo]);

  const handleConfirmPublicJoin = useCallback(async () => {
    if (!publicJoinTarget) return;
    setPublicJoinError(null);
    if (checkCollabVersionMismatch(publicJoinTarget.room.appVersion)) {
      return;
    }
    const cleanedNickname = sanitizeNickname(publicJoinNickname) || localNickname;
    setCollabClientNickname(cleanedNickname);
    const trimmedPassword = publicJoinPassword.trim();
    const hasValidPassword = /^\d{6}$/.test(trimmedPassword);
    if (publicJoinTarget.room.requiresPassword && !hasValidPassword) {
      setPublicJoinError(t('collab.join.password.invalid'));
      return;
    }
    try {
      await connectPublicSignal(publicJoinTarget.server);
    } catch (error) {
      console.error(error);
      setPublicJoinError(t('collab.publicServer.connectFailed'));
      return;
    }
    const roomId = publicJoinTarget.room.roomId;
    collabSignalKindRef.current = 'public';
    collabSignalSocketRef.current = publicSignalSocketRef.current;
    setPendingJoinRoomId(roomId);
    pendingJoinRoomIdRef.current = roomId;
    setCollabOwnerNickname(cleanedNickname);
    const sent = sendPublicSignalMessage({
      type: 'join:request',
      roomId,
      clientId: clientIdRef.current,
      nickname: cleanedNickname,
      avatar: localAvatar,
      password:
        publicJoinTarget.room.requiresPassword && hasValidPassword ? trimmedPassword : undefined,
      requestId: createCollabId(),
    });
    if (!sent) {
      setPublicJoinError(t('collab.publicServer.connectFailed'));
      return;
    }
    setPublicJoinTarget(null);
  }, [
    checkCollabVersionMismatch,
    connectPublicSignal,
    localAvatar,
    localNickname,
    publicJoinNickname,
    publicJoinPassword,
    publicJoinTarget,
    sendPublicSignalMessage,
    setPublicJoinError,
    t,
  ]);

  const handleSendPublicJoinRequest = useCallback(async () => {
    if (!publicJoinTarget) return;
    if (publicJoinRequestCooldown > 0) return;
    setPublicJoinError(null);
    if (checkCollabVersionMismatch(publicJoinTarget.room.appVersion)) {
      return;
    }
    const cleanedNickname = sanitizeNickname(publicJoinNickname) || localNickname;
    setCollabClientNickname(cleanedNickname);
    try {
      await connectPublicSignal(publicJoinTarget.server);
    } catch (error) {
      console.error(error);
      setPublicJoinError(t('collab.publicServer.connectFailed'));
      return;
    }
    const roomId = publicJoinTarget.room.roomId;
    collabSignalKindRef.current = 'public';
    collabSignalSocketRef.current = publicSignalSocketRef.current;
    setPendingJoinRoomId(roomId);
    pendingJoinRoomIdRef.current = roomId;
    setCollabOwnerNickname(cleanedNickname);
    const sent = sendPublicSignalMessage({
      type: 'join:request',
      roomId,
      clientId: clientIdRef.current,
      nickname: cleanedNickname,
      avatar: localAvatar,
      requestId: createCollabId(),
    });
    if (!sent) {
      setPublicJoinError(t('collab.publicServer.connectFailed'));
      return;
    }
    setPublicJoinRequestCooldown(30);
  }, [
    checkCollabVersionMismatch,
    connectPublicSignal,
    localAvatar,
    localNickname,
    publicJoinNickname,
    publicJoinRequestCooldown,
    publicJoinTarget,
    sendPublicSignalMessage,
    setPublicJoinError,
    t,
  ]);

  const handlePublicJoinCancel = useCallback(() => {
    setPublicJoinTarget(null);
    setPublicJoinResolved(false);
    setPublicJoinError(null);
  }, []);

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
      const { graph, warnings, errors } = importGiaRoot(decoded);
      setGiaModal({
        fileName: file.name,
        jsonText: pretty,
        highlightedJson: highlightJsonText(pretty),
        importedGraph: graph,
        importWarnings: warnings,
        importErrors: errors,
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

  const handleDownloadGiaPreviewJson = useCallback(() => {
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

  const handleDownloadGiaGraphJson = useCallback(() => {
    if (!giaModal?.importedGraph || giaModal.importErrors?.length) {
      openInfoDialog(t('common.error'), t('app.giaDecode.importUnavailable'));
      return;
    }
    const graph = giaModal.importedGraph;
    const safeBase = sanitizeFileName(graph.name || giaModal.fileName.replace(/\.gia$/i, '') || 'graph');
    const extension =
      graph.environment && getEnvironmentTopFolder(graph.environment) === 'client'
        ? 'client.json'
        : 'server.json';
    const filename = `${safeBase}.${extension}`;
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const link = window.document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [giaModal, openInfoDialog, t]);

  const handleConvertGiaFile = useCallback(
    async (file: File) => {
      setIsConvertingGia(true);
      try {
        const raw = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          setGiaConvertModal({
            fileName: file.name,
            graph: null,
            warnings: [],
            errors: [t('app.giaConvert.invalidJson')],
            uid: generateGiaUidValue(9),
          });
          return;
        }
        const baseName = sanitizeFileName(file.name.replace(/\.json$/i, '') || 'graph');
        const enriched =
          parsed && typeof parsed === 'object'
            ? {
                ...parsed,
                schemaVersion: (parsed as { schemaVersion?: unknown }).schemaVersion ?? GRAPH_SCHEMA_VERSION,
                name: (parsed as { name?: unknown }).name || baseName,
              }
            : parsed;
        const parsedResult = graphDocumentSchema.safeParse(enriched);
        if (!parsedResult.success) {
          console.error(parsedResult.error);
          setGiaConvertModal({
            fileName: file.name,
            graph: null,
            warnings: [],
            errors: [t('app.giaConvert.invalidGraph')],
            uid: generateGiaUidValue(9),
          });
          return;
        }
        const normalizedEnvironment = parsedResult.data.environment
          ? normalizeGraphEnvironment(parsedResult.data.environment)
          : 'server';
        const normalizedComments: GraphComment[] = [];
        if (Array.isArray(parsedResult.data.comments)) {
          for (const comment of parsedResult.data.comments) {
            const nodeId = (comment.nodeId ?? '').trim();
            const position = comment.position
              ? { x: Number(comment.position.x) || 0, y: Number(comment.position.y) || 0 }
              : undefined;
            if (!nodeId && !position) continue;
            const commentId = comment.id && comment.id.trim().length > 0 ? comment.id : nanoid();
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
        const normalizedGraph: GraphDocument = {
          ...parsedResult.data,
          schemaVersion: GRAPH_SCHEMA_VERSION,
          name: parsedResult.data.name || baseName,
          environment: normalizedEnvironment,
          comments: normalizedComments.length ? normalizedComments : undefined,
        };
        let warnings: LocalizedText[] = [];
        try {
          warnings = exportGiaDocument(normalizedGraph, { uid: generateGiaUidValue(9) }).warnings;
        } catch (error) {
          console.error(error);
          setGiaConvertModal({
            fileName: file.name,
            graph: normalizedGraph,
            warnings: [],
            errors: [t('app.giaConvert.precheckFailed')],
            uid: generateGiaUidValue(9),
          });
          return;
        }
        setGiaConvertModal({
          fileName: file.name,
          graph: normalizedGraph,
          warnings,
          errors: [],
          uid: generateGiaUidValue(9),
        });
      } finally {
        setIsConvertingGia(false);
      }
    },
    [t],
  );

  const handleGiaConvertUidChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 10);
    setGiaConvertModal((prev) => (prev ? { ...prev, uid: sanitized } : prev));
  }, []);

  const handleGiaConvertRandomUid = useCallback(() => {
    setGiaConvertModal((prev) => (prev ? { ...prev, uid: generateGiaUidValue(9) } : prev));
  }, []);

  const handleGiaConvertDownload = useCallback(() => {
    if (!giaConvertModal?.graph) return;
    const uid = giaConvertModal.uid.trim();
    if (!/^\d{9,10}$/.test(uid)) {
      openInfoDialog(t('common.error'), t('app.giaConvert.uidInvalid'));
      return;
    }
    try {
      const result = exportGiaDocument(giaConvertModal.graph, { uid });
      const link = window.document.createElement('a');
      link.href = URL.createObjectURL(result.blob);
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error(error);
      openInfoDialog(t('app.giaExportExperimental.failedTitle'), t('app.giaExportExperimental.failedHint'));
    }
  }, [giaConvertModal, openInfoDialog, t]);

  const handleGiaConvertClose = useCallback(() => {
    setGiaConvertModal(null);
  }, []);

  const handleOpenGiaSaveDialog = useCallback(() => {
    if (!giaModal?.importedGraph || giaModal.importErrors?.length) {
      openInfoDialog(t('common.error'), t('app.giaDecode.importUnavailable'));
      return;
    }
    const graph = giaModal.importedGraph;
    const topFolder = graph.environment ? getEnvironmentTopFolder(graph.environment) : 'server';
    const categoriesForTop = PROJECT_CATEGORIES_BY_TOP[topFolder];
    if (!categoriesForTop.length) {
      openInfoDialog(t('app.saveAs.title'), t('app.saveAs.noCategories'));
      return;
    }
    const defaultCategory = categoriesForTop[0];
    const targetProjectId =
      projectId ?? history[0]?.id ?? GIA_SAVE_NEW_PROJECT_ID;
    setGiaSaveDialog({
      graph,
      name: graph.name || defaultProjectName,
      topFolder,
      categoryKey: defaultCategory?.key ?? '',
      groupSlug: DEFAULT_GROUP_SLUG,
      targetProjectId,
      newProjectName: graph.name || defaultProjectName,
    });
    setGiaSaveFolderName('');
    setGiaSaveError(null);
  }, [defaultProjectName, giaModal, history, openInfoDialog, projectId, t]);

  const handleGiaSaveCancel = useCallback(() => {
    setGiaSaveDialog(null);
    setGiaSaveFolderName('');
    setGiaSaveError(null);
  }, []);

  const handleGiaSaveConfirm = useCallback(() => {
    if (!giaSaveDialog) return;
    const trimmedName = giaSaveDialog.name.trim();
    if (!trimmedName) {
      setGiaSaveError(t('app.saveAs.error.nameRequired'));
      return;
    }
    const categoriesForTop = PROJECT_CATEGORIES_BY_TOP[giaSaveDialog.topFolder];
    const category =
      categoriesForTop.find((item) => item.key === giaSaveDialog.categoryKey) ??
      categoriesForTop[0];
    if (!category) {
      setGiaSaveError(t('app.saveAs.error.categoryMissing'));
      return;
    }
    const isNewProject = giaSaveDialog.targetProjectId === GIA_SAVE_NEW_PROJECT_ID;
    const historyRecord = !isNewProject
      ? history.find((item) => item.id === giaSaveDialog.targetProjectId)
      : null;
    const baseDocument =
      !isNewProject && projectId === giaSaveDialog.targetProjectId && projectDocument
        ? projectDocument
        : historyRecord?.document ?? null;
    if (!isNewProject && !baseDocument) {
      setGiaSaveError(t('app.giaImport.save.projectMissing'));
      return;
    }
    const projectName = isNewProject
      ? sanitizeName(giaSaveDialog.newProjectName, defaultProjectName)
      : baseDocument?.manifest.project.name ?? historyRecord?.name ?? defaultProjectName;
    if (isNewProject && !projectName.trim()) {
      setGiaSaveError(t('app.projectInfo.nameRequired'));
      return;
    }
    const targetProjectId = isNewProject ? createProjectId() : giaSaveDialog.targetProjectId;
    const base =
      isNewProject
        ? createEmptyProjectDocument({
            projectId: targetProjectId,
            appVersion: VERSION_INFO.editor || '',
            name: projectName,
          })
        : cloneProjectDocument(baseDocument!);
    base.manifest.project = {
      ...base.manifest.project,
      id: targetProjectId,
      name: projectName,
    };
    base.manifest.appVersion = VERSION_INFO.editor || base.manifest.appVersion;
    ensureManifestGroups(base.manifest);
    const groupsForCategory = base.manifest.groups.filter(
      (group) =>
        group.topFolder === giaSaveDialog.topFolder && group.categoryKey === category.key,
    );
    let targetGroupSlug = giaSaveDialog.groupSlug;
    let targetGroupName: string | undefined;
    const trimmedFolderName = giaSaveFolderName.trim();
    if (trimmedFolderName) {
      const created = generateUniqueGroupInfo(
        base.manifest,
        giaSaveDialog.topFolder,
        category.key,
        trimmedFolderName,
      );
      upsertManifestGroup(base.manifest, {
        topFolder: giaSaveDialog.topFolder,
        categoryKey: category.key,
        groupSlug: created.groupSlug,
        groupName: created.groupName,
      });
      targetGroupSlug = created.groupSlug;
      targetGroupName = created.groupName;
    } else {
      const existingGroup =
        groupsForCategory.find((group) => group.groupSlug === targetGroupSlug) ??
        groupsForCategory[0];
      if (!existingGroup) {
        setGiaSaveError(t('app.saveAs.error.folderRequired'));
        return;
      }
      targetGroupSlug = existingGroup.groupSlug;
      targetGroupName = existingGroup.groupName;
    }
    const location = {
      topFolder: giaSaveDialog.topFolder,
      categoryKey: category.key,
      categoryDirectory: category.directory,
      groupSlug: targetGroupSlug,
      groupName: targetGroupName ?? DEFAULT_GROUP_NAME,
    };
    const uniqueName = getUniqueGraphName(base, location, trimmedName);
    const environment = resolveEnvironmentFromLocation(location);
    const defaultInterval = getDefaultExecutionInterval(environment);
    const preservedInterval = giaSaveDialog.graph.executionIntervalSeconds;
    const executionIntervalSeconds =
      defaultInterval !== undefined ? preservedInterval ?? defaultInterval : preservedInterval;
    const graphId = createProjectId();
    const timestamp = new Date().toISOString();
    const graphDoc: GraphDocument = {
      ...giaSaveDialog.graph,
      schemaVersion: GRAPH_SCHEMA_VERSION,
      name: uniqueName,
      createdAt: giaSaveDialog.graph.createdAt ?? timestamp,
      updatedAt: timestamp,
      environment,
      executionIntervalSeconds,
    };
    const path = buildGraphPath(location, graphId);
    base.graphs = { ...base.graphs, [graphId]: graphDoc };
    base.manifest.graphs = [
      ...base.manifest.graphs,
      {
        graphId,
        name: uniqueName,
        path,
        groupName: location.groupName,
        createdAt: graphDoc.createdAt,
        updatedAt: graphDoc.updatedAt,
      },
    ];
    const { document: prepared } = prepareProjectDocument(base);
    const savedAt = new Date().toISOString();
    const record: StoredProject = {
      id: prepared.manifest.project.id,
      name: prepared.manifest.project.name,
      savedAt,
      document: prepared,
    };
    upsertProjectRecord(record);
    refreshHistory();
    handleGiaSaveCancel();
    setGiaModal(null);
    applyProjectDocument(prepared, graphId);
    showSaveToast(t('app.giaImport.save.successToast'));
  }, [
    applyProjectDocument,
    cloneProjectDocument,
    defaultProjectName,
    giaSaveDialog,
    giaSaveFolderName,
    generateUniqueGroupInfo,
    handleGiaSaveCancel,
    history,
    projectDocument,
    projectId,
    prepareProjectDocument,
    refreshHistory,
    showSaveToast,
    t,
  ]);

  const giaSaveCategories = useMemo(
    () => (giaSaveDialog ? PROJECT_CATEGORIES_BY_TOP[giaSaveDialog.topFolder] : []),
    [giaSaveDialog],
  );
  const giaSaveSelectedCategory = useMemo(() => {
    if (!giaSaveDialog) return null;
    return (
      giaSaveCategories.find((category) => category.key === giaSaveDialog.categoryKey) ??
      giaSaveCategories[0] ??
      null
    );
  }, [giaSaveCategories, giaSaveDialog]);
  const giaSaveSelectedProjectRecord = useMemo(() => {
    if (!giaSaveDialog || giaSaveDialog.targetProjectId === GIA_SAVE_NEW_PROJECT_ID) {
      return null;
    }
    if (projectId === giaSaveDialog.targetProjectId && projectDocument) {
      const existing = history.find((item) => item.id === projectId);
      return (
        existing ?? {
          id: projectId,
          name: projectDocument.manifest.project.name,
          savedAt: new Date().toISOString(),
          document: projectDocument,
        }
      );
    }
    return history.find((item) => item.id === giaSaveDialog.targetProjectId) ?? null;
  }, [giaSaveDialog, history, projectDocument, projectId]);
  const giaSaveGroups = useMemo(() => {
    if (!giaSaveDialog || !giaSaveSelectedCategory) return [];
    if (!giaSaveSelectedProjectRecord?.document) {
      return [
        {
          topFolder: giaSaveDialog.topFolder,
          categoryKey: giaSaveSelectedCategory.key,
          groupSlug: DEFAULT_GROUP_SLUG,
          groupName: DEFAULT_GROUP_NAME,
        },
      ];
    }
    return giaSaveSelectedProjectRecord.document.manifest.groups
      .filter(
        (group) =>
          group.topFolder === giaSaveDialog.topFolder &&
          group.categoryKey === giaSaveSelectedCategory.key,
      )
      .sort((a, b) => a.groupName.localeCompare(b.groupName, 'zh-CN'));
  }, [giaSaveDialog, giaSaveSelectedCategory, giaSaveSelectedProjectRecord]);
  const giaSaveSelectedGroup = useMemo(() => {
    if (!giaSaveDialog) return null;
    return (
      giaSaveGroups.find((group) => group.groupSlug === giaSaveDialog.groupSlug) ??
      giaSaveGroups[0] ??
      null
    );
  }, [giaSaveDialog, giaSaveGroups]);
  const giaSaveTopFolderLabel = giaSaveDialog
    ? giaSaveDialog.topFolder === 'client'
      ? t('app.saveAs.topFolder.client')
      : t('app.saveAs.topFolder.server')
    : '';
  const giaSavePathPreview =
    giaSaveDialog && giaSaveSelectedCategory && giaSaveSelectedGroup
      ? `/${giaSaveDialog.topFolder}/${giaSaveSelectedCategory.directory}/${giaSaveSelectedGroup.groupSlug}/`
      : giaSaveDialog
        ? `/${giaSaveDialog.topFolder}/`
        : '';

  const closeGiaModal = useCallback(() => {
    setGiaModal(null);
  }, []);

  const performProjectSave = useCallback(() => {
    const store = useProjectStore.getState();
    if (!store.document || !store.projectId) {
      openInfoDialog(t('common.info'), t('common.noProjectOpen'));
      return false;
    }
    const { document: normalized } = normalizeProjectDocument(store.document);
    updateDocument(() => normalized);
    Object.keys(store.dirtyGraphIds).forEach((id) => {
      store.markGraphDirty(id, false);
    });
    Object.keys(store.dirtyStructIds ?? {}).forEach((id) => {
      store.markStructDirty(id, false);
    });
    autoSaveFingerprintRef.current = fingerprintProjectDocument(normalized);
    if (collabModeRef.current === 'client') {
      return true;
    }
    const savedAt = new Date().toISOString();
    const record: StoredProject = {
      id: normalized.manifest.project.id,
      name: normalized.manifest.project.name,
      savedAt,
      document: normalized,
    };
    upsertProjectRecord(record);
    refreshHistory();
    showSaveToast(t('app.save.savedToast'));
    return true;
  }, [openInfoDialog, refreshHistory, showSaveToast, t, updateDocument]);

  const handleManualSave = useCallback(() => {
    const store = useProjectStore.getState();
    const validator = store.structSaveValidator;
    if (validator) {
      return validator();
    }
    return performProjectSave();
  }, [performProjectSave]);

  const exportProjectZip = useCallback(async () => {
    const store = useProjectStore.getState();
    if (!store.document) {
      openInfoDialog(t('common.info'), t('common.noProjectOpen'));
      return false;
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
      return true;
    } catch (error) {
      console.error(error);
      openInfoDialog(t('common.error'), t('app.exportProject.failedAlert'));
      return false;
    }
  }, [openInfoDialog, t]);

  const handleExportProject = useCallback(() => {
    void exportProjectZip();
  }, [exportProjectZip]);

  const handleShareOpen = () => {
    setShareError(null);
    setIsShareOpen(true);
  };

  const handleShareClose = () => {
    setShareError(null);
    setIsShareOpen(false);
  };

  const handleShareConfirm = useCallback(async () => {
    if (shareReadOnly) return;
    setShareError(null);
    const sharingEnabled = collabAccessMode !== 'restricted' && collabEditorLimit !== 1;
    if (!sharingEnabled) {
      if (isSharing) {
        if (collabRoomId) {
          sendCollabSignalMessage({
            type: 'room:message',
            roomId: collabRoomId,
            payload: { type: 'session:end' },
          });
          sendCollabSignalMessage({
            type: 'share:remove',
            roomId: collabRoomId,
            hostId: clientIdRef.current,
          });
        }
        setCollabMode('idle');
        setIsShareOpen(false);
      } else {
        setShareError(t('collab.share.disabled'));
      }
      return;
    }

    if (collabAccessMode === 'local-password' && !/^\d{6}$/.test(collabPassword.trim())) {
      setShareError(t('collab.share.password.invalid'));
      return;
    }

    if (collabAccessMode === 'link') {
      const parsed = parseServerAddress(collabLinkServer, collabLinkPort);
      if (!parsed.host) {
        setShareError(t('collab.share.link.serverRequired'));
        return;
      }
      if (parsed.port && !/^\d+$/.test(parsed.port)) {
        setShareError(t('collab.share.link.portInvalid'));
        return;
      }
      if (collabLinkPassword.trim() && !/^\d{6}$/.test(collabLinkPassword.trim())) {
        setShareError(t('collab.share.password.invalid'));
        return;
      }
    }

    if (!isSharing) {
      const downloaded = await exportProjectZip();
      if (!downloaded) {
        return;
      }
      const saved = performProjectSave();
      if (!saved) {
        setShareError(t('collab.share.saveRequired'));
        return;
      }

      if (collabAccessMode === 'link') {
        const parsed = parseServerAddress(collabLinkServer, collabLinkPort);
        const server: PublicServerEntry = {
          id: createCollabId(),
          name: collabLinkServer || t('collab.publicServer.defaultName'),
          host: parsed.host,
          port: parsed.port || String(COLLAB_PUBLIC_DEFAULT_PORT),
        };
        try {
          collabSignalKindRef.current = 'public';
          await connectPublicSignal(server);
        } catch (error) {
          console.error(error);
          setShareError(t('collab.publicServer.connectFailed'));
          return;
        }
        collabSignalSocketRef.current = publicSignalSocketRef.current;
        pendingPublicRoomCreateRef.current = {
          server,
          includePassword: collabLinkIncludePassword,
          password: collabLinkPassword.trim() || undefined,
          apiKey: collabLinkApiKey.trim() || undefined,
        };
        sendPublicSignalMessage({
          type: 'room:create',
          clientId: clientIdRef.current,
          apiKey: collabLinkApiKey.trim() || undefined,
          name: shareProjectName,
          projectId: projectId ?? '',
          appVersion: VERSION_INFO.editor ?? '',
          requiresPassword: Boolean(collabLinkPassword.trim()),
          password: collabLinkPassword.trim() || undefined,
          permission: collabPermission,
          ownerNickname: ownerNicknameValue,
          visibility: collabLinkVisibility,
        });
        return;
      }

      if (!signalConnected) {
        setShareError(t('collab.signal.offline'));
        return;
      }
      const nextRoomId = generateRoomId();
      collabSignalKindRef.current = 'lan';
      collabSignalSocketRef.current = signalSocketRef.current;
      collabRoomIdRef.current = nextRoomId;
      collabModeRef.current = 'host';
      setCollabRoomId(nextRoomId);
      setCollabMode('host');
    }
  }, [
    collabAccessMode,
    collabEditorLimit,
    collabLinkApiKey,
    collabLinkIncludePassword,
    collabLinkPassword,
    collabLinkPort,
    collabLinkServer,
    collabLinkVisibility,
    collabPassword,
    collabPermission,
    collabRoomId,
    connectPublicSignal,
    exportProjectZip,
    isSharing,
    ownerNicknameValue,
    performProjectSave,
    projectId,
    publicSignalSocketRef,
    sendCollabSignalMessage,
    sendPublicSignalMessage,
    shareProjectName,
    shareReadOnly,
    signalConnected,
    t,
  ]);

  const handleOwnerNicknameChange = (value: string) => {
    setCollabOwnerNickname(sanitizeNickname(value));
  };

  const handleEditorLimitInput = (value: string) => {
    if (shareReadOnly) return;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setCollabEditorLimit(1);
      return;
    }
    const clamped = Math.max(0, Math.min(MAX_COLLAB_MEMBERS, parsed));
    setCollabEditorLimit(clamped);
  };

  const handleCollabPasswordChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    setCollabPassword(sanitized);
  }, []);

  const handleCollabLinkPasswordChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    setCollabLinkPassword(sanitized);
  }, []);

  const handleCollabLinkPortChange = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 5);
    setCollabLinkPort(sanitized);
  }, []);

  const upsertCollabMember = useCallback((member: Partial<CollaborationMember> & { id: string }) => {
    setCollabMembers((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      const existing = map.get(member.id);
      const nickname = member.nickname ?? existing?.nickname;
      const permission = member.permission ?? existing?.permission;
      if (!nickname || !permission) {
        return prev;
      }
      const merged: CollaborationMember = {
        id: member.id,
        nickname,
        permission,
        avatar: member.avatar ?? existing?.avatar,
        isOwner: member.isOwner ?? existing?.isOwner,
        activeTabId: member.activeTabId ?? existing?.activeTabId,
      };
      map.set(member.id, merged);
      const nextMembers = Array.from(map.values());
      collabMembersRef.current = nextMembers;
      return nextMembers;
    });
  }, []);

  const removeCollabMember = useCallback((memberId: string) => {
    setCollabMembers((prev) => {
      const nextMembers = prev.filter((member) => member.id !== memberId);
      collabMembersRef.current = nextMembers;
      return nextMembers;
    });
  }, []);

  const updateCollabCursor = useCallback(
    (cursor: CollaborationCursor & { active?: boolean }) => {
      setCollabCursors((prev) => {
        const next = prev.filter((item) => item.id !== cursor.id);
        if (cursor.active === false) {
          return next;
        }
        const normalized: CollaborationCursor = {
          id: cursor.id,
          nickname: cursor.nickname,
          x: cursor.x,
          y: cursor.y,
          color: cursor.color,
          avatar: cursor.avatar,
          cursorImage: cursor.cursorImage,
        };
        return [...next, normalized];
      });
    },
    [],
  );

  const removeCollabCursor = useCallback((memberId: string) => {
    setCollabCursors((prev) => prev.filter((cursor) => cursor.id !== memberId));
  }, []);

  const pruneCollabCursors = useCallback((memberIds: string[]) => {
    const allowed = new Set(memberIds);
    setCollabCursors((prev) => prev.filter((cursor) => allowed.has(cursor.id)));
  }, []);

  const buildMembersSnapshot = useCallback(() => {
    const owner: CollaborationMember = {
      id: clientIdRef.current,
      nickname: ownerNicknameValue,
      avatar: localAvatar,
      permission: 'editor',
      isOwner: true,
      activeTabId: activeTabId ?? null,
    };
    return [owner, ...collabMembers];
  }, [activeTabId, collabMembers, localAvatar, ownerNicknameValue]);

  const sendRoomMessage = useCallback(
    (payload: Record<string, unknown>, targetId?: string) => {
      if (collabMode !== 'host' || !collabRoomId) return;
      sendCollabSignalMessage({
        type: 'room:message',
        roomId: collabRoomId,
        targetId,
        payload,
      });
    },
    [collabMode, collabRoomId, sendCollabSignalMessage],
  );

  const sendClientMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (collabMode !== 'client' || !collabRoomId) return;
      sendCollabSignalMessage({
        type: 'client:message',
        roomId: collabRoomId,
        payload,
      });
    },
    [collabMode, collabRoomId, sendCollabSignalMessage],
  );

  const broadcastCollabCursor = useCallback(
    (cursor: CollaborationCursor & { active?: boolean }) => {
      const roomId = collabRoomIdRef.current;
      if (!roomId) return;
      const payload = { type: 'cursor:update', cursor };
      if (collabModeRef.current === 'host') {
        sendCollabSignalMessage({ type: 'room:message', roomId, payload });
      } else if (collabModeRef.current === 'client') {
        sendCollabSignalMessage({ type: 'client:message', roomId, payload });
      }
    },
    [sendCollabSignalMessage],
  );

  const queueCollabCursorUpdate = useCallback(
    (payload: { x: number; y: number; active: boolean }) => {
      if (!isCollaborating) return;
      collabCursorLastKnownRef.current = payload;
      collabCursorPendingRef.current = payload;
      if (collabCursorFrameRef.current) return;
      collabCursorFrameRef.current = window.requestAnimationFrame(() => {
        collabCursorFrameRef.current = null;
        const next = collabCursorPendingRef.current;
        if (!next) return;
        const now = performance.now();
        if (now - collabCursorLastSentAtRef.current < COLLAB_CURSOR_SYNC_MS) {
          queueCollabCursorUpdate(next);
          return;
        }
        collabCursorPendingRef.current = null;
        collabCursorLastSentAtRef.current = now;
        collabCursorLastSentRef.current = next;
        const cursor: CollaborationCursor & { active?: boolean } = {
          id: clientIdRef.current,
          nickname: localMemberNickname,
          avatar: localAvatar,
          x: next.x,
          y: next.y,
          color: '',
          cursorImage: localCursorDraggingRef.current ? ICON_CURSOR_DRAG : undefined,
          active: next.active,
        };
        updateCollabCursor(cursor);
        broadcastCollabCursor(cursor);
      });
    },
    [
      broadcastCollabCursor,
      isCollaborating,
      localAvatar,
      localMemberNickname,
      updateCollabCursor,
    ],
  );

  const queueClientSavingIndicator = useCallback(() => {
    if (collabClientSavingTimerRef.current) {
      window.clearTimeout(collabClientSavingTimerRef.current);
      collabClientSavingTimerRef.current = null;
    }
    setCollabSaving(true);
    collabClientSavingTimerRef.current = window.setTimeout(() => {
      setCollabSaving(false);
      collabClientSavingTimerRef.current = null;
    }, 600);
  }, []);

  const getNextProjectRevision = useCallback(() => {
    collabProjectRevisionRef.current += 1;
    return collabProjectRevisionRef.current;
  }, []);

  const shouldApplyProjectRevision = useCallback((sourceId: string | null, revision: number | null) => {
    if (!sourceId || revision == null || !Number.isFinite(revision)) {
      return true;
    }
    const lastSeen = collabLastRevisionBySenderRef.current.get(sourceId);
    if (lastSeen != null && revision <= lastSeen) {
      return false;
    }
    collabLastRevisionBySenderRef.current.set(sourceId, revision);
    return true;
  }, []);

  const sendProjectUpdate = useCallback(
    (document: ProjectDocument, sourceId: string = clientIdRef.current) => {
      const roomId = collabRoomIdRef.current;
      if (!roomId) return;
      const payload = { type: 'project:update', document, sourceId, revision: getNextProjectRevision() };
      if (collabModeRef.current === 'host') {
        sendCollabSignalMessage({
          type: 'room:message',
          roomId,
          payload,
        });
      } else if (collabModeRef.current === 'client') {
        sendCollabSignalMessage({
          type: 'client:message',
          roomId,
          payload,
        });
      }
    },
    [getNextProjectRevision, sendCollabSignalMessage],
  );

  const scheduleCollabDragSync = useCallback(
    (document: ProjectDocument) => {
      collabDragPendingDocRef.current = document;
      if (collabDragSyncTimerRef.current) return;
      collabDragSyncTimerRef.current = window.setTimeout(() => {
        collabDragSyncTimerRef.current = null;
        const pending = collabDragPendingDocRef.current;
        if (!pending) return;
        collabDragPendingDocRef.current = null;
        sendProjectUpdate(pending);
      }, COLLAB_DRAG_SYNC_MS);
    },
    [sendProjectUpdate],
  );

  const flushCollabDragSync = useCallback(() => {
    if (collabDragSyncTimerRef.current) {
      window.clearTimeout(collabDragSyncTimerRef.current);
      collabDragSyncTimerRef.current = null;
    }
    const pending = collabDragPendingDocRef.current;
    collabDragPendingDocRef.current = null;
    if (pending) {
      sendProjectUpdate(pending);
    }
  }, [sendProjectUpdate]);

  const runWithCollabSyncSuppressed = useCallback((action: () => void) => {
    collabSyncSuppressedRef.current += 1;
    try {
      action();
    } finally {
      collabSyncSuppressedRef.current = Math.max(0, collabSyncSuppressedRef.current - 1);
    }
  }, []);

  const refreshLockedNodeIds = useCallback(() => {
    const merged = new Set<string>();
    collabLockedNodesRef.current.forEach((nodeSet, ownerId) => {
      if (ownerId === clientIdRef.current) return;
      nodeSet.forEach((nodeId) => merged.add(nodeId));
    });
    setLockedNodeIds(Array.from(merged));
  }, []);

  const updateLockedNodes = useCallback(
    (sourceId: string, nodeIds: string[], isDragging: boolean) => {
      if (!sourceId || sourceId === clientIdRef.current) return;
      const map = collabLockedNodesRef.current;
      const existing = map.get(sourceId) ?? new Set<string>();
      let changed = false;
      nodeIds.forEach((nodeId) => {
        if (isDragging) {
          if (!existing.has(nodeId)) {
            existing.add(nodeId);
            changed = true;
          }
        } else if (existing.delete(nodeId)) {
          changed = true;
        }
      });
      if (existing.size > 0) {
        map.set(sourceId, existing);
      } else {
        map.delete(sourceId);
      }
      if (changed) {
        refreshLockedNodeIds();
      }
    },
    [refreshLockedNodeIds],
  );

  const pruneLockedNodes = useCallback(
    (validIds: string[]) => {
      const validSet = new Set(validIds);
      let changed = false;
      collabLockedNodesRef.current.forEach((_value, ownerId) => {
        if (!validSet.has(ownerId)) {
          collabLockedNodesRef.current.delete(ownerId);
          changed = true;
        }
      });
      if (changed) {
        refreshLockedNodeIds();
      }
    },
    [refreshLockedNodeIds],
  );

  const applyRemoteProjectUpdate = useCallback(
    (document: ProjectDocument) => {
      const { document: normalized } = normalizeProjectDocument(document);
      runWithCollabSyncSuppressed(() => {
        updateDocument(() => normalized);
      });
    },
    [runWithCollabSyncSuppressed, updateDocument],
  );

  const handleNodeDragStateChange = useCallback(
    (nodeIds: string[], isDragging: boolean) => {
      if (nodeIds.length) {
        const draggingNodes = collabDraggingNodesRef.current;
        if (isDragging) {
          nodeIds.forEach((nodeId) => draggingNodes.add(nodeId));
        } else {
          nodeIds.forEach((nodeId) => draggingNodes.delete(nodeId));
          if (draggingNodes.size === 0) {
            flushCollabDragSync();
          }
        }
      }
      const roomId = collabRoomIdRef.current;
      if (!roomId || !nodeIds.length) return;
      localCursorDraggingRef.current = isDragging;
      const lastCursor = collabCursorLastKnownRef.current ?? collabCursorLastSentRef.current;
      if (lastCursor) {
        queueCollabCursorUpdate({
          ...lastCursor,
          active: isDragging ? true : lastCursor.active,
        });
      }
      const uniqueIds = Array.from(new Set(nodeIds));
      if (!uniqueIds.length) return;
      const payload = {
        type: isDragging ? 'nodes:lock' : 'nodes:unlock',
        nodeIds: uniqueIds,
      };
      if (collabModeRef.current === 'host') {
        sendCollabSignalMessage({
          type: 'room:message',
          roomId,
          payload: { ...payload, ownerId: clientIdRef.current },
        });
      } else if (collabModeRef.current === 'client') {
        sendCollabSignalMessage({
          type: 'client:message',
          roomId,
          payload,
        });
      }
    },
    [flushCollabDragSync, queueCollabCursorUpdate, sendCollabSignalMessage],
  );

  const performCollabAutoSave = useCallback(() => {
    const store = useProjectStore.getState();
    if (!store.document || !store.projectId) {
      return;
    }
    const { document: normalized } = normalizeProjectDocument(store.document);
    runWithCollabSyncSuppressed(() => {
      updateDocument(() => normalized);
    });
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
  }, [refreshHistory, runWithCollabSyncSuppressed, updateDocument]);

  const queueCollabAutoSave = useCallback(() => {
    if (collabSaveInProgressRef.current) {
      collabSaveQueuedRef.current = true;
      return;
    }
    collabSaveInProgressRef.current = true;
    collabSaveQueuedRef.current = false;
    setCollabSaving(true);
    window.setTimeout(() => {
      try {
        performCollabAutoSave();
      } finally {
        collabSaveInProgressRef.current = false;
        setCollabSaving(false);
        if (collabSaveQueuedRef.current) {
          collabSaveQueuedRef.current = false;
          queueCollabAutoSave();
        }
      }
    }, 0);
  }, [performCollabAutoSave]);


  const approveJoin = useCallback(
    (clientId: string, nickname: string, avatar?: string) => {
      if (collabMode !== 'host' || !collabRoomId) return;
      setCollabRequests((prev) => prev.filter((item) => item.clientId !== clientId));
      const member: CollaborationMember = {
        id: clientId,
        nickname,
        avatar,
        permission: collabPermission,
      };
      const nextMembers = dedupeCollabMembers([
        ...collabMembers.filter((item) => item.id !== clientId),
        member,
      ]);
      upsertCollabMember(member);
      sendCollabSignalMessage({
        type: 'join:approve',
        roomId: collabRoomId,
        clientId,
        permission: collabPermission,
      });
      if (projectDocument) {
        sendRoomMessage(
          {
            type: 'session:init',
            ownerId: clientIdRef.current,
            ownerNickname: ownerNicknameValue,
            permission: collabPermission,
            members: [buildMembersSnapshot()[0], ...nextMembers],
            project: projectDocument,
          },
          clientId,
        );
      }
      sendRoomMessage({
        type: 'members:update',
        members: [buildMembersSnapshot()[0], ...nextMembers],
      });
    },
    [
      buildMembersSnapshot,
      collabMembers,
      collabMode,
      collabPermission,
      collabRoomId,
      ownerNicknameValue,
      projectDocument,
      sendRoomMessage,
      sendCollabSignalMessage,
      setCollabRequests,
      upsertCollabMember,
    ],
  );

  const handleApproveRequest = (requestId: string) => {
    if (shareReadOnly || !isSharing || !collabRoomId) return;
    setShareError(null);
    if (isAtCapacity) {
      setShareError(t('collab.share.limitReached'));
      return;
    }
    const request = collabRequests.find((item) => item.id === requestId);
    if (!request) return;
    approveJoin(request.clientId, request.nickname, request.avatar);
    setCollabRequests((prev) => prev.filter((item) => item.clientId !== request.clientId));
  };

  const handleIgnoreRequest = (requestId: string) => {
    if (shareReadOnly || !collabRoomId) return;
    const request = collabRequests.find((item) => item.id === requestId);
    if (request) {
      sendCollabSignalMessage({
        type: 'join:deny',
        roomId: collabRoomId,
        clientId: request.clientId,
        reason: 'ignored',
      });
    }
    setCollabRequests((prev) => prev.filter((item) => item.clientId !== request?.clientId));
  };

  const handleRemoveMember = (memberId: string) => {
    if (shareReadOnly || collabMode !== 'host' || !collabRoomId) return;
    const nextMembers = collabMembers.filter((member) => member.id !== memberId);
    removeCollabMember(memberId);
    removeCollabCursor(memberId);
    pruneLockedNodes([clientIdRef.current, ...nextMembers.map((member) => member.id)]);
    sendRoomMessage({ type: 'session:end', reason: 'removed' }, memberId);
    sendRoomMessage({
      type: 'members:update',
      members: [buildMembersSnapshot()[0], ...nextMembers],
    });
  };

  const submitChatMessage = useCallback(() => {
    if (!isCollaborating) return;
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    const message: ChatMessage = {
      id: createCollabId(),
      senderId: localMember.id,
      nickname: localMember.nickname,
      avatar: localMember.avatar,
      content: trimmed,
      createdAt: Date.now(),
    };
    setChatMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
    if (collabMode === 'host') {
      sendRoomMessage({ type: 'chat:message', message });
    } else {
      sendClientMessage({ type: 'chat:send', message });
    }
    setChatDraft('');
    window.requestAnimationFrame(() => scrollChatToBottom());
  }, [chatDraft, isCollaborating, localMember, scrollChatToBottom, sendClientMessage, sendRoomMessage, collabMode]);

  const handleChatSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitChatMessage();
  };

  const handleChatDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      submitChatMessage();
    },
    [submitChatMessage],
  );

  useEffect(() => {
    if (!signalConnected || !collabRoomId) return;
    if (collabSignalKindRef.current !== 'lan') return;
    if (
      isSharing &&
      (collabAccessMode === 'local-open' || collabAccessMode === 'local-password') &&
      collabEditorLimit !== 1
    ) {
      sendLanSignalMessage({
        type: 'share:announce',
        roomId: collabRoomId,
        hostId: clientIdRef.current,
        projectId: projectId ?? '',
        name: shareProjectName,
        appVersion: VERSION_INFO.editor ?? '',
        requiresPassword: collabAccessMode === 'local-password',
        ownerNickname: ownerNicknameValue,
        permission: collabPermission,
        visibility: 'public',
      });
    } else if (isSharing) {
      sendLanSignalMessage({
        type: 'share:remove',
        roomId: collabRoomId,
        hostId: clientIdRef.current,
      });
    }
  }, [
    collabAccessMode,
    collabEditorLimit,
    collabRoomId,
    isSharing,
    ownerNicknameValue,
    projectId,
    sendLanSignalMessage,
    shareProjectName,
    signalConnected,
    collabPermission,
  ]);

  useEffect(() => {
    if (!isSharing || !collabRoomId) return;
    sendRoomMessage({
      type: 'members:update',
      members: buildMembersSnapshot(),
    });
  }, [activeTabId, buildMembersSnapshot, collabMembers, collabRoomId, isSharing, sendRoomMessage]);

  useEffect(() => {
    if (!isSharing) return;
    const validIds = [clientIdRef.current, ...collabMembers.map((member) => member.id)];
    pruneLockedNodes(validIds);
  }, [collabMembers, isSharing, pruneLockedNodes]);

  useEffect(() => {
    if (collabMode !== 'client' || !collabRoomId) return;
    sendClientMessage({
      type: 'presence:update',
      activeTabId: activeTabId ?? null,
    });
  }, [activeTabId, collabMode, collabRoomId, sendClientMessage]);

  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (!state.document) return;
      if (collabModeRef.current === 'idle') return;
      const fingerprint = fingerprintProjectDocument(state.document);
      if (collabProjectFingerprintRef.current === fingerprint) return;
      collabProjectFingerprintRef.current = fingerprint;
      if (collabModeRef.current === 'host') {
        queueCollabAutoSave();
      }
      if (collabSyncSuppressedRef.current > 0) return;
      if (collabModeRef.current === 'client') {
        if (collabPermissionRef.current === 'viewer') return;
        queueClientSavingIndicator();
      }
      if (collabDraggingNodesRef.current.size > 0) {
        scheduleCollabDragSync(state.document);
        return;
      }
      sendProjectUpdate(state.document);
    });
    return unsubscribe;
  }, [queueClientSavingIndicator, queueCollabAutoSave, scheduleCollabDragSync, sendProjectUpdate]);

  const handleSignalMessage = useCallback(
    (message: SignalMessage) => {
      switch (message.type) {
        case 'share:list': {
          setSignalShares(Array.isArray(message.shares) ? message.shares : []);
          if (pendingNetworkRefreshRef.current) {
            pendingNetworkRefreshRef.current = false;
            showSaveToast(t('home.network.refreshedToast'));
          }
          return;
        }
        case 'join:request': {
          if (collabModeRef.current !== 'host') return;
          if (!collabRoomIdRef.current || message.roomId !== collabRoomIdRef.current) return;
          if (collabAccessMode === 'restricted' || collabEditorLimit === 1) {
            sendCollabSignalMessage({
              type: 'join:deny',
              roomId: message.roomId,
              clientId: message.clientId,
              reason: 'restricted',
            });
            return;
          }
          if (isAtCapacity) {
            sendCollabSignalMessage({
              type: 'join:deny',
              roomId: message.roomId,
              clientId: message.clientId,
              reason: 'limit',
            });
            return;
          }
          const cleanedNickname = sanitizeNickname(message.nickname || '') || localNickname;
          const requestId = message.requestId || createCollabId();
          const request: CollaborationRequest = {
            id: requestId,
            clientId: message.clientId,
            nickname: cleanedNickname,
            avatar: message.avatar,
            requestedAt: Date.now(),
          };
          if (collabAccessMode === 'local-password') {
            const provided = (message.password ?? '').trim();
            if (provided) {
              if (provided === collabPassword) {
                approveJoin(message.clientId, cleanedNickname, message.avatar);
              } else {
                sendCollabSignalMessage({
                  type: 'join:deny',
                  roomId: message.roomId,
                  clientId: message.clientId,
                  reason: 'password',
                });
              }
            } else {
              setCollabRequests((prev) => {
                if (prev.some((item) => item.clientId === message.clientId)) {
                  return prev;
                }
                return [...prev, request];
              });
            }
            return;
          }
          if (collabAccessMode === 'link') {
            const provided = (message.password ?? '').trim();
            const required = collabLinkPassword.trim();
            if (!required) {
              approveJoin(message.clientId, cleanedNickname, message.avatar);
            } else if (!provided) {
              setCollabRequests((prev) => {
                if (prev.some((item) => item.clientId === message.clientId)) {
                  return prev;
                }
                return [...prev, request];
              });
            } else if (provided === required) {
              approveJoin(message.clientId, cleanedNickname, message.avatar);
            } else {
              sendCollabSignalMessage({
                type: 'join:deny',
                roomId: message.roomId,
                clientId: message.clientId,
                reason: 'password',
              });
            }
            return;
          }
          approveJoin(message.clientId, cleanedNickname, message.avatar);
          return;
        }
        case 'join:approved': {
          if (pendingJoinRoomId && message.roomId !== pendingJoinRoomId) return;
          setPendingJoinRoomId(null);
          pendingJoinRoomIdRef.current = null;
          setCollabRoomId(message.roomId);
          collabRoomIdRef.current = message.roomId;
          setCollabPermission(normalizeCollabPermission(message.permission));
          setCollabMode('client');
          collabModeRef.current = 'client';
          return;
        }
        case 'join:denied': {
          if (pendingJoinRoomId && message.roomId === pendingJoinRoomId) {
            setPendingJoinRoomId(null);
            pendingJoinRoomIdRef.current = null;
          }
          const reasonKey =
            message.reason === 'password'
              ? 'collab.join.password.invalid'
              : 'collab.join.denied';
          openInfoDialog(t('common.error'), t(reasonKey));
          return;
        }
        case 'client:message': {
          if (collabModeRef.current !== 'host') return;
          if (!collabRoomIdRef.current || message.roomId !== collabRoomIdRef.current) return;
          const payload = message.payload as { type?: string; [key: string]: unknown } | null;
          if (!payload || typeof payload.type !== 'string') return;
          const isKnownMember = collabMembersRef.current.some((member) => member.id === message.clientId);
          if (!isKnownMember) {
            sendRoomMessage({ type: 'session:end', reason: 'not-member' }, message.clientId);
            return;
          }
          if (payload.type === 'project:update') {
            if (collabPermissionRef.current === 'viewer') return;
            const incoming = payload.document as ProjectDocument | undefined;
            if (!incoming) return;
            const revision = typeof payload.revision === 'number' ? payload.revision : null;
            if (!shouldApplyProjectRevision(message.clientId, revision)) return;
            applyRemoteProjectUpdate(incoming);
            sendRoomMessage({
              type: 'project:update',
              document: incoming,
              sourceId: message.clientId,
              ...(revision == null ? {} : { revision }),
            });
            return;
          }
          if (payload.type === 'nodes:lock' || payload.type === 'nodes:unlock') {
            const nodeIds = Array.isArray(payload.nodeIds)
              ? payload.nodeIds.filter((item) => typeof item === 'string')
              : [];
            if (!nodeIds.length) return;
            const isDragging = payload.type === 'nodes:lock';
            updateLockedNodes(message.clientId, nodeIds, isDragging);
            sendRoomMessage({
              type: payload.type,
              nodeIds,
              ownerId: message.clientId,
            });
            return;
          }
          if (payload.type === 'chat:send') {
            const incoming = payload.message as ChatMessage | undefined;
            if (!incoming) return;
            const sender = collabMembersRef.current.find((item) => item.id === message.clientId);
            const chatMessage: ChatMessage = {
              ...incoming,
              senderId: message.clientId,
              nickname: sender?.nickname ?? incoming.nickname,
              avatar: sender?.avatar ?? incoming.avatar,
              createdAt: incoming.createdAt ?? Date.now(),
            };
            setChatMessages((prev) => {
              if (prev.some((item) => item.id === chatMessage.id)) return prev;
              return [...prev, chatMessage];
            });
            sendRoomMessage({ type: 'chat:message', message: chatMessage });
            return;
          }
          if (payload.type === 'cursor:update') {
            const cursorPayload = payload.cursor as Partial<CollaborationCursor> & {
              id?: string;
              active?: boolean;
            };
            const cursorId = cursorPayload.id || message.clientId;
            if (!cursorId) return;
            const member = collabMembersRef.current.find((item) => item.id === cursorId);
            const nickname =
              member?.nickname ??
              (typeof cursorPayload.nickname === 'string' ? cursorPayload.nickname : localNickname);
            const x = Number(cursorPayload.x);
            const y = Number(cursorPayload.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const active = cursorPayload.active !== false;
            const cursor: CollaborationCursor & { active?: boolean } = {
              id: cursorId,
              nickname,
              avatar: member?.avatar ?? cursorPayload.avatar,
              x,
              y,
              color: typeof cursorPayload.color === 'string' ? cursorPayload.color : '',
              cursorImage: cursorPayload.cursorImage,
              active,
            };
            updateCollabCursor(cursor);
            return;
          }
          if (payload.type === 'presence:update') {
            const activeTabId =
              typeof payload.activeTabId === 'string' && isTabId(payload.activeTabId)
                ? payload.activeTabId
                : null;
            upsertCollabMember({
              id: message.clientId,
              activeTabId,
            });
          }
          return;
        }
        case 'room:member-left': {
          if (collabModeRef.current !== 'host') return;
          if (!collabRoomIdRef.current || message.roomId !== collabRoomIdRef.current) return;
          if (!collabMembersRef.current.some((member) => member.id === message.clientId)) return;
          const nextMembers = collabMembersRef.current.filter((member) => member.id !== message.clientId);
          removeCollabMember(message.clientId);
          removeCollabCursor(message.clientId);
          pruneLockedNodes([clientIdRef.current, ...nextMembers.map((member) => member.id)]);
          sendRoomMessage({
            type: 'members:update',
            members: [buildMembersSnapshot()[0], ...nextMembers],
          });
          return;
        }
        case 'room:message': {
          const payload = message.payload as { type?: string; [key: string]: unknown } | null;
          if (!payload || typeof payload.type !== 'string') return;
          if (payload.type === 'session:init') {
            if (pendingJoinRoomIdRef.current && message.roomId !== pendingJoinRoomIdRef.current) {
              return;
            }
            const project = payload.project as ProjectDocument | undefined;
            const ownerNickname =
              typeof payload.ownerNickname === 'string' ? payload.ownerNickname : '';
            const permission = normalizeCollabPermission(payload.permission as string | undefined);
            setCollabOwnerNickname(ownerNickname);
            setCollabPermission(permission);
            setCollabRoomId(message.roomId);
            setCollabMode('client');
            setPendingJoinRoomId(null);
            collabModeRef.current = 'client';
            collabRoomIdRef.current = message.roomId;
            pendingJoinRoomIdRef.current = null;
            if (project) {
              const { document: prepared, primaryGraphId, warnings } = prepareProjectDocument(
                project,
              );
              runWithCollabSyncSuppressed(() => {
                applyProjectDocument(prepared, primaryGraphId);
              });
              if (warnings.length) {
                console.warn('Collaboration project normalization warnings:', warnings);
              }
            }
            const members = Array.isArray(payload.members) ? payload.members : [];
            const filteredMembers = dedupeCollabMembers(
              members
                .filter((member) => member && typeof member.id === 'string')
                .filter((member) => member.id !== clientIdRef.current),
            );
            setCollabMembers(filteredMembers);
            collabLockedNodesRef.current.clear();
            setLockedNodeIds([]);
            return;
          }
          if (collabModeRef.current !== 'client') return;
          if (collabRoomIdRef.current && message.roomId !== collabRoomIdRef.current) return;
          if (payload.type === 'members:update') {
            const members = Array.isArray(payload.members) ? payload.members : [];
            const hasSelf = members.some((member) => member?.id === clientIdRef.current);
            if (!hasSelf) {
              leaveCollaboratorSession('collab.disconnect.owner');
              return;
            }
            const filteredMembers = dedupeCollabMembers(
              members
                .filter((member) => member && typeof member.id === 'string')
                .filter((member) => member.id !== clientIdRef.current),
            );
            setCollabMembers(filteredMembers);
            const owner = members.find((member) => member?.isOwner);
            if (owner && typeof owner.nickname === 'string') {
              setCollabOwnerNickname(owner.nickname);
            }
            pruneLockedNodes(
              members
                .filter((member) => member && typeof member.id === 'string')
                .map((member) => member.id),
            );
            pruneCollabCursors(
              members
                .filter((member) => member && typeof member.id === 'string')
                .map((member) => member.id),
            );
            return;
          }
          if (payload.type === 'project:update') {
            const sourceId = typeof payload.sourceId === 'string' ? payload.sourceId : null;
            if (sourceId && sourceId === clientIdRef.current) return;
            const incoming = payload.document as ProjectDocument | undefined;
            if (!incoming) return;
            const revision = typeof payload.revision === 'number' ? payload.revision : null;
            if (!shouldApplyProjectRevision(sourceId, revision)) return;
            applyRemoteProjectUpdate(incoming);
            return;
          }
          if (payload.type === 'nodes:lock' || payload.type === 'nodes:unlock') {
            const nodeIds = Array.isArray(payload.nodeIds)
              ? payload.nodeIds.filter((item) => typeof item === 'string')
              : [];
            if (!nodeIds.length) return;
            const ownerId = typeof payload.ownerId === 'string' ? payload.ownerId : '';
            const isDragging = payload.type === 'nodes:lock';
            updateLockedNodes(ownerId, nodeIds, isDragging);
            return;
          }
          if (payload.type === 'chat:message') {
            const incoming = payload.message as ChatMessage | undefined;
            if (!incoming) return;
            setChatMessages((prev) => {
              if (prev.some((item) => item.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
            return;
          }
          if (payload.type === 'cursor:update') {
            const cursorPayload = payload.cursor as Partial<CollaborationCursor> & {
              id?: string;
              active?: boolean;
            };
            const cursorId = cursorPayload.id;
            if (!cursorId) return;
            const member = collabMembersRef.current.find((item) => item.id === cursorId);
            const nickname =
              member?.nickname ??
              (typeof cursorPayload.nickname === 'string' ? cursorPayload.nickname : localNickname);
            const x = Number(cursorPayload.x);
            const y = Number(cursorPayload.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const active = cursorPayload.active !== false;
            updateCollabCursor({
              id: cursorId,
              nickname,
              avatar: member?.avatar ?? cursorPayload.avatar,
              x,
              y,
              color: typeof cursorPayload.color === 'string' ? cursorPayload.color : '',
              cursorImage: cursorPayload.cursorImage,
              active,
            });
            return;
          }
          if (payload.type === 'session:end') {
            leaveCollaboratorSession('collab.disconnect.owner');
          }
          return;
        }
        case 'room:closed': {
          leaveCollaboratorSession('collab.disconnect.owner');
          return;
        }
        default:
          return;
      }
    },
    [
      applyRemoteProjectUpdate,
      applyProjectDocument,
      approveJoin,
      buildMembersSnapshot,
      collabAccessMode,
    collabEditorLimit,
    collabLinkPassword,
    collabMembers,
    collabPassword,
    collabPermission,
    leaveCollaboratorSession,
    isAtCapacity,
    localNickname,
    openInfoDialog,
    prepareProjectDocument,
    pruneLockedNodes,
    pruneCollabCursors,
    removeCollabMember,
    removeCollabCursor,
    runWithCollabSyncSuppressed,
    sendRoomMessage,
    sendCollabSignalMessage,
    shouldApplyProjectRevision,
    showSaveToast,
    setCollabMembers,
    setCollabOwnerNickname,
    setCollabPermission,
    setCollabRoomId,
    setCollabMode,
    setPendingJoinRoomId,
    setLockedNodeIds,
    t,
    updateLockedNodes,
    updateCollabCursor,
    upsertCollabMember,
    pendingJoinRoomId,
    ],
  );
  handleSignalMessageRef.current = handleSignalMessage;

  const handlePublicSignalMessage = useCallback(
    (message: SignalMessage) => {
      switch (message.type) {
        case 'room:list': {
          setPublicRooms(Array.isArray(message.rooms) ? message.rooms : []);
          setPublicJoinTarget((prev) => {
            if (!prev || !Array.isArray(message.rooms)) return prev;
            const match = message.rooms.find((room) => room.roomId === prev.room.roomId);
            if (!match) return prev;
            setPublicJoinResolved(true);
            setPublicJoinError(null);
            const mergedRoom = { ...prev.room, ...match };
            if (arePublicRoomsEqual(prev.room, mergedRoom)) {
              return prev;
            }
            return {
              ...prev,
              room: {
                ...mergedRoom,
              },
            };
          });
          return;
        }
        case 'room:info': {
          if (message.room === null) {
            if (publicJoinTarget && publicJoinTarget.room.roomId === message.roomId) {
              setPublicJoinError(t('collab.join.projectMissing'));
            }
            return;
          }
          if (!message.room) return;
          if (publicJoinTarget && publicJoinTarget.room.roomId === message.roomId) {
            setPublicJoinError(null);
            setPublicJoinResolved(true);
          }
          setPublicJoinTarget((prev) => {
            if (!prev || prev.room.roomId !== message.roomId) return prev;
            const mergedRoom = { ...prev.room, ...message.room };
            if (arePublicRoomsEqual(prev.room, mergedRoom)) {
              return prev;
            }
            return {
              ...prev,
              room: {
                ...mergedRoom,
              },
            };
          });
          return;
        }
        case 'room:created': {
          const pending = pendingPublicRoomCreateRef.current;
          if (!pending) return;
          const baseUrl = getJoinBaseUrl();
          const params = new URLSearchParams();
          const socketUrl = publicSignalSocketRef.current?.url;
          params.set('server', buildJoinServerParam(pending.server, socketUrl));
          params.set('roomId', message.roomId);
          const link = `${baseUrl}/join?${params.toString()}`;
          const nextDefaults = {
            server: pending.server.host,
            port: pending.server.port ?? '',
            apiKey: pending.apiKey ?? '',
          };
          persistPublicShareDefaults(nextDefaults);
          setCollabLinkServer(nextDefaults.server);
          setCollabLinkPort(nextDefaults.port);
          setCollabLinkApiKey(nextDefaults.apiKey);
          collabSignalKindRef.current = 'public';
          collabSignalSocketRef.current = publicSignalSocketRef.current;
          collabRoomIdRef.current = message.roomId;
          collabModeRef.current = 'host';
          setCollabRoomId(message.roomId);
          setCollabMode('host');
          setCollabLinkUrl(link);
          setCollabLinkIncludePassword(pending.includePassword);
          pendingPublicRoomCreateRef.current = null;
          return;
        }
        case 'room:error': {
          pendingPublicRoomCreateRef.current = null;
          setShareError(message.message || t('collab.publicServer.roomCreateFailed'));
          return;
        }
        case 'share:list': {
          return;
        }
        default:
          handleSignalMessageRef.current(message);
          return;
      }
    },
    [
    setCollabLinkApiKey,
    setCollabLinkIncludePassword,
    setCollabLinkPort,
    setCollabLinkServer,
    setCollabLinkUrl,
    setCollabMode,
    setCollabRoomId,
    publicJoinTarget,
    setPublicJoinError,
    setPublicJoinResolved,
    setShareError,
    setPublicRooms,
    t,
    ],
  );
  handlePublicSignalMessageRef.current = handlePublicSignalMessage;

  
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
    if (isViewer) return;
    if (!projectDocument || !activeGraphId) {
      openInfoDialog(t('common.info'), t('common.noGraphOpen'));
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
      openInfoDialog(t('app.saveAs.title'), t('app.saveAs.noCategories'));
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
  }, [activeGraphId, isViewer, openInfoDialog, projectDocument, t]);

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
    if (isViewer) return;
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
      saveAsDialog.topFolder === 'client' ? clientKindFromCategoryKey(category.key) : null;
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
    const uniqueName = getUniqueGraphName(projectDocument, location, trimmedName);
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
      name: uniqueName,
      createdAt: saveAsDialog.graph.createdAt ?? timestamp,
      updatedAt: timestamp,
      environment,
      executionIntervalSeconds,
    };
    const path = buildGraphPath(location, newGraphId);
    setGraphDocument(newGraphId, duplicatedGraph);
    setManifestEntry({
      graphId: newGraphId,
      name: uniqueName,
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
    isViewer,
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
        openInfoDialog(t('common.error'), t('app.history.loadFailedAlert'));
        refreshHistory();
      }
    },
    [applyProjectDocument, openInfoDialog, prepareProjectDocument, refreshHistory, t],
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
      if (isViewer || isProjectMetadataLocked) return;
      setGraphName(event.target.value);
    },
    [isProjectMetadataLocked, isViewer, setGraphName],
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
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleSaveAsCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveAsCancel, saveAsDialog]);

  useEffect(() => {
    if (!giaSaveDialog) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleGiaSaveCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [giaSaveDialog, handleGiaSaveCancel]);

  useEffect(() => {
    if (!projectInfoDialog) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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
    if (!giaSaveDialog || !giaSaveSelectedGroup) return;
    if (giaSaveDialog.groupSlug === giaSaveSelectedGroup.groupSlug) return;
    setGiaSaveDialog((prev) =>
      prev ? { ...prev, groupSlug: giaSaveSelectedGroup.groupSlug } : prev,
    );
  }, [giaSaveDialog, giaSaveSelectedGroup]);

  useEffect(() => {
    if (view !== 'editor' || collabMode === 'client') return undefined;
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
  }, [collabMode, view]);

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
      if (shareLinkCopyTimerRef.current) {
        window.clearTimeout(shareLinkCopyTimerRef.current);
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
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isViewer) return;
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
  }, [activeTabType, handleManualSave, isGraphTab, isViewer, view]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isViewer) return;
      if (view !== 'editor') return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        if (event.shiftKey) {
          if (canRedo) {
            redo();
          }
        } else if (canUndo) {
          undo();
        }
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, isViewer, redo, undo, view]);

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
  const renderTabs = () => {
    const renderTabPresence = (tabId: TabId) => {
      if (!isCollaborating) return null;
      const members = presenceByTab.get(tabId) ?? [];
      if (!members.length) return null;
      const hasOverflowPresence = members.length > 3;
      const visiblePresence = hasOverflowPresence ? members.slice(0, 2) : members.slice(0, 3);
      return (
        <div className="app__tab-presence">
          {visiblePresence.map((member) => (
            <Avatar
              key={member.id}
              src={member.avatar}
              label={member.nickname}
              size={15}
              className="app__tab-avatar"
            />
          ))}
          {hasOverflowPresence && (
            <div
              className="app__tab-avatar app__tab-avatar--overflow"
              title={t('collab.presence.more', { count: members.length - 2 })}
            >
              ...
            </div>
          )}
        </div>
      );
    };
    return (
      <div className="app__tabs">
        <div className="app__tabs-scroll">
          {openTabs.map((tab: ProjectTab) => {
            const isActive = tab.id === activeTabId;
            const showDirtyIndicators = collabMode !== 'client';
            const isDirtyGraph = showDirtyIndicators && tab.type === 'graph' && Boolean(dirtyGraphIds[tab.graphId]);
            const isDirtyStruct = showDirtyIndicators && tab.type === 'struct' && Object.keys(dirtyStructIds).length > 0;
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
              <div key={tab.id} className="app__tab-shell">
                {renderTabPresence(tab.id)}
                <button
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
              </div>
            );
          })}
        </div>
        <div className="app__tabs-actions">
          <button
            type="button"
            className="app__tabs-action"
            onClick={handleShareOpen}
            aria-label={isSharing ? t('collab.share.open.sharedAria') : t('collab.share.open.aria')}
          >
            <img src={isSharing ? ICON_SHARE_GLOBAL : ICON_SHARE_LOCK} alt="" aria-hidden="true" />
            <span className="app__tabs-action-label">{t('collab.share.label')}</span>
            {collabRequests.length > 0 && (
              <span className="app__tabs-badge">
                {collabRequests.length > 99 ? '99+' : collabRequests.length}
              </span>
            )}
          </button>
          {isCollaborating && (
            <button
              type="button"
              className="app__tabs-action"
              onClick={() => setIsChatOpen((prev) => !prev)}
              aria-label={t('collab.chat.button')}
            >
              <img src={ICON_CHAT} alt="" aria-hidden="true" />
              <span className="app__tabs-action-label">{t('collab.chat.label')}</span>
              {unreadCount > 0 && (
                <span className="app__tabs-badge app__tabs-badge--chat">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
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
  };

  const renderShareModal = () => {
    if (!isShareOpen) return null;
    const showLocalPasswordField = collabAccessMode === 'local-password';
    const showLinkFields = collabAccessMode === 'link';
    const passwordValue = shareReadOnly ? '******' : collabPassword;
    const passwordLabel = isSharing
      ? t('collab.share.password.change')
      : t('collab.share.password.label');
    const linkPassword = collabLinkPassword.trim();
    const showLinkPasswordToggle = Boolean(linkPassword) && Boolean(collabLinkUrl);
    const showLocalPasswordHint =
      showLocalPasswordField &&
      !shareReadOnly &&
      collabPassword.trim().length > 0 &&
      collabPassword.trim().length < 6;
    const showLinkPasswordHint =
      showLinkFields && !shareReadOnly && linkPassword.length > 0 && linkPassword.length < 6;
    return (
      <div className="collab-overlay" role="dialog" aria-modal="true">
        <div className="collab-modal" role="document">
          <div className="collab-modal__header">
            <div>
              <h2>{t('collab.share.title', { name: shareTargetName })}</h2>
              {shareReadOnly && <p className="collab-modal__note">{t('collab.share.readOnly')}</p>}
              {isViewer && <p className="collab-modal__note">{t('collab.share.viewerNotice')}</p>}
            </div>
          </div>
          <div className="collab-section">
            <h3>{t('collab.share.section.owner')}</h3>
            <div className="collab-field">
              <label htmlFor="collab-owner-name">{t('collab.share.owner.nickname')}</label>
              <input
                id="collab-owner-name"
                value={collabOwnerNickname}
                onChange={(event) => handleOwnerNicknameChange(event.target.value)}
                placeholder={localNickname}
                maxLength={12}
                disabled={shareReadOnly}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="collab-section">
            <h3>{t('collab.share.section.access')}</h3>
            <div className="collab-field">
              <label htmlFor="collab-editor-limit">{t('collab.share.editorLimit.label')}</label>
              <input
                id="collab-editor-limit"
                type="number"
                min={0}
                max={MAX_COLLAB_MEMBERS}
                value={collabEditorLimit}
                onChange={(event) => handleEditorLimitInput(event.target.value)}
                disabled={shareReadOnly}
                inputMode="numeric"
              />
              <p className="collab-hint">{t('collab.share.editorLimit.hint')}</p>
            </div>
            <div className="collab-field">
              <label>{t('collab.share.scope.label')}</label>
              <div className="collab-options">
                {([
                  { value: 'restricted', label: t('collab.share.scope.restricted') },
                  { value: 'local-open', label: t('collab.share.scope.localOpen') },
                  { value: 'local-password', label: t('collab.share.scope.localPassword') },
                  { value: 'link', label: t('collab.share.scope.link') },
                ] as const).map((option) => (
                  <label key={option.value} className="collab-option">
                    <input
                      type="radio"
                      name="collab-scope"
                      value={option.value}
                      checked={collabAccessMode === option.value}
                      onChange={() => setCollabAccessMode(option.value)}
                      disabled={shareReadOnly}
                    />
                    <span>{option.label}</span>
                    {option.value === 'link' && (
                      <span className="collab-option__hint">{t('collab.share.scope.linkHint')}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="collab-field">
              <label>{t('collab.share.permission.label')}</label>
              <div className="collab-options">
                {([
                  { value: 'viewer', label: t('collab.share.permission.viewer') },
                  { value: 'editor', label: t('collab.share.permission.editor') },
                ] as const).map((option) => (
                  <label key={option.value} className="collab-option">
                    <input
                      type="radio"
                      name="collab-permission"
                      value={option.value}
                      checked={collabPermission === option.value}
                      onChange={() => setCollabPermission(option.value)}
                      disabled={shareReadOnly}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {showLocalPasswordField && (
              <div className="collab-field">
                <label htmlFor="collab-password">{passwordLabel}</label>
                <input
                  id="collab-password"
                  type="password"
                  value={passwordValue}
                  onChange={(event) => handleCollabPasswordChange(event.target.value)}
                  placeholder={t('collab.share.password.placeholder')}
                  disabled={shareReadOnly}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="off"
                />
                {showLocalPasswordHint && (
                  <p className="collab-hint collab-hint--error">{t('collab.share.password.invalid')}</p>
                )}
              </div>
            )}
            {showLinkFields && (
              <>
                <div className="collab-field">
                  <label htmlFor="collab-link-server">{t('collab.share.link.server.label')}</label>
                  <input
                    id="collab-link-server"
                    value={collabLinkServer}
                    onChange={(event) => setCollabLinkServer(event.target.value)}
                    placeholder={t('collab.share.link.server.placeholder')}
                    disabled={shareReadOnly}
                    autoComplete="off"
                  />
                </div>
                <div className="collab-field">
                  <label htmlFor="collab-link-port">{t('collab.share.link.port.label')}</label>
                  <input
                    id="collab-link-port"
                    value={collabLinkPort}
                    onChange={(event) => handleCollabLinkPortChange(event.target.value)}
                    placeholder={t('collab.share.link.port.placeholder', {
                      port: COLLAB_PUBLIC_DEFAULT_PORT,
                    })}
                    disabled={shareReadOnly}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="collab-field">
                  <label htmlFor="collab-link-api">{t('collab.share.link.apiKey.label')}</label>
                  <input
                    id="collab-link-api"
                    value={collabLinkApiKey}
                    onChange={(event) => setCollabLinkApiKey(event.target.value)}
                    placeholder={t('collab.share.link.apiKey.placeholder')}
                    disabled={shareReadOnly}
                    autoComplete="off"
                  />
                </div>
                <div className="collab-field">
                  <label>{t('collab.share.link.visibility.label')}</label>
                  <div className="collab-options">
                    {([
                      { value: 'public', label: t('collab.share.link.visibility.public') },
                      { value: 'private', label: t('collab.share.link.visibility.private') },
                    ] as const).map((option) => (
                      <label key={option.value} className="collab-option">
                        <input
                          type="radio"
                          name="collab-link-visibility"
                          value={option.value}
                          checked={collabLinkVisibility === option.value}
                          onChange={() => setCollabLinkVisibility(option.value)}
                          disabled={shareReadOnly}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="collab-field">
                  <label htmlFor="collab-link-password">{t('collab.share.link.password.label')}</label>
                  <input
                    id="collab-link-password"
                    type="password"
                    value={shareReadOnly ? '******' : collabLinkPassword}
                    onChange={(event) => handleCollabLinkPasswordChange(event.target.value)}
                    placeholder={t('collab.share.link.password.placeholder')}
                    disabled={shareReadOnly}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {showLinkPasswordHint && (
                    <p className="collab-hint collab-hint--error">{t('collab.share.password.invalid')}</p>
                  )}
                </div>
              </>
            )}
          </div>
          {isSharing && collabAccessMode === 'link' && collabLinkUrl && (
            <div className="collab-section">
              <h3>{t('collab.share.link.title')}</h3>
              <div className="collab-link">
                <input
                  readOnly
                  className="collab-link__input"
                  value={shareLinkValue}
                  onClick={handleShareLinkCopy}
                  aria-label={t('common.copy')}
                  title={t('common.copy')}
                />
                {shareLinkCopied && <span className="collab-link__hint">{t('common.copied')}</span>}
                {showLinkPasswordToggle && (
                  <label className="collab-checkbox">
                    <input
                      type="checkbox"
                      checked={collabLinkIncludePassword}
                      onChange={(event) => setCollabLinkIncludePassword(event.target.checked)}
                      disabled={shareReadOnly}
                    />
                    <span>{t('collab.share.link.includePassword')}</span>
                  </label>
                )}
              </div>
            </div>
          )}
          {isSharing && (
            <>
              <div className="collab-section">
                <h3>{t('collab.share.requests.title')}</h3>
                {collabRequests.length ? (
                  <div className="collab-list">
                    {collabRequests.map((request) => (
                      <div key={request.id} className="collab-row">
                        <span className="collab-row__name">{request.nickname}</span>
                        <div className="collab-row__actions">
                          <button
                            type="button"
                            onClick={() => handleApproveRequest(request.id)}
                            disabled={shareReadOnly || isAtCapacity}
                            aria-label={t('collab.share.requests.approve')}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIgnoreRequest(request.id)}
                            disabled={shareReadOnly}
                            aria-label={t('collab.share.requests.ignore')}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="collab-empty">{t('collab.share.requests.empty')}</div>
                )}
              </div>
              <div className="collab-section">
                <h3>{t('collab.share.members.title')}</h3>
                {collabMembers.length ? (
                  <div className="collab-list">
                    {collabMembers.map((member) => (
                      <div key={member.id} className="collab-member">
                        <Avatar src={member.avatar} label={member.nickname} size={30} />
                        <div className="collab-member__info">
                          <span className="collab-member__name">{member.nickname}</span>
                          <span className="collab-member__role">
                            {member.permission === 'viewer'
                              ? t('collab.share.permission.viewer')
                              : t('collab.share.permission.editor')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={shareReadOnly}
                        >
                          {t('collab.share.members.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="collab-empty">{t('collab.share.members.empty')}</div>
                )}
              </div>
            </>
          )}
          {shareError && <div className="collab-error">{shareError}</div>}
          <div className="collab-actions">
            <button type="button" onClick={handleShareConfirm} disabled={shareReadOnly}>
              {t('collab.share.button')}
            </button>
            <button type="button" onClick={handleShareClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPublicJoinModal = () => {
    if (!publicJoinTarget || view !== 'home') return null;
    const hasRoomInfo = publicJoinResolved && !publicJoinError;
    const requiresPassword = hasRoomInfo ? publicJoinTarget.room.requiresPassword : Boolean(publicJoinTarget.password);
    const joinTitle = publicJoinTarget.room.name?.trim() || publicJoinTarget.room.roomId;
    const trimmedNickname = sanitizeNickname(publicJoinNickname) || localNickname;
    const trimmedPassword = publicJoinPassword.trim();
    const isPasswordValid = /^\d{6}$/.test(trimmedPassword);
    const showPasswordHint = requiresPassword && trimmedPassword.length > 0 && !isPasswordValid;
    const canSubmit = Boolean(trimmedNickname) && (hasRoomInfo || Boolean(publicJoinTarget.password));
    const canJoin = canSubmit && (!requiresPassword || isPasswordValid) && hasRoomInfo;
    return (
      <div className="home__join-overlay" role="dialog" aria-modal="true">
        <div className="home__join-modal" role="document">
          <h3>{t('home.publicServers.join.title', { name: joinTitle })}</h3>
          <div className="home__join-field">
            <label htmlFor="home-public-join-nickname">{t('home.publicServers.join.nickname')}</label>
            <input
              id="home-public-join-nickname"
              value={publicJoinNickname}
              onChange={(event) => {
                setPublicJoinError(null);
                setPublicJoinNickname(sanitizeNickname(event.target.value));
              }}
              placeholder={localNickname}
              maxLength={12}
              autoComplete="off"
            />
          </div>
          {requiresPassword && (
            <div className="home__join-field">
              <label htmlFor="home-public-join-password">
                {t('home.publicServers.join.password')}
              </label>
              <div className="home__join-password">
                <input
                  id="home-public-join-password"
                  type="password"
                  value={publicJoinPassword}
                  onChange={(event) => {
                    setPublicJoinError(null);
                    setPublicJoinPassword(event.target.value.replace(/\\D/g, '').slice(0, 6));
                  }}
                  placeholder={t('home.publicServers.join.password.placeholder')}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleSendPublicJoinRequest();
                  }}
                  disabled={!canSubmit || publicJoinRequestCooldown > 0 || !hasRoomInfo}
                >
                  {publicJoinRequestCooldown > 0
                    ? t('home.network.join.requestCooldown', { seconds: publicJoinRequestCooldown })
                    : t('home.network.join.request')}
                </button>
              </div>
              {showPasswordHint && (
                <div className="home__join-hint">{t('collab.share.password.invalid')}</div>
              )}
            </div>
          )}
          {!hasRoomInfo && !publicJoinError && (
            <div className="home__join-hint">{t('home.publicServers.connecting')}</div>
          )}
          {publicJoinError && <div className="home__join-hint">{publicJoinError}</div>}
          <div className="home__join-actions">
            <button
              type="button"
              onClick={() => {
                if (!canJoin) return;
                void handleConfirmPublicJoin();
              }}
              disabled={!canJoin}
            >
              {t('home.publicServers.join.action')}
            </button>
            <button type="button" onClick={handlePublicJoinCancel}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderChatPanel = () => {
    if (!isCollaborating) return null;
    return (
      <div
        className={`app__chat-panel${isChatOpen ? ' is-open' : ''}`}
        ref={chatPanelRef}
        aria-hidden={!isChatOpen}
      >
        <div className="app__chat-header">
          <span>{t('collab.chat.title')}</span>
          <button type="button" onClick={() => setIsChatOpen(false)} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="app__chat-body">
          <div className="app__chat-messages" ref={chatMessagesRef}>
            {chatMessages.length ? (
              chatMessages.map((message) => {
                const isSelf = message.senderId === localMember.id;
                return (
                  <div
                    key={message.id}
                    className={`app__chat-message${isSelf ? ' is-self' : ''}`}
                  >
                    {!isSelf && <Avatar src={message.avatar} label={message.nickname} size={28} />}
                    <div className="app__chat-bubble">
                      <div className="app__chat-name">{message.nickname}</div>
                      <div className="app__chat-text">{message.content}</div>
                    </div>
                    {isSelf && <Avatar src={message.avatar} label={message.nickname} size={28} />}
                  </div>
                );
              })
            ) : (
              <div className="app__chat-empty">{t('collab.chat.empty')}</div>
            )}
          </div>
          {showChatScrollButton && (
            <button
              type="button"
              className="app__chat-scroll-button"
              onClick={() => scrollChatToBottom()}
            >
              {t('collab.chat.goBottom')}
            </button>
          )}
        </div>
        <form className="app__chat-input" onSubmit={handleChatSubmit}>
          <textarea
            ref={chatInputRef}
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            onKeyDown={handleChatDraftKeyDown}
            placeholder={t('collab.chat.placeholder')}
            disabled={!isCollaborating}
            rows={1}
          />
          <button type="submit" disabled={!isCollaborating || !chatDraft.trim()}>
            {t('collab.chat.send')}
          </button>
        </form>
      </div>
    );
  };

  const renderEditor = () => {
    const saveAsCategories = saveAsDialog
      ? PROJECT_CATEGORIES_BY_TOP[saveAsDialog.topFolder]
      : [];
    const selectedCategory = saveAsDialog
      ? saveAsCategories.find((category) => category.key === saveAsDialog.categoryKey) ??
        saveAsCategories[0] ??
        null
      : null;
    const selectedCategoryKey = selectedCategory?.key ?? saveAsDialog?.categoryKey ?? '';
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
                  <button type="button" onClick={handleManualSave} disabled={isViewer}>
                    <img src={ICON_SAVE} alt="" aria-hidden="true" />
                    {t('app.menu.file.saveProject')}
                  </button>
                  <button type="button" onClick={handleOpenProjectInfo} disabled={isViewer}>
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
        {collabSaving && (
          <div className="app__editor-bar-saving-stat">{t('collab.saving')}</div>
        )}
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
              isReadOnly={isViewer}
            />
            <GraphCanvas
              isMobileMode={isMobileMode}
              settings={editorSettings}
              lockedNodeIds={lockedNodeIds}
              collabCursors={displayedCursors}
              isReadOnly={isViewer}
              onNodeDragStateChange={handleNodeDragStateChange}
              onCollabCursorMove={isCollaborating ? queueCollabCursorUpdate : undefined}
            />
            <NodeInspector collapsed={inspectorCollapsed} onToggle={toggleInspector} isReadOnly={isViewer} />
          </>
        ) : isStructTab ? (
          <StructureManager
            projectDocument={projectDocument}
            dirtyStructIds={dirtyStructIds}
            onRequestSave={performProjectSave}
            showDirtyIndicators={collabMode !== 'client'}
            isReadOnly={isViewer}
          />
        ) : (
          <ResourceExplorer
            topFolder={explorerTopFolder}
            document={projectDocument}
            dirtyGraphIds={dirtyGraphIds}
            onOpenGraph={handleOpenGraphFromExplorer}
            showDirtyIndicators={collabMode !== 'client'}
            isReadOnly={isViewer}
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
                disabled={isViewer}
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
                      readOnly={isViewer}
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
                readOnly={isViewer || isProjectMetadataLocked}
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
                disabled={isViewer || !canUndo}
                title={t('common.undo')}
              >
                <img src={ICON_UNDO} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.undo')}</span>
              </button>
              <button
                type="button"
                className="action_dock__button"
                onClick={redo}
                disabled={isViewer || !canRedo}
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
                disabled={isViewer}
              >
                <img src={ICON_SAVE} alt="" aria-hidden="true" className="action_dock__icon-img" />
                <span className="sr-only">{t('common.save')}</span>
              </button>
              <button
                type="button"
                className="action_dock__button"
                onClick={handleSaveGraphAs}
                title={t('common.saveAs')}
                disabled={isViewer}
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
                readOnly={isViewer || isProjectMetadataLocked}
              />
            </div>
            {projectInfoDialog.error && (
              <div className="app__modal-error" role="status">
                {projectInfoDialog.error}
              </div>
            )}
            <div className="app__modal-actions">
              <button type="submit" disabled={isViewer || isProjectMetadataLocked}>
                {t('common.save')}
              </button>
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
                  <option
                    key={category.key}
                    value={category.key}
                    disabled={category.key !== selectedCategoryKey}
                  >
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
                      ? defaultGroupNameLabel
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
        isConvertingGia={isConvertingGia}
        onConvertGia={handleConvertGiaFile}
        networkProjects={networkProjects}
        signalConnected={signalConnected}
        defaultNickname={localNickname}
        onRefreshNetwork={handleRefreshNetwork}
        onJoinNetworkProject={handleJoinNetworkProject}
        onSendJoinRequest={handleSendJoinRequest}
        publicServers={publicServers}
        publicRooms={publicRooms}
        publicServerStatus={publicSignalStatus}
        defaultPublicPort={COLLAB_PUBLIC_DEFAULT_PORT}
        onSavePublicServer={handleSavePublicServer}
        onSearchPublicRooms={handleSearchPublicRooms}
        onRequestPublicJoin={handleRequestPublicJoin}
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
      {view === 'editor' && renderChatPanel()}
      {view === 'editor' && renderShareModal()}
      {renderPublicJoinModal()}
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
              {(giaModal.importErrors?.length || giaModal.importWarnings?.length) && (
                <div className="gia-modal__section">
                  {giaModal.importErrors?.length ? (
                    <>
                      <h4 className="gia-modal__section-title">{t('app.giaDecode.importErrorsTitle')}</h4>
                      <ul className="gia-modal__list">
                        {giaModal.importErrors.map((issue, index) => (
                          <li key={`gia-error-${index}`}>{t(issue.key, issue.params)}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {giaModal.importWarnings?.length ? (
                    <>
                      <h4 className="gia-modal__section-title">{t('app.giaDecode.importWarningsTitle')}</h4>
                      <ul className="gia-modal__list">
                        {giaModal.importWarnings.map((warning, index) => (
                          <li key={`gia-warning-${index}`}>{t(warning.key, warning.params)}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              )}
              <pre
                className="gia-modal__code"
                dangerouslySetInnerHTML={{ __html: giaModal.highlightedJson }}
              />
            </div>
            <div className="gia-modal__actions">
              <button
                type="button"
                onClick={handleOpenGiaSaveDialog}
                disabled={!giaModal.importedGraph || Boolean(giaModal.importErrors?.length)}
              >
                {t('app.giaDecode.saveGraph')}
              </button>
              <button
                type="button"
                onClick={handleDownloadGiaGraphJson}
                disabled={!giaModal.importedGraph || Boolean(giaModal.importErrors?.length)}
              >
                {t('app.giaDecode.downloadGraphJson')}
              </button>
              <button
                type="button"
                onClick={handleDownloadGiaPreviewJson}
                title={t('app.giaDecode.previewTooltip')}
              >
                {t('app.giaDecode.downloadPreviewJson')}
              </button>
              <button type="button" onClick={closeGiaModal}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {giaConvertModal && (
        <div className="gia-modal-overlay" role="dialog" aria-modal="true">
          <div className="gia-modal" role="document">
            <div className="gia-modal__header">
              <div className="gia-modal__title">
                <h3>{t('app.giaConvert.modalTitle')}</h3>
                <p>{giaConvertModal.fileName}</p>
              </div>
            </div>
            <div className="gia-modal__body">
              {giaConvertModal.errors.length > 0 && (
                <div className="gia-modal__section">
                  <h4 className="gia-modal__section-title">{t('app.giaConvert.errorsTitle')}</h4>
                  <ul className="gia-modal__list">
                    {giaConvertModal.errors.map((error, index) => (
                      <li key={`gia-convert-error-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {giaConvertModal.warnings.length > 0 && (
                <div className="gia-modal__section">
                  <h4 className="gia-modal__section-title">{t('app.giaConvert.warningsTitle')}</h4>
                  <ul className="gia-modal__list">
                    {giaConvertModal.warnings.map((warning, index) => (
                      <li key={`gia-convert-warning-${index}`}>{t(warning.key, warning.params)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="gia-modal__field">
                <label htmlFor="gia-convert-uid">{t('app.giaConvert.uidLabel')}</label>
                <div className="gia-modal__uid">
                  <input
                    id="gia-convert-uid"
                    type="text"
                    inputMode="numeric"
                    value={giaConvertModal.uid}
                    onChange={(event) => handleGiaConvertUidChange(event.target.value)}
                    placeholder={t('app.giaConvert.uidPlaceholder')}
                  />
                  <button
                    type="button"
                    className="gia-modal__uid-button"
                    onClick={handleGiaConvertRandomUid}
                    title={t('app.giaConvert.uidRandom')}
                  >
                    <img src={ICON_RELOAD} alt="" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div className="gia-modal__actions">
              <button
                type="button"
                onClick={handleGiaConvertDownload}
                disabled={
                  !giaConvertModal.graph ||
                  giaConvertModal.errors.length > 0 ||
                  !/^\d{9,10}$/.test(giaConvertModal.uid)
                }
              >
                {t('app.giaConvert.download')}
              </button>
              <button type="button" onClick={handleGiaConvertClose}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {giaSaveDialog && (
        <div
          className="app__modal-backdrop app__modal-backdrop--above-gia"
          role="dialog"
          aria-modal="true"
          onClick={handleGiaSaveCancel}
        >
          <form
            className="app__modal"
            role="document"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              handleGiaSaveConfirm();
            }}
          >
            <h3>{t('app.giaImport.save.title')}</h3>
            <div className="app__modal-field">
              <label htmlFor="gia-save-project">{t('app.giaImport.save.projectLabel')}</label>
              <select
                id="gia-save-project"
                value={giaSaveDialog.targetProjectId}
                onChange={(event) => {
                  const value = event.target.value;
                  setGiaSaveDialog((prev) => (prev ? { ...prev, targetProjectId: value } : prev));
                  setGiaSaveFolderName('');
                  setGiaSaveError(null);
                }}
              >
                <option value={GIA_SAVE_NEW_PROJECT_ID}>{t('app.giaImport.save.newProjectOption')}</option>
                {history.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name || defaultProjectName}
                  </option>
                ))}
              </select>
            </div>
            {giaSaveDialog.targetProjectId === GIA_SAVE_NEW_PROJECT_ID && (
              <div className="app__modal-field">
                <label htmlFor="gia-save-project-name">{t('app.projectInfo.nameLabel')}</label>
                <input
                  id="gia-save-project-name"
                  value={giaSaveDialog.newProjectName}
                  onChange={(event) => {
                    setGiaSaveDialog((prev) =>
                      prev ? { ...prev, newProjectName: event.target.value } : prev,
                    );
                    setGiaSaveError(null);
                  }}
                  placeholder={t('app.projectInfo.namePlaceholder')}
                />
              </div>
            )}
            <div className="app__modal-field">
              <label>{t('app.saveAs.topFolderLabel')}</label>
              <div className="app__modal-static">{giaSaveTopFolderLabel}</div>
            </div>
            <div className="app__modal-field">
              <label htmlFor="gia-save-category">{t('common.category')}</label>
              <select
                id="gia-save-category"
                value={giaSaveSelectedCategory?.key ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setGiaSaveDialog((prev) => (prev ? { ...prev, categoryKey: value } : prev));
                  setGiaSaveFolderName('');
                  setGiaSaveError(null);
                }}
              >
                {giaSaveCategories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {t(category.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="app__modal-field">
              <label htmlFor="gia-save-folder">{t('common.folder')}</label>
              <select
                id="gia-save-folder"
                value={giaSaveSelectedGroup?.groupSlug ?? giaSaveDialog.groupSlug}
                onChange={(event) => {
                  const value = event.target.value;
                  setGiaSaveDialog((prev) => (prev ? { ...prev, groupSlug: value } : prev));
                  setGiaSaveError(null);
                }}
              >
                {giaSaveGroups.map((group) => (
                  <option key={group.groupSlug} value={group.groupSlug}>
                    {group.groupSlug === DEFAULT_GROUP_SLUG && group.groupName === DEFAULT_GROUP_NAME
                      ? defaultGroupNameLabel
                      : group.groupName}
                  </option>
                ))}
              </select>
            </div>
            <div className="app__modal-field">
              <label htmlFor="gia-save-new-folder">{t('app.giaImport.save.newFolderLabel')}</label>
              <input
                id="gia-save-new-folder"
                value={giaSaveFolderName}
                onChange={(event) => {
                  setGiaSaveFolderName(event.target.value);
                  setGiaSaveError(null);
                }}
                placeholder={t('app.giaImport.save.newFolderPlaceholder')}
              />
            </div>
            <div className="app__modal-field">
              <label htmlFor="gia-save-name">{t('graph.nameLabel')}</label>
              <input
                id="gia-save-name"
                value={giaSaveDialog.name}
                onChange={(event) => {
                  setGiaSaveDialog((prev) => (prev ? { ...prev, name: event.target.value } : prev));
                  setGiaSaveError(null);
                }}
                placeholder={t('graph.namePlaceholder')}
              />
            </div>
            {giaSavePathPreview && (
              <div className="app__modal-path" aria-live="polite">
                {t('app.saveAs.pathPreview', { path: giaSavePathPreview })}
              </div>
            )}
            {giaSaveError && <div className="app__modal-error">{giaSaveError}</div>}
            <div className="app__modal-actions">
              <button type="submit">{t('common.save')}</button>
              <button type="button" onClick={handleGiaSaveCancel}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
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
                className={gilDialog.confirmClassName ?? (gilDialog.cancelLabel ? '' : 'is-danger')}
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
