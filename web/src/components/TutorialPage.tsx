import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import './TutorialPage.css';

export type TutorialKind = 'knowledge' | 'course';

export type TutorialRoute =
  | { kind: 'landing' }
  | { kind: TutorialKind; entryId?: string | null };

interface TutorialPageProps {
  route: TutorialRoute;
  onNavigate: (nextPath: string, replace?: boolean) => void;
  onClose: () => void;
}

interface CatalogNode {
  updated_at: string;
  title: string;
  path_id: string;
  real_id: string;
  children: CatalogNode[];
}

interface CachedContent {
  html: string;
  fallback: boolean;
}

type ContentStatus = 'idle' | 'loading' | 'ready';

const BASE_URL = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
const LOGO_URL = new URL('../assets/img/logo.png', import.meta.url).href;

const staticUrl = (path: string) => `${BASE_URL}/${path.replace(/^\/+/, '')}`;

const CATALOG_URL: Record<TutorialKind, string> = {
  knowledge: staticUrl('tutorial/catalog/knowledge.json'),
  course: staticUrl('tutorial/catalog/course.json'),
};

const contentUrl = (kind: TutorialKind, entryId: string) =>
  staticUrl(`tutorial/content/${kind}/${entryId}.html`);

const formatUpdatedAt = (value?: string) => {
  if (!value) return '';
  const iso = value.replace(' ', 'T') + 'Z';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
};

const findFirstLeaf = (nodes: CatalogNode[]): string | null => {
  for (const node of nodes) {
    if (node.children.length === 0) {
      return node.real_id;
    }
    const nested = findFirstLeaf(node.children);
    if (nested) {
      return nested;
    }
  }
  return null;
};

const filterCatalog = (nodes: CatalogNode[], term: string): CatalogNode[] => {
  if (!term) return nodes;
  const lower = term.toLowerCase();
  const result: CatalogNode[] = [];
  nodes.forEach((node) => {
    const filteredChildren = filterCatalog(node.children, term);
    if (node.title.toLowerCase().includes(lower) || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren });
    }
  });
  return result;
};

const buildPlaceholder = (title: string, updatedAt?: string) => {
  const updatedLine = updatedAt ? `<p class="tutorial-article__meta">最近更新：${updatedAt}</p>` : '';
  return `
    <article class="tutorial-article tutorial-article--placeholder">
      <h1>${title}</h1>
      <p>内容建设中，敬请期待。</p>
      ${updatedLine}
    </article>
  `;
};

const TABS: Array<{ key: TutorialKind; label: string; description: string }> = [
  { key: 'knowledge', label: '说明书', description: '专题文档索引' },
  { key: 'course', label: '教程', description: '任务式教学课程' },
];

const TutorialPage = ({ route, onNavigate, onClose }: TutorialPageProps) => {
  const [catalogData, setCatalogData] = useState<CatalogNode[]>([]);
  const [isCatalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogReloadToken, setCatalogReloadToken] = useState(0);

  const [expandedState, setExpandedState] = useState<Record<TutorialKind, string[]>>({
    knowledge: [],
    course: [],
  });

  const [contentState, setContentState] = useState<{ status: ContentStatus; html: string; fallback: boolean }>(
    {
      status: 'idle',
      html: '',
      fallback: false,
    }
  );

  const contentBodyRef = useRef<HTMLDivElement>(null);

  const catalogCacheRef = useRef<Record<TutorialKind, CatalogNode[] | null>>({
    knowledge: null,
    course: null,
  });
  const contentCacheRef = useRef<Record<TutorialKind, Map<string, CachedContent>>>(
    {
      knowledge: new Map(),
      course: new Map(),
    }
  );

  const activeKind: TutorialKind | null = route.kind === 'landing' ? null : route.kind;
  const detailRoute = route.kind === 'landing' ? null : route;

  useEffect(() => {
    if (route.kind === 'landing') {
      setCatalogData([]);
      setSearchTerm('');
      setCatalogError(null);
      setCatalogLoading(false);
      setContentState({ status: 'idle', html: '', fallback: false });
    }
  }, [route.kind]);

  useEffect(() => {
    if (!activeKind) return;

    const cached = catalogCacheRef.current[activeKind];
    if (cached) {
      setCatalogData(cached);
      setCatalogError(null);
      setCatalogLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(null);

    fetch(CATALOG_URL[activeKind], { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`加载目录失败 (${response.status})`);
        }
        return response.json();
      })
      .then((data: CatalogNode[]) => {
        if (!isMounted) return;
        catalogCacheRef.current[activeKind] = data;
        setCatalogData(data);
        setCatalogError(null);
        setCatalogLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setCatalogData([]);
        setCatalogError((error as Error).message || '目录加载失败');
        setCatalogLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeKind, catalogReloadToken]);

  useEffect(() => {
    if (!activeKind || catalogData.length === 0) return;
    setExpandedState((prev) => {
      const current = new Set(prev[activeKind]);
      let changed = false;
      catalogData.forEach((node) => {
        if (!current.has(node.real_id)) {
          current.add(node.real_id);
          changed = true;
        }
      });
      if (!changed) return prev;
      return { ...prev, [activeKind]: Array.from(current) };
    });
  }, [activeKind, catalogData]);

  const nodeIndex = useMemo(() => {
    if (!activeKind) return new Map<string, CatalogNode>();
    const map = new Map<string, CatalogNode>();
    const walk = (nodes: CatalogNode[]) => {
      nodes.forEach((node) => {
        map.set(node.real_id, node);
        if (node.children.length > 0) {
          walk(node.children);
        }
      });
    };
    walk(catalogData);
    return map;
  }, [activeKind, catalogData]);

  const parentIndex = useMemo(() => {
    if (!activeKind) return new Map<string, string | null>();
    const map = new Map<string, string | null>();
    const walk = (nodes: CatalogNode[], parent: string | null) => {
      nodes.forEach((node) => {
        map.set(node.real_id, parent);
        if (node.children.length > 0) {
          walk(node.children, node.real_id);
        }
      });
    };
    walk(catalogData, null);
    return map;
  }, [activeKind, catalogData]);

  const filteredCatalog = useMemo(() => {
    if (!activeKind) return [] as CatalogNode[];
    return filterCatalog(catalogData, searchTerm.trim());
  }, [activeKind, catalogData, searchTerm]);

  const activeEntryId = useMemo(() => {
    if (!activeKind) return null;
    if (detailRoute?.entryId) {
      return detailRoute.entryId;
    }
    if (catalogData.length === 0) {
      return null;
    }
    return findFirstLeaf(catalogData);
  }, [activeKind, detailRoute, catalogData]);

  useEffect(() => {
    if (!activeKind || catalogData.length === 0) return;
    if (!detailRoute?.entryId) {
      const fallback = findFirstLeaf(catalogData);
      if (fallback) {
        onNavigate(`${activeKind}/detail/${fallback}`, true);
      }
    }
  }, [activeKind, catalogData, detailRoute, onNavigate]);

  const expandedIds = useMemo(() => {
    if (!activeKind) return new Set<string>();
    return new Set(expandedState[activeKind]);
  }, [activeKind, expandedState]);

  useEffect(() => {
    if (!activeKind || !activeEntryId) return;
    setExpandedState((prev) => {
      const current = new Set(prev[activeKind]);
      let changed = false;
      let cursor: string | null | undefined = activeEntryId;
      while (cursor) {
        if (!current.has(cursor)) {
          current.add(cursor);
          changed = true;
        }
        cursor = parentIndex.get(cursor) ?? null;
      }
      if (!changed) return prev;
      return { ...prev, [activeKind]: Array.from(current) };
    });
  }, [activeKind, activeEntryId, parentIndex]);

  useEffect(() => {
    if (!activeKind || !activeEntryId) {
      setContentState({ status: 'idle', html: '', fallback: false });
      return;
    }

    const cache = contentCacheRef.current[activeKind];
    const cached = cache.get(activeEntryId);
    if (cached) {
      setContentState({ status: 'ready', html: cached.html, fallback: cached.fallback });
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setContentState({ status: 'loading', html: '', fallback: false });

    fetch(contentUrl(activeKind, activeEntryId), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('未找到对应内容');
        }
        return response.text();
      })
      .then((html) => {
        if (!isMounted) return;
        cache.set(activeEntryId, { html, fallback: false });
        setContentState({ status: 'ready', html, fallback: false });
      })
      .catch(() => {
        if (!isMounted) return;
        const node = nodeIndex.get(activeEntryId);
        const placeholder = buildPlaceholder(node?.title ?? '文档建设中', node?.updated_at);
        cache.set(activeEntryId, { html: placeholder, fallback: true });
        setContentState({ status: 'ready', html: placeholder, fallback: true });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeKind, activeEntryId, nodeIndex]);

  useEffect(() => {
    if (contentState.status !== 'ready') return;
    const root = contentBodyRef.current;
    if (!root) return;

    const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[download]'));
    anchors.forEach((anchor) => {
      if (anchor.dataset.rendered === 'true') return;
      anchor.dataset.rendered = 'true';

      const fileName =
        anchor.getAttribute('download') ||
        (anchor.href ? anchor.href.split('/').pop() ?? '' : '') ||
        '资源文件';

      if (!anchor.textContent?.trim()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tutorial__download-button';
        button.textContent = `下载 ${fileName}`;
        button.addEventListener('click', () => anchor.click());

        const wrapper = document.createElement('div');
        wrapper.className = 'tutorial__download-button-wrapper';
        wrapper.appendChild(button);

        anchor.insertAdjacentElement('afterend', wrapper);
        anchor.classList.add('tutorial__download-anchor');
      }
    });
  }, [contentState]);

  const handleEntryClick = useCallback(
    (entryId: string) => {
      if (!activeKind) return;
      onNavigate(`${activeKind}/detail/${entryId}`);
    },
    [activeKind, onNavigate]
  );

  const handleToggleExpand = useCallback(
    (entryId: string) => {
      if (!activeKind) return;
      setExpandedState((prev) => {
        const current = new Set(prev[activeKind]);
        if (current.has(entryId)) {
          current.delete(entryId);
        } else {
          current.add(entryId);
        }
        return { ...prev, [activeKind]: Array.from(current) };
      });
    },
    [activeKind]
  );

  const breadcrumb = useMemo(() => {
    if (!activeKind || !activeEntryId) return [] as CatalogNode[];
    const path: CatalogNode[] = [];
    let cursor: string | null | undefined = activeEntryId;
    while (cursor) {
      const node = nodeIndex.get(cursor);
      if (!node) break;
      path.push(node);
      cursor = parentIndex.get(cursor) ?? null;
    }
    return path.reverse();
  }, [activeKind, activeEntryId, nodeIndex, parentIndex]);

  const activeTab = route.kind === 'landing' ? 'knowledge' : route.kind;

  return (
    <div className="tutorial">
      <header className="tutorial__header" style={{ height: '60px' }}>
        <div className="tutorial__header-left">
          <div className="tutorial__logo">
            <img src={LOGO_URL} alt="原神·千星奇域" />
          </div>
          <div className="tutorial__title">悠游千星，共筑奇域</div>
        </div>
        <div className="tutorial__header-actions">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={classNames('tutorial__tab', { 'is-active': activeTab === tab.key })}
              onClick={() => onNavigate(`${tab.key}`)}
            >
              <span className="tutorial__tab-label">{tab.label}</span>
              <span className="tutorial__tab-desc">{tab.description}</span>
            </button>
          ))}
          <button type="button" className="tutorial__close" onClick={onClose}>
            返回主页
          </button>
        </div>
      </header>

      {route.kind === 'landing' ? (
        <main className="tutorial__landing">
          <section className="tutorial__landing-title">
            <h1>综合指南</h1>
            <p>
              运行在本地的官方综合指南，灵感来源于{' '}
              <a href="https://milidocs.tiiny.site/" target="_blank" rel="noopener noreferrer">
                https://milidocs.tiiny.site/
              </a>
            </p>
          </section>
          <div className="tutorial__landing-cards">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className="tutorial__landing-card"
                onClick={() => onNavigate(`${tab.key}`)}
              >
                <h2>{tab.label}</h2>
                <p>{tab.description}</p>
                <span className="tutorial__landing-cta">进入 {tab.label}</span>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <div className="tutorial__body">
          <aside className="tutorial__catalog">
            <div className="tutorial__catalog-header">
              <h2>{activeKind === 'knowledge' ? '知识库目录' : '课程目录'}</h2>
              <p>共 {nodeIndex.size} 篇条目</p>
              <input
                className="tutorial__search"
                type="search"
                placeholder="搜索文档"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="tutorial__catalog-scroll">
              {isCatalogLoading && <div className="tutorial__catalog-empty">目录加载中...</div>}
              {catalogError && (
                <div className="tutorial__catalog-empty">
                  <p>{catalogError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeKind) return;
                      catalogCacheRef.current[activeKind] = null;
                      setCatalogReloadToken((token) => token + 1);
                    }}
                  >
                    重试
                  </button>
                </div>
              )}
              {!isCatalogLoading && !catalogError && filteredCatalog.length === 0 && (
                <div className="tutorial__catalog-empty">未找到匹配的条目</div>
              )}
              {!isCatalogLoading && !catalogError && filteredCatalog.length > 0 && (
                <nav className="tutorial__catalog-list" aria-label="教程目录">
                  {filteredCatalog.map((node) => (
                    <CatalogItem
                      key={node.real_id}
                      node={node}
                      depth={0}
                      activeId={activeEntryId}
                      forcedExpanded={Boolean(searchTerm)}
                      expandedIds={expandedIds}
                      onToggle={handleToggleExpand}
                      onSelect={handleEntryClick}
                    />
                  ))}
                </nav>
              )}
            </div>
          </aside>
          <section className="tutorial__content">
            <div className="tutorial__content-inner">
              <header className="tutorial__content-header">
                <div className="tutorial__breadcrumb">
                  {breadcrumb.map((node, index) => (
                    <span key={node.real_id}>
                      {node.title}
                      {index < breadcrumb.length - 1 && <span className="tutorial__breadcrumb-sep"> /</span>}
                    </span>
                  ))}
                </div>
                {activeEntryId && (
                  <div className="tutorial__meta">最近更新：{formatUpdatedAt(nodeIndex.get(activeEntryId)?.updated_at)}</div>
                )}
              </header>
              <div className="tutorial__content-body" ref={contentBodyRef}>
                {contentState.status === 'loading' && <div className="tutorial__content-loading">内容加载中...</div>}
                {contentState.status === 'ready' && (
                  <div
                    className={classNames('tutorial__content-html', { 'is-placeholder': contentState.fallback })}
                    dangerouslySetInnerHTML={{ __html: contentState.html }}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

interface CatalogItemProps {
  node: CatalogNode;
  depth: number;
  activeId: string | null;
  forcedExpanded: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

const CatalogItem = ({
  node,
  depth,
  activeId,
  forcedExpanded,
  expandedIds,
  onToggle,
  onSelect,
}: CatalogItemProps) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = forcedExpanded || expandedIds.has(node.real_id);
  const isActive = activeId === node.real_id;

  return (
    <div className="tutorial__catalog-item">
      <div
        className={classNames('tutorial__catalog-row', { 'is-active': isActive })}
        style={{ paddingLeft: depth * 16 + 12 }}
      >
        {hasChildren && (
          <button
            type="button"
            className={classNames('tutorial__catalog-toggle', { 'is-open': isExpanded })}
            onClick={() => onToggle(node.real_id)}
            aria-label={isExpanded ? '折叠章节' : '展开章节'}
          />
        )}
        <button type="button" className="tutorial__catalog-button" onClick={() => onSelect(node.real_id)}>
          {node.title}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="tutorial__catalog-children">
          {node.children.map((child) => (
            <CatalogItem
              key={child.real_id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              forcedExpanded={forcedExpanded}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TutorialPage;
