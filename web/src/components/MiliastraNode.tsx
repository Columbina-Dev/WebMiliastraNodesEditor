import { memo, useMemo, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import classNames from 'classnames';
import type {
  ConnectionPreview,
  DataPortDefinition,
  NodeDefinition,
  PortDefinition,
} from '../types/node';
import { useGraphStore } from '../state/graphStore';
import { canConnectPorts, isDataPort, isFlowPort } from '../utils/graph';
import {
  MAX_BRANCH_FLOW_OUTS,
  MAX_SEQUENCE_FLOW_OUTS,
  MULTI_BRANCH_NODE_ID,
  SEQUENCE_NODE_ID,
  parseBranchFlowOutIndex,
  parseSequenceFlowOutIndex,
} from '../utils/dynamicFlowOuts';
import { useI18n } from '../utils/i18nContext';
import { resolveNodeDefinitionDisplayName, resolvePortLabel, resolvePortPlaceholder } from '../utils/nodeText';
const ICON_EVENT = new URL('../assets/icons/event-stroke.svg', import.meta.url).href;
const ICON_EXECUTE = new URL('../assets/icons/execute-stroke.svg', import.meta.url).href;
const ICON_FLOW = new URL('../assets/icons/flow-stroke.svg', import.meta.url).href;
const ICON_QUERY = new URL('../assets/icons/query-stroke.svg', import.meta.url).href;
const ICON_LOGIC = new URL('../assets/icons/logic-stroke.svg', import.meta.url).href;
import './MiliastraNode.css';

type NodeStyle = React.CSSProperties & {
  '--miliastra-header-color'?: string;
  '--miliastra-header-bg'?: string;
};

type Vector3Value = { x: number; y: number; z: number };

export interface MiliastraNodeData {
  nodeId: string;
  definition: NodeDefinition;
  ports: PortDefinition[];
  label?: string;
  overrides?: Record<string, unknown>;
  controls?: Record<string, unknown>;
  sequenceFlowOutCount?: number;
  branchFlowOutLabels?: string[];
  connectionPreview?: ConnectionPreview | null;
  onPortContextMenu?: (event: ReactMouseEvent, portId: string) => void;
}

const vector3From = (value: unknown): Vector3Value => {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return {
      x: typeof record.x === 'number' ? record.x : 0,
      y: typeof record.y === 'number' ? record.y : 0,
      z: typeof record.z === 'number' ? record.z : 0,
    } satisfies Vector3Value;
  }
  return { x: 0, y: 0, z: 0 } satisfies Vector3Value;
};

const formatValue = (port: DataPortDefinition, value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }
  switch (port.valueType) {
    case 'bool':
      return String(value);
    case 'float':
    case 'int':
      return typeof value === 'number' ? String(value) : String(Number(value));
    default:
      return String(value);
  }
};

const parseValue = (port: DataPortDefinition, value: string): unknown => {
  if (value === '') {
    return undefined;
  }
  switch (port.valueType) {
    case 'bool':
      return value === 'true';
    case 'int':
      return Number.parseInt(value, 10);
    case 'float':
      return Number.parseFloat(value);
    default:
      return value;
  }
};

const MiliastraNode = memo((props: NodeProps<MiliastraNodeData>) => {
  const { data, selected } = props;
  const { t, primaryLanguage, secondaryLanguage } = useI18n();
  const setOverride = useGraphStore((state) => state.setPortOverride);
  const clearOverride = useGraphStore((state) => state.clearPortOverride);
  const addSequenceFlowOut = useGraphStore((state) => state.addSequenceFlowOut);
  const removeSequenceFlowOut = useGraphStore((state) => state.removeSequenceFlowOut);
  const addBranchFlowOut = useGraphStore((state) => state.addBranchFlowOut);
  const removeBranchFlowOut = useGraphStore((state) => state.removeBranchFlowOut);
  const setBranchFlowOutLabel = useGraphStore((state) => state.setBranchFlowOutLabel);

  const {
    definition,
    label,
    overrides,
    connectionPreview,
    ports,
    branchFlowOutLabels,
    onPortContextMenu,
  } = data;

  const handleInputChange = (port: DataPortDefinition) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const raw = event.target.value;
    const parsed = parseValue(port, raw);
    if (parsed === undefined) {
      clearOverride(data.nodeId, port.id);
    } else {
      setOverride(data.nodeId, port.id, parsed);
    }
  };

  const valueForPort = (port: DataPortDefinition) => {
    const override = overrides?.[port.id];
    if (override !== undefined) {
      if (port.valueType === 'vector3') {
        return vector3From(override);
      }
      return override;
    }
    if (port.valueType === 'vector3') {
      return vector3From(port.defaultValue);
    }
    return port.defaultValue;
  };

  const headerColor = definition.headerColor ?? '#5c5fef';
  const iconForKind: Record<NodeDefinition['kind'], string> = {
    event: ICON_EVENT,
    action: ICON_EXECUTE,
    'flow-control': ICON_FLOW,
    query: ICON_QUERY,
    math: ICON_LOGIC,
    logic: ICON_LOGIC,
    data: ICON_LOGIC,
  };
  const nodeIcon = iconForKind[definition.kind] ?? ICON_LOGIC;
  const nodeStyle: NodeStyle = {};
  // support either a plain color or a CSS gradient string
  if (typeof headerColor === 'string' && headerColor.trim().startsWith('linear-gradient')) {
    nodeStyle['--miliastra-header-color'] = undefined;
    nodeStyle['--miliastra-header-bg'] = headerColor;
  } else {
    nodeStyle['--miliastra-header-color'] = headerColor;
    nodeStyle['--miliastra-header-bg'] = undefined;
  }

  const isSequenceNode = definition.id === SEQUENCE_NODE_ID;
  const isMultiBranchNode = definition.id === MULTI_BRANCH_NODE_ID;
  const effectiveBranchLabels = (branchFlowOutLabels ?? []).slice(0, MAX_BRANCH_FLOW_OUTS);

  const compatibilityMap = useMemo(() => {
    if (!connectionPreview) return null;
    const result = new Map<string, boolean>();
    ports.forEach((port) => {
      let compatible = false;
      if (
        connectionPreview.nodeId === data.nodeId &&
        connectionPreview.port.id === port.id
      ) {
        compatible = true;
      } else if (connectionPreview.handleType === 'source') {
        compatible = canConnectPorts(connectionPreview.port, port);
      } else {
        compatible = canConnectPorts(port, connectionPreview.port);
      }
      result.set(port.id, compatible);
    });
    return result;
  }, [connectionPreview, data.nodeId, ports]);

  const partitionedPorts = useMemo(() => {
    const flowIn: PortDefinition[] = [];
    const flowOut: PortDefinition[] = [];
    const dataIn: DataPortDefinition[] = [];
    const dataOut: DataPortDefinition[] = [];
    ports.forEach((port) => {
      if (port.kind === 'flow-in') flowIn.push(port);
      else if (port.kind === 'flow-out') flowOut.push(port);
      else if (port.kind === 'data-in') dataIn.push(port as DataPortDefinition);
      else if (port.kind === 'data-out') dataOut.push(port as DataPortDefinition);
    });
    return { flowIn, flowOut, dataIn, dataOut };
  }, [ports]);

  const branchFlowOutPorts = useMemo(() => {
    if (!isMultiBranchNode) return [];
    return partitionedPorts.flowOut.filter((port) => parseBranchFlowOutIndex(port.id));
  }, [isMultiBranchNode, partitionedPorts.flowOut]);

  const flowRows = useMemo(() => {
    const flowOutPorts = isMultiBranchNode
      ? partitionedPorts.flowOut.filter((port) => !parseBranchFlowOutIndex(port.id))
      : partitionedPorts.flowOut;
    const count = Math.max(partitionedPorts.flowIn.length, flowOutPorts.length);
    return Array.from({ length: count }, (_, index) => ({
      left: partitionedPorts.flowIn[index] ?? null,
      right: flowOutPorts[index] ?? null,
    }));
  }, [isMultiBranchNode, partitionedPorts.flowIn, partitionedPorts.flowOut]);

  const dataRows = useMemo(() => {
    const count = Math.max(partitionedPorts.dataIn.length, partitionedPorts.dataOut.length);
    return Array.from({ length: count }, (_, index) => ({
      left: partitionedPorts.dataIn[index] ?? null,
      right: partitionedPorts.dataOut[index] ?? null,
    }));
  }, [partitionedPorts.dataIn, partitionedPorts.dataOut]);

  const sequenceFlowOutCount = isSequenceNode ? partitionedPorts.flowOut.length : 0;
  const canAddSequenceFlowOut = isSequenceNode && sequenceFlowOutCount < MAX_SEQUENCE_FLOW_OUTS;
  const canAddBranchFlowOut =
    isMultiBranchNode && branchFlowOutPorts.length < MAX_BRANCH_FLOW_OUTS;

  const renderHandle = (
    port: PortDefinition,
    position: Position,
    extraClassName?: string
  ) => {
    const isDisabled =
      compatibilityMap && compatibilityMap.has(port.id)
        ? !compatibilityMap.get(port.id)
        : false;
    const classes = classNames('miliastra-handle', extraClassName, {
      'is-flow': isFlowPort(port),
      'is-data': isDataPort(port),
      'is-input': port.kind === 'flow-in' || port.kind === 'data-in',
      'is-output': port.kind === 'flow-out' || port.kind === 'data-out',
      'is-disabled': isDisabled,
      'is-previewing': Boolean(compatibilityMap),
    });
    return (
      <Handle
        id={port.id}
        key={`${port.id}-${position}`}
        type={position === Position.Left ? 'target' : 'source'}
        position={position}
        data-port-kind={port.kind}
        data-value-type={isDataPort(port) ? port.valueType : undefined}
        className={classes}
        isConnectable={!isDisabled}
      />
    );
  };

  const renderPortLabel = (port: PortDefinition) => (
    <span className="miliastra-port__label">
      {resolvePortLabel(port, primaryLanguage, secondaryLanguage)}
      {port.ui?.accessory === 'gear' && (
        <span className="miliastra-port__badge" aria-hidden="true">
          ⚙
        </span>
      )}
    </span>
  );

  const getPortContextMenuHandler = (port: PortDefinition) => {
    if (!onPortContextMenu) return undefined;
    const sequenceIndex = isSequenceNode ? parseSequenceFlowOutIndex(port.id) : null;
    const branchIndex = isMultiBranchNode ? parseBranchFlowOutIndex(port.id) : null;
    if (sequenceIndex == null && branchIndex == null) return undefined;
    return (event: ReactMouseEvent) => onPortContextMenu(event, port.id);
  };

  const renderVector3Control = (port: DataPortDefinition) => {
    const value = valueForPort(port) as Vector3Value;
      const axes: Array<{ key: keyof Vector3Value; label: string }> = [
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
      { key: 'z', label: 'Z' },
    ];
    return (
      <div className="miliastra-vector3">
        {axes.map((axis) => (
          <label key={axis.key} className="miliastra-vector3__axis">
            <span>{axis.label}</span>
            <input
              className="miliastra-port__control"
              type="number"
              value={String(value[axis.key] ?? 0)}
              onChange={(event) => {
                const raw = event.target.value;
                const parsed = Number.parseFloat(raw);
                const next = {
                  ...vector3From(overrides?.[port.id] ?? port.defaultValue),
                  [axis.key]: Number.isNaN(parsed) ? 0 : parsed,
                } satisfies Vector3Value;
                setOverride(data.nodeId, port.id, next);
              }}
            />
          </label>
        ))}
      </div>
    );
  };

  const renderDataIn = (port: DataPortDefinition | null) => {
    if (!port) return <div className="miliastra-port-placeholder" />;
    if (port.valueType === 'vector3') {
      return (
        <div className="miliastra-port miliastra-port--data-in" key={port.id}>
          {renderHandle(port, Position.Left)}
          <div className="miliastra-port__content">
            {renderPortLabel(port)}
            {renderVector3Control(port)}
          </div>
        </div>
      );
    }
    const value = valueForPort(port);
    return (
      <div className="miliastra-port miliastra-port--data-in" key={port.id}>
        {renderHandle(port, Position.Left)}
        <div className="miliastra-port__content">
          {renderPortLabel(port)}
          {port.enumValues ? (
            <select
              className="miliastra-port__control"
              value={value === undefined ? '' : String(value)}
              onChange={handleInputChange(port)}
            >
              <option value="">{t('common.unset')}</option>
              {port.enumValues.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : port.valueType === 'bool' ? (
            <select
              className="miliastra-port__control"
              value={value === undefined ? '' : String(value)}
              onChange={handleInputChange(port)}
            >
              <option value="">{t('common.unset')}</option>
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          ) : (
            <input
              className="miliastra-port__control"
              type={port.valueType === 'int' || port.valueType === 'float' ? 'number' : 'text'}
              value={formatValue(port, value)}
              placeholder={
                resolvePortPlaceholder(port, primaryLanguage, secondaryLanguage) ?? t('common.enterValue')
              }
              onChange={handleInputChange(port)}
            />
          )}
        </div>
      </div>
    );
  };

  const renderDataOut = (port: DataPortDefinition | null) => {
    if (!port) return <div className="miliastra-port-placeholder" />;
    return (
      <div className="miliastra-port miliastra-port--data-out" key={port.id}>
        <div className="miliastra-port__content miliastra-port__content--right">
          {renderPortLabel(port)}
        </div>
        {renderHandle(port, Position.Right)}
      </div>
    );
  };

  const renderFlowIn = (port: PortDefinition | null) => {
    if (!port) return <div className="miliastra-port-placeholder" />;
    return (
      <div className="miliastra-port miliastra-port--flow-in" key={port.id}>
        {renderHandle(port, Position.Left)}
        {renderPortLabel(port)}
      </div>
    );
  };

  const renderFlowOut = (
    port: PortDefinition | null,
    options?: {
      hideLabel?: boolean;
      onDelete?: () => void;
      deleteDisabled?: boolean;
      onContextMenu?: (event: ReactMouseEvent) => void;
    }
  ) => {
    if (!port) return <div className="miliastra-port-placeholder" />;
    return (
      <div
        className="miliastra-port miliastra-port--flow-out"
        key={port.id}
        onContextMenu={options?.onContextMenu}
      >
        {options?.onDelete && (
          <button
            type="button"
            className="miliastra-flowout-action miliastra-flowout-action--delete"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              options.onDelete?.();
            }}
            disabled={options.deleteDisabled}
            aria-label={t('graphCanvas.flowOutDelete')}
            title={t('graphCanvas.flowOutDelete')}
          >
            -
          </button>
        )}
        {!options?.hideLabel && renderPortLabel(port)}
        {renderHandle(port, Position.Right)}
      </div>
    );
  };

  const renderBranchFlowOutRow = (port: PortDefinition) => {
    const index = parseBranchFlowOutIndex(port.id);
    if (!index) return null;
    const value = effectiveBranchLabels[index - 1] ?? '';
    return (
      <div className="miliastra-row miliastra-row--branch" key={`branch-${port.id}`}>
        <div className="miliastra-row__cell miliastra-row__cell--left">
          <div className="miliastra-port miliastra-port--branch-label">
            <input
              className="miliastra-port__control miliastra-port__control--branch"
              type="text"
              value={value}
              placeholder={t('common.enterValue')}
              onChange={(event) => {
                setBranchFlowOutLabel(data.nodeId, index, event.target.value);
              }}
            />
          </div>
        </div>
        <div className="miliastra-row__cell miliastra-row__cell--right">
          {renderFlowOut(port, {
            hideLabel: true,
            onDelete: () => removeBranchFlowOut(data.nodeId, index),
            onContextMenu: getPortContextMenuHandler(port),
          })}
        </div>
      </div>
    );
  };

  const nodeClassName = classNames(
    'miliastra-node',
    `miliastra-node--${definition.kind}`,
    { 'is-selected': selected }
  );

  return (
    <div className={nodeClassName} style={nodeStyle}>
      <header className="miliastra-node__header">
        <img className="miliastra-node__icon" src={nodeIcon} alt="" aria-hidden="true" />
        <span className="miliastra-node__title">
          {label ?? resolveNodeDefinitionDisplayName(definition, primaryLanguage, secondaryLanguage)}
        </span>
      </header>
      <div className="miliastra-node__body">
        {flowRows.map((row, index) => {
          const sequenceIndex =
            isSequenceNode && row.right ? parseSequenceFlowOutIndex(row.right.id) : null;
          return (
            <div className="miliastra-row miliastra-row--flow" key={`flow-${index}`}>
              <div className="miliastra-row__cell miliastra-row__cell--left">
                {renderFlowIn(row.left)}
              </div>
              <div className="miliastra-row__cell miliastra-row__cell--right">
                {renderFlowOut(row.right, {
                  onContextMenu: row.right
                    ? getPortContextMenuHandler(row.right)
                    : undefined,
                  onDelete:
                    sequenceIndex != null
                      ? () => removeSequenceFlowOut(data.nodeId, sequenceIndex)
                      : undefined,
                  deleteDisabled: sequenceIndex != null && sequenceFlowOutCount <= 1,
                })}
              </div>
            </div>
          );
        })}
        {isSequenceNode && (
          <div className="miliastra-row miliastra-row--flow miliastra-row--flow-actions">
            <div className="miliastra-row__cell miliastra-row__cell--left">
              <div className="miliastra-port-placeholder" />
            </div>
            <div className="miliastra-row__cell miliastra-row__cell--right">
              <button
                type="button"
                className="miliastra-flowout-action miliastra-flowout-action--add"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  addSequenceFlowOut(data.nodeId);
                }}
                disabled={!canAddSequenceFlowOut}
                aria-label={t('graphCanvas.flowOutAdd')}
                title={t('graphCanvas.flowOutAdd')}
              >
                +
              </button>
            </div>
          </div>
        )}
        {dataRows.map((row, index) => (
          <div className="miliastra-row" key={`data-${index}`}>
            <div className="miliastra-row__cell miliastra-row__cell--left">
              {renderDataIn(row.left)}
            </div>
            <div className="miliastra-row__cell miliastra-row__cell--right">
              {renderDataOut(row.right)}
            </div>
          </div>
        ))}
        {isMultiBranchNode && (
          <div className="miliastra-row miliastra-row--branch-label">
            <div className="miliastra-row__cell miliastra-row__cell--left">
              <span className="miliastra-port__label miliastra-port__label--muted">
                {t('graphCanvas.branchParamLabel')}
              </span>
            </div>
            <div className="miliastra-row__cell miliastra-row__cell--right">
              <div className="miliastra-port-placeholder" />
            </div>
          </div>
        )}
        {isMultiBranchNode && branchFlowOutPorts.map(renderBranchFlowOutRow)}
        {isMultiBranchNode && (
          <div className="miliastra-row miliastra-row--flow miliastra-row--flow-actions">
            <div className="miliastra-row__cell miliastra-row__cell--left">
              <div className="miliastra-port-placeholder" />
            </div>
            <div className="miliastra-row__cell miliastra-row__cell--right">
              <button
                type="button"
                className="miliastra-flowout-action miliastra-flowout-action--add"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  addBranchFlowOut(data.nodeId);
                }}
                disabled={!canAddBranchFlowOut}
                aria-label={t('graphCanvas.flowOutAdd')}
                title={t('graphCanvas.flowOutAdd')}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MiliastraNode.displayName = 'MiliastraNode';

export default MiliastraNode;
