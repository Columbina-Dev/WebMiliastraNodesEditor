import type { DragEvent as ReactDragEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import type { StoredProject } from '../utils/storage';
import { useI18n } from '../utils/i18nContext';
import { sanitizeNickname } from '../utils/collaborationProfile';
import './HomePage.css';

export type NetworkProject = {
  id: string;
  roomId?: string;
  hostId?: string;
  projectId?: string;
  name: string;
  appVersion?: string;
  address: string;
  requiresPassword: boolean;
  ownerNickname?: string;
};

export type PublicServerEntry = {
  id: string;
  name: string;
  host: string;
  port?: string;
};

export type PublicRoomEntry = {
  roomId: string;
  name: string;
  requiresPassword: boolean;
  permission: 'viewer' | 'editor';
  appVersion?: string;
};

interface HomePageProps {
  projects: StoredProject[];
  duplicateNameCounts: Map<string, number>;
  onCreateNew: () => void;
  onImportClick: () => void;
  onDropFiles: (files: FileList | File[]) => void;
  onOpenProject: (project: StoredProject) => void;
  onDeleteProject: (projectId: string) => void;
  onSaveAll: () => void;
  githubUrl: string;
  onOpenTutorial: () => void;
  onOpenEffects: () => void;
  onOpenSettings: () => void;
  isDecodingGia: boolean;
  onDecodeGia: (file: File) => Promise<void> | void;
  isConvertingGia: boolean;
  onConvertGia: (file: File) => Promise<void> | void;
  networkProjects: NetworkProject[];
  signalConnected: boolean;
  defaultNickname: string;
  onRefreshNetwork: () => void;
  onJoinNetworkProject: (project: NetworkProject, nickname: string, password?: string) => void;
  onSendJoinRequest: (project: NetworkProject, nickname: string) => boolean;
  publicServers: PublicServerEntry[];
  publicRooms: PublicRoomEntry[];
  publicServerStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  defaultPublicPort: number;
  onSavePublicServer: (server: PublicServerEntry, shouldConnect: boolean) => void;
  onSearchPublicRooms: (server: PublicServerEntry, query: string) => void;
  onRequestPublicJoin: (server: PublicServerEntry, room: PublicRoomEntry) => void;
}

const formatTimestamp = (iso?: string) => {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
};

const ICON_DELETE = new URL('../assets/icons/del.png', import.meta.url).href;
const ICON_TUTORIAL = new URL('../assets/icons/tutorial.png', import.meta.url).href;
const ICON_EFFECTS = new URL('../assets/icons/effects.png', import.meta.url).href;
const ICON_SETTING = new URL('../assets/icons/setting.png', import.meta.url).href;
const ICON_RELOAD = new URL('../assets/icons/reload.png', import.meta.url).href;
const ICON_SEARCH = new URL('../assets/icons/search.svg', import.meta.url).href;

const HomePage = ({
  projects,
  duplicateNameCounts,
  onCreateNew,
  onImportClick,
  onDropFiles,
  onOpenProject,
  onDeleteProject,
  onSaveAll,
  githubUrl,
  onOpenTutorial,
  onOpenEffects,
  onOpenSettings,
  isDecodingGia,
  onDecodeGia,
  isConvertingGia,
  onConvertGia,
  networkProjects,
  signalConnected,
  defaultNickname,
  onRefreshNetwork,
  onJoinNetworkProject,
  onSendJoinRequest,
  publicServers,
  publicRooms,
  publicServerStatus,
  defaultPublicPort,
  onSavePublicServer,
  onSearchPublicRooms,
  onRequestPublicJoin,
}: HomePageProps) => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);
  const [pendingJoin, setPendingJoin] = useState<NetworkProject | null>(null);
  const [joinNickname, setJoinNickname] = useState(defaultNickname);
  const [joinPassword, setJoinPassword] = useState('');
  const [requestCooldown, setRequestCooldown] = useState(0);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverAlias, setServerAlias] = useState('');
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [editingServer, setEditingServer] = useState<PublicServerEntry | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserServer, setBrowserServer] = useState<PublicServerEntry | null>(null);
  const [publicRoomQuery, setPublicRoomQuery] = useState('');
  const [publicRoomSearched, setPublicRoomSearched] = useState(false);
  const decodeInputRef = useRef<HTMLInputElement | null>(null);
  const convertInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)),
    [projects],
  );

  const hasDragFiles = (transfer: DataTransfer | null) =>
    Boolean(transfer && Array.from(transfer.types).includes('Files'));

  useEffect(() => {
    if (!pendingJoin) return;
    setJoinNickname(defaultNickname);
    setJoinPassword('');
    setRequestCooldown(0);
  }, [defaultNickname, pendingJoin]);

  useEffect(() => {
    if (requestCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRequestCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [requestCooldown]);

  useEffect(() => {
    const handleWindowDragEnter = (event: DragEvent) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      dragCounterRef.current += 1;
      setIsDragging(true);
    };
    const handleWindowDragLeave = (event: DragEvent) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };
    const handleWindowDragOver = (event: DragEvent) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      event.preventDefault();
    };
    const handleWindowDrop = (event: DragEvent) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (event.dataTransfer?.files?.length) {
        onDropFiles(event.dataTransfer.files);
      }
    };
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [onDropFiles]);

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (event.dataTransfer?.files?.length) {
      onDropFiles(event.dataTransfer.files);
    }
  };

  const hasHistory = sortedProjects.length > 0;
  const joinPasswordTrimmed = joinPassword.trim();
  const showJoinPasswordHint =
    Boolean(pendingJoin?.requiresPassword) &&
    joinPasswordTrimmed.length > 0 &&
    !/^\d{6}$/.test(joinPasswordTrimmed);
  const defaultProjectName = t('project.defaultName');
  const defaultServerAlias = useMemo(() => {
    const base = t('collab.publicServer.defaultName');
    const existing = new Set(publicServers.map((server) => server.name));
    if (!existing.has(base)) return base;
    let index = 2;
    let candidate = `${base}_${index}`;
    while (existing.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }
    return candidate;
  }, [publicServers, t]);

  const createServerId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const openServerModal = (server?: PublicServerEntry) => {
    setEditingServer(server ?? null);
    setServerAlias(server?.name ?? '');
    setServerHost(server?.host ?? '');
    setServerPort(server?.port ?? '');
    setIsServerModalOpen(true);
  };

  const openBrowser = (server: PublicServerEntry) => {
    setBrowserServer(server);
    setIsBrowserOpen(true);
    setPublicRoomQuery('');
    setPublicRoomSearched(true);
    onSearchPublicRooms(server, '');
  };

  const handleSaveServer = (shouldConnect: boolean) => {
    const alias = serverAlias.trim() || defaultServerAlias;
    const host = serverHost.trim();
    if (!host) return;
    const port = serverPort.trim();
    const entry: PublicServerEntry = {
      id: editingServer?.id ?? createServerId(),
      name: alias,
      host,
      port,
    };
    if (!shouldConnect) {
      setIsServerModalOpen(false);
      openBrowser(entry);
      return;
    }
    onSavePublicServer(entry, true);
    setIsServerModalOpen(false);
    openBrowser(entry);
  };

  return (
    <div className="home">
      <div className="home__panel">
        <div className="home__intro">
          <h1>{t('home.title')}</h1>
        </div>
        <div className="home__actions">
          <button type="button" onClick={onCreateNew}>
            {t('home.actions.create')}
          </button>
          <button type="button" onClick={onImportClick}>
            {t('home.actions.importZip')}
          </button>
        </div>
        <div className="home__actions home__actions--secondary">
          <button
            type="button"
            onClick={() => decodeInputRef.current?.click()}
            disabled={isDecodingGia}
            aria-busy={isDecodingGia || undefined}
          >
            {isDecodingGia ? t('home.actions.decodeGia.loading') : t('home.actions.decodeGia')}
          </button>
          <button
            type="button"
            onClick={() => convertInputRef.current?.click()}
            disabled={isConvertingGia}
            aria-busy={isConvertingGia || undefined}
          >
            {isConvertingGia ? t('home.actions.convertGia.loading') : t('home.actions.convertGia')}
          </button>
          <input
            ref={decodeInputRef}
            type="file"
            accept=".gia"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              await onDecodeGia(file);
            }}
          />
          <input
            ref={convertInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              await onConvertGia(file);
            }}
          />
        </div>
        <div
          className={classNames('home__dropzone', { 'is-active': isDragging })}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {t('home.dropzone')}</div>
        <div className="home__history-header">
          <h2>{t('home.history.title')}</h2>
          <button type="button" onClick={onSaveAll} disabled={!hasHistory}>
            {t('home.history.exportAll')}</button>
        </div>
        <div className="home__history">
          {hasHistory ? (
            <div className="home__history-list">
              {sortedProjects.map((project) => {
                const displayName = project.name || defaultProjectName;
                const showId = (duplicateNameCounts.get(displayName) ?? 0) > 1;
                const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenProject(project);
                  }
                };
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={project.id}
                    className="home__history-item"
                    onClick={() => onOpenProject(project)}
                    onKeyDown={handleKeyDown}
                  >
                    <button
                      type="button"
                      className="home__history-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDelete(project);
                      }}
                      aria-label={t('home.history.deleteAria', { name: displayName })}
                    >
                      <img src={ICON_DELETE} alt="" aria-hidden="true" />
                    </button>
                    <div className="home__history-name">{displayName}</div>
                    {showId && <div className="home__history-id">{project.id}</div>}
                    <div className="home__history-time">{formatTimestamp(project.savedAt)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="home__history-empty">{t('home.history.empty')}</div>
          )}
        </div>
        <hr className="home__divider" />
        <div className="home__network-header">
          <h2>{t('home.network.title')}</h2>
          <button
            type="button"
            className="home__network-reload"
            onClick={onRefreshNetwork}
            aria-label={t('home.network.reload')}
            title={t('home.network.reload')}
          >
            <img src={ICON_RELOAD} alt="" aria-hidden="true" />
          </button>
        </div>
        <div className="home__network">
          {!signalConnected ? (
            <div className="home__network-empty home__network-empty--offline">
              {t('collab.signal.offline')}
            </div>
          ) : networkProjects.length ? (
            <div className="home__network-list">
              {networkProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="home__network-item"
                  onClick={() => setPendingJoin(project)}
                >
                  <div className="home__network-name">{project.name}</div>
                  <div className="home__network-address">{project.address}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="home__network-empty">{t('home.network.empty')}</div>
          )}
        </div>
        <hr className="home__divider" />
        <div className="home__servers-header">
          <h2>{t('home.publicServers.title')}</h2>
          <button
            type="button"
            className="home__servers-add"
            onClick={() => openServerModal()}
            aria-label={t('home.publicServers.add')}
            title={t('home.publicServers.add')}
          >
            +
          </button>
        </div>
        <div className="home__servers">
          {publicServers.length ? (
            <div className="home__servers-list">
              {publicServers.map((server) => (
                <div key={server.id} className="home__server-item">
                  <button
                    type="button"
                    className="home__server-main"
                    onClick={() => openBrowser(server)}
                  >
                    <div className="home__server-name">{server.name}</div>
                    <div className="home__server-address">
                      {server.host}
                      {server.port ? `:${server.port}` : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="home__server-config"
                    onClick={() => openServerModal(server)}
                    aria-label={t('home.publicServers.config')}
                    title={t('home.publicServers.config')}
                  >
                    <img src={ICON_SETTING} alt="" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="home__servers-empty">{t('home.publicServers.empty')}</div>
          )}
        </div>
      </div>
      <div className="home__links">
        <div className="home__links-glass" aria-hidden="true" />
        <button
          type="button"
          className="home__settings"
          onClick={onOpenSettings}
          aria-label={t('settings.title')}
        >
          <img src={ICON_SETTING} alt="" aria-hidden="true" width="32" height="32" />
        </button>
        <a
          className="home__github"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t('common.github')}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path
              d="M12 .5C5.73.5.5 5.74.5 12.04c0 5.11 3.29 9.45 7.86 10.98.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.03 1.79 2.7 1.27 3.36.97.1-.76.4-1.27.72-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.12 3.02.74.81 1.18 1.84 1.18 3.1 0 4.44-2.68 5.41-5.23 5.7.41.36.77 1.08.77 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56 4.56-1.53 7.85-5.87 7.85-10.98C23.5 5.74 18.27.5 12 .5z"
              fill="#FFF"
            />
          </svg>
        </a>
        <button
          type="button"
          className="home__tutorial"
          onClick={onOpenTutorial}
          aria-label={t('common.tutorial')}
        >
          <img src={ICON_TUTORIAL} alt="" aria-hidden="true" width="32" height="32" />
        </button>
        <button
          type="button"
          className="home__effects"
          onClick={onOpenEffects}
          aria-label={t('common.effects')}
        >
          <img src={ICON_EFFECTS} alt="" aria-hidden="true" width="32" height="32" />
        </button>
      </div>
      {pendingDelete && (
        <div
          className="home__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="home__confirm"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t('home.deleteDialog.title')}</h3>
            <p>
              {t('home.deleteDialog.message.prefix')}
              <strong>
                {t('home.deleteDialog.message.nameWrap', {
                  name: pendingDelete.name || defaultProjectName,
                })}
              </strong>
              {t('home.deleteDialog.message.suffix')}
            </p>
            <div className="home__confirm-actions">
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  onDeleteProject(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                {t('common.delete')}
              </button>
              <button type="button" onClick={() => setPendingDelete(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingJoin && (
        <div className="home__join-overlay" role="dialog" aria-modal="true">
          <div className="home__join-modal" role="document">
            <h3>{t('home.network.join.title', { name: pendingJoin.name })}</h3>
            <div className="home__join-field">
              <label htmlFor="home-join-nickname">{t('home.network.join.nickname')}</label>
              <input
                id="home-join-nickname"
                value={joinNickname}
                onChange={(event) => setJoinNickname(sanitizeNickname(event.target.value))}
                placeholder={defaultNickname}
                maxLength={12}
                autoComplete="off"
              />
            </div>
            {pendingJoin.requiresPassword && (
              <div className="home__join-field">
                <label htmlFor="home-join-password">{t('home.network.join.password')}</label>
                <div className="home__join-password">
                  <input
                    id="home-join-password"
                    type="password"
                    value={joinPassword}
                    onChange={(event) =>
                      setJoinPassword(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder={t('home.network.join.password.placeholder')}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!joinNickname.trim() || requestCooldown > 0) return;
                      const sent = onSendJoinRequest(pendingJoin, joinNickname);
                      if (sent) {
                        setRequestCooldown(30);
                      }
                    }}
                    disabled={requestCooldown > 0}
                  >
                    {requestCooldown > 0
                      ? t('home.network.join.requestCooldown', { seconds: requestCooldown })
                      : t('home.network.join.request')}
                  </button>
                </div>
                {showJoinPasswordHint && (
                  <div className="home__join-hint">{t('collab.share.password.invalid')}</div>
                )}
              </div>
            )}
            <div className="home__join-actions">
              <button
                type="button"
                onClick={() => {
                  if (!pendingJoin) return;
                  if (!joinNickname.trim()) return;
                  if (pendingJoin.requiresPassword && !/^\d{6}$/.test(joinPassword.trim())) return;
                  onJoinNetworkProject(pendingJoin, joinNickname, joinPassword);
                  setPendingJoin(null);
                }}
                disabled={
                  !joinNickname.trim() ||
                  (pendingJoin.requiresPassword && !/^\d{6}$/.test(joinPassword.trim()))
                }
              >
                {t('home.network.join.action')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingJoin(null);
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isServerModalOpen && (
        <div
          className="home__server-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="home__server-modal"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {editingServer ? t('home.publicServers.editTitle') : t('home.publicServers.addTitle')}
            </h3>
            <div className="home__server-field">
              <label htmlFor="home-server-alias">{t('home.publicServers.alias.label')}</label>
              <input
                id="home-server-alias"
                value={serverAlias}
                onChange={(event) => setServerAlias(event.target.value)}
                placeholder={defaultServerAlias}
                autoComplete="off"
              />
            </div>
            <div className="home__server-field">
              <label htmlFor="home-server-host">{t('home.publicServers.server.label')}</label>
              <input
                id="home-server-host"
                value={serverHost}
                onChange={(event) => setServerHost(event.target.value)}
                placeholder={t('home.publicServers.server.placeholder')}
                autoComplete="off"
              />
            </div>
            <div className="home__server-field">
              <label htmlFor="home-server-port">{t('home.publicServers.port.label')}</label>
              <input
                id="home-server-port"
                value={serverPort}
                onChange={(event) =>
                  setServerPort(event.target.value.replace(/\\D/g, '').slice(0, 5))
                }
                placeholder={t('home.publicServers.port.placeholder', { port: defaultPublicPort })}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="home__server-actions">
              <button
                type="button"
                onClick={() => handleSaveServer(false)}
                disabled={!serverHost.trim()}
              >
                {t('home.publicServers.connectWithoutSaving')}
              </button>
              <button
                type="button"
                onClick={() => handleSaveServer(true)}
                disabled={!serverHost.trim()}
              >
                {t('home.publicServers.saveAndConnect')}
              </button>
              <button type="button" onClick={() => setIsServerModalOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {isBrowserOpen && browserServer && (
        <div
          className="home__server-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="home__server-modal home__server-modal--browser"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t('home.publicServers.browserTitle', { name: browserServer.name })}</h3>
            <div className="home__server-field">
              <label htmlFor="home-room-id">{t('home.publicServers.roomId.label')}</label>
              <div className="home__server-search">
                <input
                  id="home-room-id"
                  value={publicRoomQuery}
                  onChange={(event) =>
                    setPublicRoomQuery(event.target.value.replace(/\\D/g, '').slice(0, 16))
                  }
                  placeholder={t('home.publicServers.roomId.placeholder')}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => {
                    const query = publicRoomQuery.trim();
                    onSearchPublicRooms(browserServer, query);
                    setPublicRoomSearched(true);
                  }}
                  disabled={publicServerStatus === 'connecting'}
                  aria-label={t('home.publicServers.search')}
                  title={t('home.publicServers.search')}
                >
                  <img src={ICON_SEARCH} alt="" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!publicRoomSearched) return;
                    onSearchPublicRooms(browserServer, publicRoomQuery.trim());
                  }}
                  disabled={publicServerStatus === 'connecting' || (!publicRoomSearched && publicServerStatus !== 'failed')}
                  aria-label={t('home.publicServers.refresh')}
                  title={t('home.publicServers.refresh')}
                >
                  <img src={ICON_RELOAD} alt="" aria-hidden="true" />
                </button>
              </div>
              {publicServerStatus === 'connecting' && (
                <div className="home__server-hint">{t('home.publicServers.connecting')}</div>
              )}
              {publicServerStatus === 'failed' && (
                <div className="home__server-hint">{t('collab.publicServer.connectFailed')}</div>
              )}
            </div>
            <div className="home__server-rooms">
              {publicRooms.length ? (
                <div className="home__server-room-list">
                  {publicRooms.map((room) => {
                    const permissionLabel =
                      room.permission === 'viewer'
                        ? t('collab.share.permission.viewer')
                        : t('collab.share.permission.editor');
                    const hint = room.requiresPassword
                      ? `${t('home.publicServers.room.requiresPassword')}, ${permissionLabel}`
                      : permissionLabel;
                    return (
                      <button
                        key={room.roomId}
                        type="button"
                        className="home__server-room"
                        onClick={() => onRequestPublicJoin(browserServer, room)}
                      >
                        <div className="home__server-room-name">{room.name || room.roomId}</div>
                        <div className="home__server-room-meta">{hint}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="home__servers-empty">{t('home.publicServers.rooms.empty')}</div>
              )}
            </div>
            <div className="home__server-actions">
              <button type="button" onClick={() => setIsBrowserOpen(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
