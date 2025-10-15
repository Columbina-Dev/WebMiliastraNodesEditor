import type {
  DataPortDefinition,
  FlowPortDefinition,
  PortDefinition,
} from '../types/node';

export const isFlowPort = (port: PortDefinition): port is FlowPortDefinition =>
  port.kind === 'flow-in' || port.kind === 'flow-out';

export const isDataPort = (port: PortDefinition): port is DataPortDefinition =>
  port.kind === 'data-in' || port.kind === 'data-out';

export const canConnectPorts = (
  sourcePort: PortDefinition,
  targetPort: PortDefinition
): boolean => {
  if (sourcePort.kind === targetPort.kind) return false;

  if (isFlowPort(sourcePort) && isFlowPort(targetPort)) {
    return sourcePort.kind === 'flow-out' && targetPort.kind === 'flow-in';
  }

  if (isDataPort(sourcePort) && isDataPort(targetPort)) {
    if (sourcePort.kind !== 'data-out' || targetPort.kind !== 'data-in') {
      return false;
    }
    const accepts = targetPort.accepts;
    if (accepts && accepts.length > 0) {
      return accepts.includes((sourcePort as DataPortDefinition).valueType);
    }
    if (
      targetPort.valueType === 'any' ||
      (sourcePort as DataPortDefinition).valueType === 'any'
    ) {
      return true;
    }
    return targetPort.valueType === (sourcePort as DataPortDefinition).valueType;
  }

  return false;
};

export const getOppositeFlowPortKind = (port: FlowPortDefinition['kind']): FlowPortDefinition['kind'] =>
  port === 'flow-in' ? 'flow-out' : 'flow-in';

export const getOppositeDataPortKind = (port: DataPortDefinition['kind']): DataPortDefinition['kind'] =>
  port === 'data-in' ? 'data-out' : 'data-in';
