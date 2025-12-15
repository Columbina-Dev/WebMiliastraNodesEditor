import { useMemo } from 'react';
import classNames from 'classnames';
import NodeLibrary from './NodeLibrary';
import { useGraphStore } from '../state/graphStore';
import { getNodeDefinitionsForEnvironment } from '../utils/nodeAvailability';
import { useI18n } from '../utils/i18nContext';
import './NodePalette.css';

interface NodePaletteProps {
  collapsed: boolean;
  onToggle: () => void;
  isTouchEnvironment?: boolean;
  allowSearchAllLanguageNodeNames?: boolean;
}

const NodePalette = ({
  collapsed,
  onToggle,
  isTouchEnvironment = false,
  allowSearchAllLanguageNodeNames = false,
}: NodePaletteProps) => {
  const { t } = useI18n();
  const environment = useGraphStore((state) => state.environment);
  const filteredDefinitions = useMemo(
    () => getNodeDefinitionsForEnvironment(environment, { includeSystem: false }),
    [environment]
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
        aria-label={collapsed ? t('nodeLibrary.expand') : t('nodeLibrary.collapse')}
      >
        {collapsed ? '⇥' : '⇤'}
      </button>
      <div className="palette__content" aria-hidden={collapsed}>
        <NodeLibrary
          variant="sidebar"
          definitions={filteredDefinitions}
          onSelect={() => {}}
          isTouchEnvironment={isTouchEnvironment}
          allowSearchAllLanguageNodeNames={allowSearchAllLanguageNodeNames}
        />
      </div>
    </aside>
  );
};

export default NodePalette;
