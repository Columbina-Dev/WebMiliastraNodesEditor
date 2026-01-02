import type { GraphNode, GraphNodeData, NodeDefinition, PortDefinition } from '../types/node';

export const SEQUENCE_NODE_ID = 'event.executeByOrderUniquely';
export const MULTI_BRANCH_NODE_ID = 'flow.branch.multi';

export const SEQUENCE_FLOW_OUT_PREFIX = 'flowOut';
export const BRANCH_FLOW_OUT_PREFIX = 'branch';

export const MAX_SEQUENCE_FLOW_OUTS = 10;
export const MAX_BRANCH_FLOW_OUTS = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseIndexedPortId = (portId: string, prefix: string): number | null => {
  if (!portId.startsWith(prefix)) return null;
  const suffix = portId.slice(prefix.length);
  if (!suffix) return null;
  const index = Number.parseInt(suffix, 10);
  if (!Number.isFinite(index) || index < 1) return null;
  return index;
};

export const parseSequenceFlowOutIndex = (portId: string) =>
  parseIndexedPortId(portId, SEQUENCE_FLOW_OUT_PREFIX);

export const parseBranchFlowOutIndex = (portId: string) =>
  parseIndexedPortId(portId, BRANCH_FLOW_OUT_PREFIX);

export const getSequenceFlowOutCount = (data?: GraphNodeData) => {
  const raw = data?.sequenceFlowOutCount;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return clamp(Math.floor(raw), 1, MAX_SEQUENCE_FLOW_OUTS);
};

export const getBranchFlowOutLabels = (data?: GraphNodeData) => {
  if (!Array.isArray(data?.branchFlowOutLabels)) return [];
  return data.branchFlowOutLabels.slice(0, MAX_BRANCH_FLOW_OUTS);
};

export const buildSequenceFlowOutPorts = (count: number): PortDefinition[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${SEQUENCE_FLOW_OUT_PREFIX}${index + 1}`,
    label: String(index + 1),
    kind: 'flow-out',
  }));

export const buildBranchFlowOutPorts = (labels: string[]): PortDefinition[] =>
  labels.map((label, index) => ({
    id: `${BRANCH_FLOW_OUT_PREFIX}${index + 1}`,
    label: label ?? '',
    kind: 'flow-out',
  }));

export const resolveNodePorts = (node: GraphNode, definition: NodeDefinition): PortDefinition[] => {
  if (node.type === SEQUENCE_NODE_ID) {
    return buildSequenceFlowOutPorts(getSequenceFlowOutCount(node.data));
  }
  if (node.type === MULTI_BRANCH_NODE_ID) {
    return [...definition.ports, ...buildBranchFlowOutPorts(getBranchFlowOutLabels(node.data))];
  }
  return definition.ports;
};

export type DynamicFlowOutInfo = {
  kind: 'sequence' | 'branch';
  index: number;
  count: number;
  max: number;
};

export const getDynamicFlowOutInfo = (node: GraphNode, portId: string): DynamicFlowOutInfo | null => {
  if (node.type === SEQUENCE_NODE_ID) {
    const index = parseSequenceFlowOutIndex(portId);
    if (!index) return null;
    return {
      kind: 'sequence',
      index,
      count: getSequenceFlowOutCount(node.data),
      max: MAX_SEQUENCE_FLOW_OUTS,
    };
  }
  if (node.type === MULTI_BRANCH_NODE_ID) {
    const index = parseBranchFlowOutIndex(portId);
    if (!index) return null;
    const labels = getBranchFlowOutLabels(node.data);
    return {
      kind: 'branch',
      index,
      count: labels.length,
      max: MAX_BRANCH_FLOW_OUTS,
    };
  }
  return null;
};
