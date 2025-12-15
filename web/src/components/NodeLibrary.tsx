import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactElement, TouchEvent as ReactTouchEvent } from 'react';
import classNames from 'classnames';
import type { NodeDefinition, ValueType } from '../types/node';
import { NODE_LIBRARY_TOUCH_DRAG_EVENT, type NodeLibraryTouchDragDetail } from '../utils/touchDrag';
import type { UiLanguage } from '../utils/i18n';
import { useI18n } from '../utils/i18nContext';
import {
  getNodeDefinitionDisplayNameForLanguage,
  resolveNodeDefinitionDisplayName,
} from '../utils/nodeText';
import './NodeLibrary.css';

const ICON_EXECUTE = new URL('../assets/icons/execute.svg', import.meta.url).href;
const ICON_EVENT = new URL('../assets/icons/event.svg', import.meta.url).href;
const ICON_FLOW = new URL('../assets/icons/flow.svg', import.meta.url).href;
const ICON_QUERY = new URL('../assets/icons/query.svg', import.meta.url).href;
const ICON_LOGIC = new URL('../assets/icons/logic.svg', import.meta.url).href;
const ICON_SEARCH = new URL('../assets/icons/search.svg', import.meta.url).href;

type NodeLibraryVariant = 'sidebar' | 'floating';

type CategoryNode = {
  id: string;
  name: string;
  level: number;
  children: CategoryNode[];
  definitions: NodeDefinition[];
  count: number;
};

interface ValueTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
  requiredType?: ValueType;
}

interface NodeLibraryProps {
  title?: string;
  subtitle?: string;
  definitions: NodeDefinition[];
  onSelect: (definition: NodeDefinition) => void;
  onItemDragStart?: (
    event: DragEvent<HTMLButtonElement>,
    definition: NodeDefinition
  ) => void;
  filter?: (definition: NodeDefinition) => boolean;
  variant?: NodeLibraryVariant;
  valueTypeFilter?: ValueTypeFilterProps;
  isTouchEnvironment?: boolean;
  autoFocusSearch?: boolean;
  allowSearchAllLanguageNodeNames?: boolean;
}

const GROUP_META: Record<string, { icon: string; color: string }> = {
  '执行节点': { icon: ICON_EXECUTE, color: '#a2c940' },
  '事件节点': { icon: ICON_EVENT, color: '#ff5c96' },
  '流程控制节点': { icon: ICON_FLOW, color: '#ff9850' },
  '查询节点': { icon: ICON_QUERY, color: '#5169ff' },
  '运算节点': { icon: ICON_LOGIC, color: '#1976d2' },
};

// 弃用：选择值类型过滤器
// const VALUE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
//   { value: 'all', label: '全部类型' },
//   { value: 'any', label: '泛型' },
//   { value: 'string', label: '字符串' },
//   { value: 'guid', label: 'GUID' },
//   { value: 'entity', label: '实体' },
//   { value: 'vector3', label: '三维向量' },
//   { value: 'camp', label: '阵营' },
//   { value: 'int', label: '整数' },
//   { value: 'float', label: '浮点数' },
//   { value: 'bool', label: '布尔' },
//   { value: 'list', label: '列表' },
//   { value: 'configId', label: '配置ID' },
//   { value: 'componentId', label: '组件ID' },
// ];

const TOUCH_DRAG_START_THRESHOLD = 12;

const buildTree = (definitions: NodeDefinition[]): CategoryNode[] => {
  const root: CategoryNode = {
    id: '',
    name: '',
    level: -1,
    children: [],
    definitions: [],
    count: 0,
  };

  const ensureChild = (parent: CategoryNode, name: string, level: number) => {
    let child = parent.children.find((node) => node.name === name);
    if (!child) {
      child = {
        id: parent.id ? parent.id + '/' + name : name,
        name,
        level,
        children: [],
        definitions: [],
        count: 0,
      };
      parent.children.push(child);
    }
    return child;
  };

  definitions.forEach((definition) => {
    const segments = definition.category.split('/');
    let node = root;
    segments.forEach((segment, index) => {
      node = ensureChild(node, segment, index);
    });
    node.definitions.push(definition);
  });

  const computeCounts = (node: CategoryNode): number => {
    const childTotal = node.children.reduce(
      (total, child) => total + computeCounts(child),
      0
    );
    node.count = childTotal + node.definitions.length;
    return node.count;
  };

  computeCounts(root);
  return root.children;
};

const NodeLibrary = ({
  title,
  subtitle,
  definitions,
  onSelect,
  onItemDragStart,
  filter,
  variant = 'sidebar',
  isTouchEnvironment = false,
  autoFocusSearch = false,
  allowSearchAllLanguageNodeNames = false,
}: NodeLibraryProps) => {
  const { t, primaryLanguage, secondaryLanguage } = useI18n();
  const [search, setSearch] = useState('');
  // start collapsed by default
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const prevVariantRef = useRef<NodeLibraryVariant>(variant);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const touchDragStateRef = useRef<{
    identifier: number;
    definitionId: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
  } | null>(null);

  const dispatchTouchDragEvent = useCallback(
    (detail: NodeLibraryTouchDragDetail) => {
      window.dispatchEvent(
        new CustomEvent<NodeLibraryTouchDragDetail>(NODE_LIBRARY_TOUCH_DRAG_EVENT, {
          detail,
        })
      );
    },
    []
  );

  const { filteredDefinitions, displayNameById, matchNameById } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const displayNameById = new Map<string, string>();
    const matchNameById = new Map<string, string>();
    const candidateLanguageOrder: UiLanguage[] = ['eng', 'cht', 'jpn', 'chs'];

    const filteredDefinitions = definitions.filter((definition) => {
      if (filter && !filter(definition)) return false;

      const resolvedName = resolveNodeDefinitionDisplayName(
        definition,
        primaryLanguage,
        secondaryLanguage,
      );
      displayNameById.set(definition.id, resolvedName);

      if (!term) return true;

      const matches = (value: string | undefined) =>
        value ? value.toLowerCase().includes(term) : false;

      if (matches(resolvedName) || matches(definition.category) || matches(definition.id)) {
        return true;
      }

      if (!allowSearchAllLanguageNodeNames) {
        return false;
      }

      for (const language of candidateLanguageOrder) {
        const candidate = getNodeDefinitionDisplayNameForLanguage(definition, language);
        if (!candidate) continue;
        if (!matches(candidate)) continue;
        if (candidate.toLowerCase() !== resolvedName.toLowerCase()) {
          matchNameById.set(definition.id, candidate);
        }
        return true;
      }

      return false;
    });

    return { filteredDefinitions, displayNameById, matchNameById };
  }, [
    allowSearchAllLanguageNodeNames,
    definitions,
    filter,
    primaryLanguage,
    secondaryLanguage,
    search,
  ]);

  const tree = useMemo(() => buildTree(filteredDefinitions), [filteredDefinitions]);

  const handleDefinitionTouchStart = (
    event: ReactTouchEvent<HTMLButtonElement>,
    definition: NodeDefinition
  ) => {
    if (!isTouchEnvironment) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchDragStateRef.current = {
      identifier: touch.identifier,
      definitionId: definition.id,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      dragging: false,
    };
  };

  useEffect(() => {
    if (!isTouchEnvironment) {
      touchDragStateRef.current = null;
      return;
    }

    const handleTouchMove = (event: TouchEvent) => {
      const state = touchDragStateRef.current;
      if (!state) return;
      const touch = Array.from(event.touches).find(
        (item) => item.identifier === state.identifier
      );
      if (!touch) return;

      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const distance = Math.hypot(dx, dy);
      if (!state.dragging && distance > TOUCH_DRAG_START_THRESHOLD) {
        state.dragging = true;
        dispatchTouchDragEvent({
          phase: 'start',
          definitionId: state.definitionId,
          clientX: state.startX,
          clientY: state.startY,
        });
      }
      if (state.dragging) {
        event.preventDefault();
        state.lastX = touch.clientX;
        state.lastY = touch.clientY;
        dispatchTouchDragEvent({
          phase: 'move',
          definitionId: state.definitionId,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const state = touchDragStateRef.current;
      if (!state) return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === state.identifier
      );
      if (!touch) return;
      if (state.dragging) {
        event.preventDefault();
        dispatchTouchDragEvent({
          phase: 'end',
          definitionId: state.definitionId,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }
      touchDragStateRef.current = null;
    };

    const handleTouchCancel = (event: TouchEvent) => {
      const state = touchDragStateRef.current;
      if (!state) return;
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === state.identifier
      );
      if (!touch) return;
      if (state.dragging) {
        dispatchTouchDragEvent({
          phase: 'cancel',
          definitionId: state.definitionId,
          clientX: state.lastX,
          clientY: state.lastY,
        });
      }
      touchDragStateRef.current = null;
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      touchDragStateRef.current = null;
    };
  }, [dispatchTouchDragEvent, isTouchEnvironment]);


  useEffect(() => {
    // keep collapsed by default; if tree becomes empty, clear expanded set
    if (!tree.length) {
      setExpanded(new Set());
    }
    prevVariantRef.current = variant;
  }, [tree, variant]);
  useEffect(() => {
    if (variant !== 'floating' || !autoFocusSearch) return;
    const raf = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [autoFocusSearch, variant]);

  const handleSelect = (definition: NodeDefinition) => {
    onSelect(definition);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStartInternal = (
    event: DragEvent<HTMLButtonElement>,
    definition: NodeDefinition
  ) => {
    event.dataTransfer.setData('application/x-node-type', definition.id);
    event.dataTransfer.effectAllowed = 'copy';
    onItemDragStart?.(event, definition);
  };

  const renderDefinitions = (items: NodeDefinition[]) => (
    <div className="node-library__definitions">
      {items.map((definition) => (
        <button
          type="button"
          key={definition.id}
          className="node-library__definition"
          onClick={() => handleSelect(definition)}
          draggable
          onTouchStart={(event) => handleDefinitionTouchStart(event, definition)}
          onDragStart={(event) => handleDragStartInternal(event, definition)}
        >
          <span className="node-library__definition-dot" />
          <span className="node-library__definition-name">
            {displayNameById.get(definition.id) ?? definition.displayName}
          </span>
          {matchNameById.has(definition.id) && (
            <span className="node-library__definition-match">
              ({matchNameById.get(definition.id)})
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const renderCategory = (node: CategoryNode, depth = 0): ReactElement => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0 || node.definitions.length > 0;
    const groupMeta = depth === 0 ? GROUP_META[node.name] : undefined;

    return (
      <div key={node.id} className="node-library__category" data-depth={depth}>
        <button
          type="button"
          className="node-library__category-header"
          onClick={() => hasChildren && toggleExpanded(node.id)}
        >
          <span className={classNames('node-library__caret', { 'is-open': isExpanded })}>
            {hasChildren ? '' : '?'}
          </span>
          {groupMeta && (
            <img className="node-library__icon" src={groupMeta.icon} alt="" aria-hidden="true" />
          )}
          <span className="node-library__name">{node.name}</span>
          <span className="node-library__count">{node.count}</span>
        </button>
        {isExpanded && hasChildren && (
          <div className="node-library__category-body">
            {node.children.map((child) => renderCategory(child, depth + 1))}
            {node.definitions.length > 0 && renderDefinitions(node.definitions)}
          </div>
        )}
      </div>
    );
  };

  const libraryClassName = classNames(
    'node-library',
    variant === 'floating' ? 'node-library--floating' : 'node-library--sidebar'
  );

  const resolvedTitle = title ?? t('nodeLibrary.title');

  return (
    <div className={libraryClassName}>
      <div className="node-library__header">
        <div>
          <div className="node-library__title">{resolvedTitle}</div>
          {subtitle && <div className="node-library__subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="node-library__search">
        <img src={ICON_SEARCH} className="node-library__search-icon" alt="" aria-hidden="true" />
        <input
          ref={searchInputRef}
          value={search}
          placeholder={t('nodeLibrary.search.placeholder')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="node-library__content">
        {tree.length === 0 ? (
          <div className="node-library__empty">{t('nodeLibrary.search.empty')}</div>
        ) : (
          tree.map((category) => renderCategory(category))
        )}
      </div>
    </div>
  );
};

export default NodeLibrary;




