import { useMemo } from 'react';
import classNames from 'classnames';
import NodeLibrary from './NodeLibrary';
import { nodeDefinitions } from '../data/nodeDefinitions';
import { GRAPH_SYSTEM_NODE_IDS } from '../types/node';
import './NodePalette.css';

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  isTouchEnvironment?: boolean;
}

const SYSTEM_NODE_ID_SET = new Set<string>(GRAPH_SYSTEM_NODE_IDS as readonly string[]);

const NodePalette = ({ collapsed, onToggle, isTouchEnvironment = false }: NodePaletteProps) => {
  const filteredDefinitions = useMemo(
    () => nodeDefinitions.filter((definition) => !SYSTEM_NODE_ID_SET.has(definition.id)),
    []
  );

  return (
    <aside
      className={classNames('palette', { 'palette--collapsed': collapsed })}
      onContextMenu={(event) => event.preventDefault()}
      aria-expanded={!collapsed}
    >
      <button
        type="button"
        className={classNames('palette__toggle', { 'is-collapsed': collapsed })}
        onClick={onToggle}
        aria-label={collapsed ? '展开节点库' : '收起节点库'}
      >
        {collapsed ? '⇥' : '⇤'}
      </button>
      <div className="palette__content" aria-hidden={collapsed}>
        <NodeLibrary
          variant="sidebar"
          definitions={filteredDefinitions}
          onSelect={() => {}}
          isTouchEnvironment={isTouchEnvironment}
        />
      </div>
    </aside>
  );
};

export default NodePalette;
