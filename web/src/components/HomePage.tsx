import type { DragEvent, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
import classNames from 'classnames';
import type { StoredProject } from '../utils/storage';
import './HomePage.css';

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

const DEFAULT_PROJECT_NAME = '未命名项目';

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
}: HomePageProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoredProject | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)),
    [projects],
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer?.files?.length) {
      onDropFiles(event.dataTransfer.files);
    }
  };

  const hasHistory = sortedProjects.length > 0;

  return (
    <div className="home">
      <div className="home__panel">
        <div className="home__intro">
          <h1>《原神·千星奇域》编辑器模拟器</h1>
        </div>
        <div className="home__actions">
          <button type="button" onClick={onCreateNew}>
            新建项目
          </button>
          <button type="button" onClick={onImportClick}>
            导入Zip项目
          </button>
        </div>
        <div
          className={classNames('home__dropzone', { 'is-active': isDragging })}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          拖放项目Zip到此处导入</div>
        <div className="home__history-header">
          <h2>历史项目</h2>
          <button type="button" onClick={onSaveAll} disabled={!hasHistory}>
            导出所有</button>
        </div>
        <div className="home__history">
          {hasHistory ? (
            <div className="home__history-list">
              {sortedProjects.map((project) => {
                const displayName = project.name || DEFAULT_PROJECT_NAME;
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
                      aria-label={`删除 ${displayName}`}
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
            <div className="home__history-empty">暂无历史项目</div>
          )}
        </div>
      </div>
      <div className="home__links">
        <a
          className="home__github"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path
              d="M12 .5C5.73.5.5 5.74.5 12.04c0 5.11 3.29 9.45 7.86 10.98.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.03 1.79 2.7 1.27 3.36.97.1-.76.4-1.27.72-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.12 3.02.74.81 1.18 1.84 1.18 3.1 0 4.44-2.68 5.41-5.23 5.7.41.36.77 1.08.77 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56 4.56-1.53 7.85-5.87 7.85-10.98C23.5 5.74 18.27.5 12 .5z"
              fill="currentColor"
            />
          </svg>
        </a>
        <button type="button" className="home__tutorial" onClick={onOpenTutorial} aria-label="Tutorial">
          <img src={ICON_TUTORIAL} alt="" aria-hidden="true" width="32" height="32" />
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
            <h3>确认删除</h3>
            <p>
              确定要删除项目
              <strong>「{pendingDelete.name || DEFAULT_PROJECT_NAME}」</strong>
              吗？此操作无法撤销。
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
                删除
              </button>
              <button type="button" onClick={() => setPendingDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
