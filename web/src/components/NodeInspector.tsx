import classNames from 'classnames';
import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { nodeDefinitionsById } from '../data/nodeDefinitions';
import { useGraphStore } from '../state/graphStore';
import type { DataPortDefinition } from '../types/node';
import './NodeInspector.css';

interface NodeInspectorProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NodeInspector = ({ collapsed, onToggle }: NodeInspectorProps) => {
  const node = useGraphStore((state) => state.nodes.find((item) => item.id === state.selectedNodeId));
  const edges = useGraphStore((state) => state.edges);
  const updateNode = useGraphStore((state) => state.updateNode);
  const removeNode = useGraphStore((state) => state.removeNode);
  const setPortOverride = useGraphStore((state) => state.setPortOverride);
  const clearPortOverride = useGraphStore((state) => state.clearPortOverride);

  const definition = node ? nodeDefinitionsById[node.type] : undefined;

  const outgoing = useMemo(() => {
    if (!node) return [];
    return edges.filter((edge) => edge.source.nodeId === node.id);
  }, [edges, node]);

  const incoming = useMemo(() => {
    if (!node) return [];
    return edges.filter((edge) => edge.target.nodeId === node.id);
  }, [edges, node]);

  const isEmpty = !node || !definition;

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!node) return;
    updateNode(node.id, (prev) => ({ ...prev, label: value ? value : undefined }));
  };

  const handleOverrideChange = (nodeId: string) => (port: DataPortDefinition) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (!value) {
        clearPortOverride(nodeId, port.id);
        return;
      }
      if (port.valueType === 'int') {
        setPortOverride(nodeId, port.id, Number.parseInt(value, 10));
      } else if (port.valueType === 'float') {
        setPortOverride(nodeId, port.id, Number.parseFloat(value));
      } else if (port.valueType === 'bool') {
        setPortOverride(nodeId, port.id, value === 'true');
      } else {
        setPortOverride(nodeId, port.id, value);
      }
    };

  const content = isEmpty || !node || !definition ? (
    <>
      <h2 className="inspector__title">节点详情</h2>
      <p className="inspector__placeholder">选择画布中的节点查看详细信息</p>
    </>
  ) : (
    <>
      <header className="inspector__header">
        <h2 className="inspector__title">节点详情</h2>
        <button className="inspector__delete" onClick={() => removeNode(node.id)}>
          删除节点
        </button>
      </header>
      <section className="inspector__section">
        <label className="inspector__label">定义</label>
        <div className="inspector__value">{definition.displayName}</div>
        <div className="inspector__hint">{definition.id}</div>
      </section>
      <section className="inspector__section">
        <label className="inspector__label" htmlFor="node-name">
          节点实例名称
        </label>
        <input
          id="node-name"
          className="inspector__input"
          placeholder={definition.displayName}
          value={node.label ?? ''}
          onChange={handleLabelChange}
        />
        <div className="inspector__hint">留空则继承定义名称</div>
      </section>
      <section className="inspector__section">
        <h3 className="inspector__subtitle">数据输入默认值</h3>
        <div className="inspector__controls">
          {definition.ports.filter((port) => port.kind === 'data-in').map((port) => {
            const dataPort = port as DataPortDefinition;
            const value = node.data?.overrides?.[dataPort.id];
            return (
              <label key={dataPort.id} className="inspector__control">
                <span>{dataPort.label}</span>
                <input
                  className="inspector__input"
                  value={value === undefined ? '' : String(value)}
                  placeholder={dataPort.defaultValue === undefined ? '未设置' : String(dataPort.defaultValue)}
                  onChange={handleOverrideChange(node.id)(dataPort)}
                />
              </label>
            );
          })}
          {!definition.ports.some((port) => port.kind === 'data-in') && (
            <div className="inspector__hint">该节点没有可配置的数据输入</div>
          )}
        </div>
      </section>
      <section className="inspector__section">
        <h3 className="inspector__subtitle">连接</h3>
        <div className="inspector__connections">
          <div className="inspector__connections-group inspector__connections-group--inputs">
            <strong>输入</strong>
            <ul>
              {incoming.map((edge) => (
                <li key={edge.id}>
                  {edge.source.nodeId} → {edge.target.portId}
                </li>
              ))}
              {!incoming.length && <li className="inspector__hint">无输入连接</li>}
            </ul>
          </div>
          <div className="inspector__connections-group inspector__connections-group--outputs">
            <strong>输出</strong>
            <ul>
              {outgoing.map((edge) => (
                <li key={edge.id}>
                  {edge.target.nodeId} ← {edge.source.portId}
                </li>
              ))}
              {!outgoing.length && <li className="inspector__hint">无输出连接</li>}
            </ul>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <aside
      className={classNames('inspector', {
        'inspector--collapsed': collapsed,
        'inspector--empty': isEmpty,
      })}
      aria-expanded={!collapsed}
    >
      <button
        type="button"
        className={classNames('inspector__toggle', { 'is-collapsed': collapsed })}
        onClick={onToggle}
        aria-label={collapsed ? '展开检查面板' : '收起检查面板'}
      >
        {collapsed ? '⇤' : '⇥'}
      </button>
      <div className="inspector__content" aria-hidden={collapsed}>
        {content}
      </div>
    </aside>
  );
};

export default NodeInspector;
