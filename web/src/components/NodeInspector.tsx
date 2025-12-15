import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { nodeDefinitionsById } from '../data/nodeDefinitions';
import { useGraphStore } from '../state/graphStore';
import type { DataPortDefinition } from '../types/node';
import { useShallow } from 'zustand/react/shallow';
import { useI18n } from '../utils/i18nContext';
import { resolveNodeDefinitionDisplayName, resolvePortLabel } from '../utils/nodeText';
import './NodeInspector.css';

interface NodeInspectorProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NodeInspector = ({ collapsed, onToggle }: NodeInspectorProps) => {
  const { t, primaryLanguage, secondaryLanguage } = useI18n();
  const {
    nodes,
    edges,
    comments,
    selectedNodeId,
    updateNode,
    removeNode,
    setPortOverride,
    clearPortOverride,
    updateCommentText,
    setSelectedComment,
    setCommentCollapsed,
  } = useGraphStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      comments: state.comments,
      selectedNodeId: state.selectedNodeId,
      updateNode: state.updateNode,
      removeNode: state.removeNode,
      setPortOverride: state.setPortOverride,
      clearPortOverride: state.clearPortOverride,
      updateCommentText: state.updateCommentText,
      setSelectedComment: state.setSelectedComment,
      setCommentCollapsed: state.setCommentCollapsed,
    }))
  );

  const node = useMemo(
    () => nodes.find((item) => item.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const definition = node ? nodeDefinitionsById[node.type] : undefined;

  const nodeComments = useMemo(() => {
    if (!selectedNodeId) return [];
    return comments.filter((comment) => comment.nodeId === selectedNodeId);
  }, [comments, selectedNodeId]);

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

  const handleCommentTextChange =
    (commentId: string) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      updateCommentText(commentId, value);
      const textarea = event.currentTarget;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

  const content = isEmpty || !node || !definition ? (
    <>
      <h2 className="inspector__title">{t('inspector.title')}</h2>
      <p className="inspector__placeholder">{t('inspector.placeholder.selectNode')}</p>
    </>
  ) : (
    <>
      <header className="inspector__header">
        <h2 className="inspector__title">{t('inspector.title')}</h2>
        <button className="inspector__delete" onClick={() => removeNode(node.id)}>
          {t('inspector.deleteNode')}
        </button>
      </header>
      <section className="inspector__section">
        <label className="inspector__label">{t('inspector.definition')}</label>
        <div className="inspector__value">
          {resolveNodeDefinitionDisplayName(definition, primaryLanguage, secondaryLanguage)}
        </div>
        <div className="inspector__hint">{definition.id}</div>
      </section>
      <section className="inspector__section">
        <label className="inspector__label" htmlFor="node-name">
          {t('inspector.instanceName')}
        </label>
        <input
          id="node-name"
          className="inspector__input"
          placeholder={resolveNodeDefinitionDisplayName(definition, primaryLanguage, secondaryLanguage)}
          value={node.label ?? ''}
          onChange={handleLabelChange}
        />
        <div className="inspector__hint">{t('inspector.instanceName.hint')}</div>
      </section>
      <section className="inspector__section">
        <h3 className="inspector__subtitle">{t('inspector.dataInputDefaults')}</h3>
        <div className="inspector__controls">
          {definition.ports.filter((port) => port.kind === 'data-in').map((port) => {
            const dataPort = port as DataPortDefinition;
            const value = node.data?.overrides?.[dataPort.id];
            return (
              <label key={dataPort.id} className="inspector__control">
                <span>{resolvePortLabel(dataPort, primaryLanguage, secondaryLanguage)}</span>
                <input
                  className="inspector__input"
                  value={value === undefined ? '' : String(value)}
                  placeholder={
                    dataPort.defaultValue === undefined ? t('common.unset') : String(dataPort.defaultValue)
                  }
                  onChange={handleOverrideChange(node.id)(dataPort)}
                />
              </label>
            );
          })}
          {!definition.ports.some((port) => port.kind === 'data-in') && (
            <div className="inspector__hint">{t('inspector.dataInputDefaults.empty')}</div>
          )}
        </div>
      </section>
      <section className="inspector__section inspector__section--comments">
        <div className="inspector__comments-header">
          <h3 className="inspector__subtitle">{t('inspector.comments')}</h3>
        </div>
        {nodeComments.length ? (
          <ul className="inspector__comment-list">
            {nodeComments.map((comment) => {
              const lineCount = comment.text ? comment.text.split('\n').length : 1;
              const approxHeight = Math.min(180, Math.max(32, lineCount * 20));
              return (
                <li key={comment.id} className="inspector__comment-row">
                  <textarea
                    className="inspector__comment-item"
                    value={comment.text}
                    placeholder={t('inspector.comments.placeholder')}
                    rows={1}
                    style={{ height: `${approxHeight}px` }}
                    onFocus={(event) => {
                      event.currentTarget.style.height = 'auto';
                      event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                      setCommentCollapsed(comment.id, false);
                      setSelectedComment(comment.id);
                    }}
                    onChange={handleCommentTextChange(comment.id)}
                  />
                  {comment.pinned && <span className="inspector__comment-pin">📌</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="inspector__hint">{t('inspector.comments.empty')}</div>
        )}
      </section>

      <section className="inspector__section">
        <h3 className="inspector__subtitle">{t('inspector.connections')}</h3>
        <div className="inspector__connections">
          <div className="inspector__connections-group inspector__connections-group--inputs">
            <strong>{t('inspector.connections.inputs')}</strong>
            <ul>
              {incoming.map((edge) => (
                <li key={edge.id}>
                  {edge.source.nodeId} → {edge.target.portId}
                </li>
              ))}
              {!incoming.length && <li className="inspector__hint">{t('inspector.connections.inputs.empty')}</li>}
            </ul>
          </div>
          <div className="inspector__connections-group inspector__connections-group--outputs">
            <strong>{t('inspector.connections.outputs')}</strong>
            <ul>
              {outgoing.map((edge) => (
                <li key={edge.id}>
                  {edge.target.nodeId} ← {edge.source.portId}
                </li>
              ))}
              {!outgoing.length && <li className="inspector__hint">{t('inspector.connections.outputs.empty')}</li>}
            </ul>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <aside className={`inspector${collapsed ? ' inspector--collapsed' : ''}`}>
      <button className="inspector__toggle" onClick={onToggle}>
        {collapsed ? '⟵' : '⟶'}
      </button>
      <div className="inspector__content">{content}</div>
    </aside>
  );
};

export default NodeInspector;
