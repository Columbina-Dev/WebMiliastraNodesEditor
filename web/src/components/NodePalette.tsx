import { useMemo } from 'react';
import classNames from 'classnames';
import NodeLibrary from './NodeLibrary';
import { nodeDefinitions } from '../data/nodeDefinitions';
import { CLIENT_GRAPH_START_NODE_ID } from '../types/node';
import './NodePalette.css';

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  isTouchEnvironment?: boolean;
}

const NodePalette = ({ collapsed, onToggle, isTouchEnvironment = false }: NodePaletteProps) => {
  const filteredDefinitions = useMemo(
    () => nodeDefinitions.filter((definition) => definition.id !== CLIENT_GRAPH_START_NODE_ID),
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
