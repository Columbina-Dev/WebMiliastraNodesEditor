import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactElement } from 'react';
import classNames from 'classnames';
import type { NodeDefinition, ValueType } from '../types/node';
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
}

const GROUP_META: Record<string, { icon: string; color: string }> = {
  '执行节点': { icon: ICON_EXECUTE, color: '#a2c940' },
  '事件节点': { icon: ICON_EVENT, color: '#ff5c96' },
  '流程控制节点': { icon: ICON_FLOW, color: '#ff9850' },
  '查询节点': { icon: ICON_QUERY, color: '#5169ff' },
  '运算节点': { icon: ICON_LOGIC, color: '#1976d2' },
};

const VALUE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部类型' },
  { value: 'any', label: '泛型' },
  { value: 'string', label: '字符串' },
  { value: 'guid', label: 'GUID' },
  { value: 'entity', label: '实体' },
  { value: 'vector3', label: '三维向量' },
  { value: 'camp', label: '阵营' },
  { value: 'int', label: '整数' },
  { value: 'float', label: '浮点数' },
  { value: 'bool', label: '布尔' },
  { value: 'list', label: '列表' },
  { value: 'configId', label: '配置ID' },
  { value: 'componentId', label: '组件ID' },
];

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
  title = '节点库',
  subtitle,
  definitions,
  onSelect,
  onItemDragStart,
  filter,
  variant = 'sidebar',
  valueTypeFilter,
}: NodeLibraryProps) => {
  const [search, setSearch] = useState('');
  // start collapsed by default
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const prevVariantRef = useRef<NodeLibraryVariant>(variant);

  const filteredDefinitions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return definitions.filter((definition) => {
      if (filter && !filter(definition)) return false;
      if (!term) return true;
      const haystack = (' ' + definition.displayName + ' ' + definition.category + ' ' + definition.id).toLowerCase();
      return haystack.includes(term);
    });
  }, [definitions, filter, search]);

  const tree = useMemo(() => buildTree(filteredDefinitions), [filteredDefinitions]);


  useEffect(() => {
    // keep collapsed by default; if tree becomes empty, clear expanded set
    if (!tree.length) {
      setExpanded(new Set());
    }
    prevVariantRef.current = variant;
  }, [tree, variant]);

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
          onDragStart={(event) => handleDragStartInternal(event, definition)}
        >
          <span className="node-library__definition-dot" />
          <span className="node-library__definition-name">{definition.displayName}</span>
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
            {hasChildren ? '' : '•'}
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

  return (
    <div className={libraryClassName}>
      <div className="node-library__header">
        <div>
          <div className="node-library__title">{title}</div>
          {subtitle && <div className="node-library__subtitle">{subtitle}</div>}
        </div>
        {valueTypeFilter && (
          <div className="node-library__filter">
            <select
              value={valueTypeFilter.value}
              onChange={(event) => valueTypeFilter.onChange(event.target.value)}
            >
              {VALUE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {valueTypeFilter.requiredType && (
              <span className="node-library__filter-hint">
                推荐：                {
                  VALUE_TYPE_OPTIONS.find((option) => option.value === valueTypeFilter.requiredType)?.label ||
                  valueTypeFilter.requiredType
                }
              </span>
            )}
          </div>
        )}
      </div>
      <div className="node-library__search">
        <img src={ICON_SEARCH} className="node-library__search-icon" alt="" aria-hidden="true" />
        <input
          value={search}
          placeholder="搜索节点或分类"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="node-library__content">
        {tree.length === 0 ? (
          <div className="node-library__empty">未找到匹配的节点</div>
        ) : (
          tree.map((category) => renderCategory(category))
        )}
      </div>
    </div>
  );
};

export default NodeLibrary;










