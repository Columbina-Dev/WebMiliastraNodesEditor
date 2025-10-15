import classNames from 'classnames';
import NodeLibrary from './NodeLibrary';
import { nodeDefinitions } from '../data/nodeDefinitions';
import './NodePalette.css';

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NodePalette = ({ collapsed, onToggle }: NodePaletteProps) => {
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
        <NodeLibrary variant="sidebar" definitions={nodeDefinitions} onSelect={() => {}} />
      </div>
    </aside>
  );
};

export default NodePalette;
