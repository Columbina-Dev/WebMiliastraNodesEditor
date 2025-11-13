import { memo, useMemo } from 'react';
import type { ChangeEvent } from 'react';
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
const ICON_EVENT = new URL('../assets/icons/event-stroke.svg', import.meta.url).href;
const ICON_EXECUTE = new URL('../assets/icons/execute-stroke.svg', import.meta.url).href;
const ICON_FLOW = new URL('../assets/icons/flow-stroke.svg', import.meta.url).href;
const ICON_QUERY = new URL('../assets/icons/query-stroke.svg', import.meta.url).href;
const ICON_LOGIC = new URL('../assets/icons/logic-stroke.svg', import.meta.url).href;
import './MiliastraNode.css';

type NodeStyle = React.CSSProperties & {
  '--miliastra-header-color'?: string;
};

type Vector3Value = { x: number; y: number; z: number };

export interface MiliastraNodeData {
  nodeId: string;
  definition: NodeDefinition;
  label?: string;
  overrides?: Record<string, unknown>;
  controls?: Record<string, unknown>;
  connectionPreview?: ConnectionPreview | null;
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
  const setOverride = useGraphStore((state) => state.setPortOverride);
  const clearOverride = useGraphStore((state) => state.clearPortOverride);

  const { definition, label, overrides, connectionPreview } = data;

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
    (nodeStyle as any)['--miliastra-header-bg'] = headerColor;
  } else {
    (nodeStyle as any)['--miliastra-header-color'] = headerColor;
    (nodeStyle as any)['--miliastra-header-bg'] = undefined;
  }

  const compatibilityMap = useMemo(() => {
    if (!connectionPreview) return null;
    const result = new Map<string, boolean>();
    definition.ports.forEach((port) => {
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
  }, [connectionPreview, data.nodeId, definition.ports]);

  const partitionedPorts = useMemo(() => {
    const flowIn: PortDefinition[] = [];
    const flowOut: PortDefinition[] = [];
    const dataIn: DataPortDefinition[] = [];
    const dataOut: DataPortDefinition[] = [];
    definition.ports.forEach((port) => {
      if (port.kind === 'flow-in') flowIn.push(port);
      else if (port.kind === 'flow-out') flowOut.push(port);
      else if (port.kind === 'data-in') dataIn.push(port as DataPortDefinition);
      else if (port.kind === 'data-out') dataOut.push(port as DataPortDefinition);
    });
    return { flowIn, flowOut, dataIn, dataOut };
  }, [definition.ports]);

  const flowRows = useMemo(() => {
    const count = Math.max(partitionedPorts.flowIn.length, partitionedPorts.flowOut.length);
    return Array.from({ length: count }, (_, index) => ({
      left: partitionedPorts.flowIn[index] ?? null,
      right: partitionedPorts.flowOut[index] ?? null,
    }));
  }, [partitionedPorts.flowIn, partitionedPorts.flowOut]);

  const dataRows = useMemo(() => {
    const count = Math.max(partitionedPorts.dataIn.length, partitionedPorts.dataOut.length);
    return Array.from({ length: count }, (_, index) => ({
      left: partitionedPorts.dataIn[index] ?? null,
      right: partitionedPorts.dataOut[index] ?? null,
    }));
  }, [partitionedPorts.dataIn, partitionedPorts.dataOut]);

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
      {port.label}
      {port.ui?.accessory === 'gear' && (
        <span className="miliastra-port__badge" aria-hidden="true">
          ⚙
        </span>
      )}
    </span>
  );

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
              <option value="">未设置</option>
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
              <option value="">未设置</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          ) : (
            <input
              className="miliastra-port__control"
              type={port.valueType === 'int' || port.valueType === 'float' ? 'number' : 'text'}
              value={formatValue(port, value)}
              placeholder={port.ui?.placeholder ?? '输入值'}
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

  const renderFlowOut = (port: PortDefinition | null) => {
    if (!port) return <div className="miliastra-port-placeholder" />;
    return (
      <div className="miliastra-port miliastra-port--flow-out" key={port.id}>
        {renderPortLabel(port)}
        {renderHandle(port, Position.Right)}
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
        <span className="miliastra-node__title">{label ?? definition.displayName}</span>
      </header>
      <div className="miliastra-node__body">
        {flowRows.map((row, index) => (
          <div className="miliastra-row miliastra-row--flow" key={`flow-${index}`}>
            <div className="miliastra-row__cell miliastra-row__cell--left">
              {renderFlowIn(row.left)}
            </div>
            <div className="miliastra-row__cell miliastra-row__cell--right">
              {renderFlowOut(row.right)}
            </div>
          </div>
        ))}
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
      </div>
    </div>
  );
});

MiliastraNode.displayName = 'MiliastraNode';

export default MiliastraNode;

