import { nanoid } from "nanoid/non-secure";
import { nodeDefinitions } from "../../data/nodeDefinitions";
import {
  MULTI_BRANCH_NODE_ID,
  SEQUENCE_NODE_ID,
  resolveNodePorts,
} from "../../utils/dynamicFlowOuts";
import { GRAPH_SCHEMA_VERSION } from "../../types/node";
import type {
  GraphComment,
  GraphDocument,
  GraphEdge,
  GraphEnvironment,
  GraphNode,
  NodeDefinition,
  PortDefinition,
  ValueType,
} from "../../types/node";
import type { LocalizedText } from "../../utils/localizedText";
import type { DecodedGiaRoot } from "./decoder";

type GiaImportResult = {
  graph: GraphDocument | null;
  warnings: LocalizedText[];
  errors: LocalizedText[];
};

type GiaPinKind = "InFlow" | "OutFlow" | "InParam" | "OutParam";

type GiaNodeIndexEntry = {
  id: string;
  definition: NodeDefinition;
  portMeta: NodePortMeta;
};

type NodePortMeta = {
  flowIn: string[];
  flowOut: string[];
  dataIn: string[];
  dataOut: string[];
};

const NODE_DEFINITION_BY_OFFICIAL_ID = new Map<number, NodeDefinition>(
  nodeDefinitions
    .filter((definition) => typeof definition.officialID === "number" && definition.officialID > 0)
    .map((definition) => [definition.officialID, definition]),
);

const NODE_GRAPH_TYPE_ENV_MAP: Record<number, GraphEnvironment> = {
  20000: "server",
  20001: "client:boolean",
  20002: "client:role-skill",
  20006: "client:integer",
};

const NODE_UNIT_TYPE_ENV_MAP: Record<number, GraphEnvironment> = {
  9: "server",
  10: "client:boolean",
  11: "client:role-skill",
  47: "client:integer",
};

const VAR_BASE_CLASS_BY_ID: Record<number, string> = {
  1: "IdBase",
  2: "IntBase",
  4: "FloatBase",
  5: "StringBase",
  6: "EnumBase",
  7: "VectorBase",
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseInteger = (value: unknown): number | null => {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.trunc(parsed);
};

const parseGiaKind = (value: unknown): GiaPinKind | null => {
  if (typeof value === "string") {
    if (value === "InFlow" || value === "OutFlow" || value === "InParam" || value === "OutParam") {
      return value;
    }
  }
  const numeric = parseInteger(value);
  if (numeric === null) return null;
  switch (numeric) {
    case 1:
      return "InFlow";
    case 2:
      return "OutFlow";
    case 3:
      return "InParam";
    case 4:
      return "OutParam";
    default:
      return null;
  }
};

const pickString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  return null;
};

const resolveVarClassName = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  const numeric = parseInteger(value);
  if (numeric === null) return null;
  return VAR_BASE_CLASS_BY_ID[numeric] ?? null;
};

const sanitizeVectorValue = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return { x: 0, y: 0, z: 0 };
  }
  const record = value as Record<string, unknown>;
  return {
    x: parseNumber(record.x) ?? 0,
    y: parseNumber(record.y) ?? 0,
    z: parseNumber(record.z) ?? 0,
  };
};

const resolveVarBaseValue = (value: unknown, portType?: ValueType) => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const className = resolveVarClassName(record.class);
  if (!className) return null;
  switch (className) {
    case "IdBase": {
      const raw = parseNumber((record.bId as Record<string, unknown> | undefined)?.val);
      if (raw === null) return null;
      if (portType === "guid") return String(raw);
      return raw;
    }
    case "IntBase": {
      const raw = parseNumber((record.bInt as Record<string, unknown> | undefined)?.val);
      if (raw === null) return null;
      return portType === "bool" ? Boolean(raw) : raw;
    }
    case "FloatBase": {
      return parseNumber((record.bFloat as Record<string, unknown> | undefined)?.val);
    }
    case "StringBase": {
      const raw = (record.bString as Record<string, unknown> | undefined)?.val;
      return typeof raw === "string" ? raw : raw != null ? String(raw) : null;
    }
    case "EnumBase": {
      const raw = parseNumber((record.bEnum as Record<string, unknown> | undefined)?.val);
      if (raw === null) return null;
      return portType === "bool" ? Boolean(raw) : raw;
    }
    case "VectorBase": {
      const raw = (record.bVector as Record<string, unknown> | undefined)?.val;
      return sanitizeVectorValue(raw);
    }
    default:
      return null;
  }
};

const buildPortMeta = (ports: PortDefinition[]): NodePortMeta => {
  const meta: NodePortMeta = {
    flowIn: [],
    flowOut: [],
    dataIn: [],
    dataOut: [],
  };
  ports.forEach((port) => {
    switch (port.kind) {
      case "flow-in":
        meta.flowIn.push(port.id);
        break;
      case "flow-out":
        meta.flowOut.push(port.id);
        break;
      case "data-in":
        meta.dataIn.push(port.id);
        break;
      case "data-out":
        meta.dataOut.push(port.id);
        break;
      default:
        break;
    }
  });
  return meta;
};

const resolveEnvironment = (
  nodeUnit: Record<string, unknown> | undefined,
  nodeGraph: Record<string, unknown> | undefined,
  addWarning: (warning: LocalizedText) => void,
): GraphEnvironment => {
  const graphId = (nodeGraph?.id as Record<string, unknown> | undefined) ?? undefined;
  const graphType = parseInteger(graphId?.type);
  if (graphType != null && NODE_GRAPH_TYPE_ENV_MAP[graphType]) {
    return NODE_GRAPH_TYPE_ENV_MAP[graphType];
  }
  const unitType = parseInteger(nodeUnit?.type);
  if (unitType != null && NODE_UNIT_TYPE_ENV_MAP[unitType]) {
    addWarning({ key: "gia.import.unknownGraphType", params: { type: unitType } });
    return NODE_UNIT_TYPE_ENV_MAP[unitType];
  }
  if (graphType != null) {
    addWarning({ key: "gia.import.unknownGraphType", params: { type: graphType } });
  }
  return "server";
};

export const importGiaRoot = (root: DecodedGiaRoot): GiaImportResult => {
  const warnings: LocalizedText[] = [];
  const errors: LocalizedText[] = [];
  const seen = new Set<string>();
  const addWarning = (warning: LocalizedText) => {
    const signature = JSON.stringify(warning);
    if (seen.has(signature)) return;
    seen.add(signature);
    warnings.push(warning);
  };

  const rootRecord = root as Record<string, unknown>;
  const nodeUnit = (rootRecord.graph as Record<string, unknown> | undefined) ?? undefined;
  const unitGraph = (nodeUnit?.graph as Record<string, unknown> | undefined) ?? undefined;
  const inner = (unitGraph?.inner as Record<string, unknown> | undefined) ?? undefined;
  const nodeGraph = (inner?.graph as Record<string, unknown> | undefined) ?? undefined;

  if (!nodeGraph) {
    errors.push({ key: "gia.import.noGraph" });
    return { graph: null, warnings, errors };
  }

  const graphType = pickString(nodeUnit?.type);
  if (graphType && graphType !== "NodeGraphWrapper" && graphType !== "CompositeGraph") {
    addWarning({ key: "gia.import.unknownGraphType", params: { type: graphType } });
  }

  const name =
    pickString(nodeGraph.name) ||
    pickString(nodeUnit?.name) ||
    "graph";

  const environment = resolveEnvironment(nodeUnit, nodeGraph, addWarning);
  const now = new Date().toISOString();

  const nodesRaw = Array.isArray(nodeGraph.nodes) ? nodeGraph.nodes : [];
  const commentsRaw = Array.isArray(nodeGraph.comments) ? nodeGraph.comments : [];
  const graphValuesRaw = Array.isArray(nodeGraph.graphValues) ? nodeGraph.graphValues : [];
  if (graphValuesRaw.length > 0) {
    addWarning({ key: "gia.import.graphValuesSkipped" });
  }

  const nodes: GraphNode[] = [];
  const comments: GraphComment[] = [];
  const nodeIndexMap = new Map<number, GiaNodeIndexEntry>();

  nodesRaw.forEach((nodeRaw) => {
    if (!nodeRaw || typeof nodeRaw !== "object") return;
    const record = nodeRaw as Record<string, unknown>;
    const nodeIndex = parseInteger(record.nodeIndex);
    if (nodeIndex == null || nodeIndex <= 0) {
      addWarning({ key: "gia.import.nodeIndexInvalid" });
      return;
    }
    const genericId = record.genericId as Record<string, unknown> | undefined;
    const concreteId = record.concreteId as Record<string, unknown> | undefined;
    const nodeIdRaw = parseInteger(genericId?.nodeId ?? concreteId?.nodeId);
    if (!nodeIdRaw) {
      addWarning({ key: "gia.import.nodeMissingId" });
      return;
    }
    const definition = NODE_DEFINITION_BY_OFFICIAL_ID.get(nodeIdRaw);
    if (!definition) {
      addWarning({ key: "gia.import.nodeMissingMapping", params: { nodeId: nodeIdRaw } });
      return;
    }

    const x = parseNumber(record.x) ?? 0;
    const y = parseNumber(record.y) ?? 0;
    const nodeId = nanoid();
    const nodeData: GraphNode["data"] = {};

    const pins = Array.isArray(record.pins) ? record.pins : [];
    if (definition.id === SEQUENCE_NODE_ID) {
      const maxIndex = pins.reduce((max, pin) => {
        if (!pin || typeof pin !== "object") return max;
        const i1 = (pin as Record<string, unknown>).i1 as Record<string, unknown> | undefined;
        const kind = parseGiaKind(i1?.kind);
        if (kind !== "OutFlow") return max;
        const index = parseInteger(i1?.index);
        return index != null ? Math.max(max, index) : max;
      }, 0);
      nodeData.sequenceFlowOutCount = Math.max(1, maxIndex + 1);
    }
    if (definition.id === MULTI_BRANCH_NODE_ID) {
      const maxIndex = pins.reduce((max, pin) => {
        if (!pin || typeof pin !== "object") return max;
        const i1 = (pin as Record<string, unknown>).i1 as Record<string, unknown> | undefined;
        const kind = parseGiaKind(i1?.kind);
        if (kind !== "OutFlow") return max;
        const index = parseInteger(i1?.index);
        return index != null ? Math.max(max, index) : max;
      }, 0);
      nodeData.branchFlowOutLabels = Array.from({ length: Math.max(1, maxIndex + 1) }, () => "");
    }

    const node: GraphNode = {
      id: nodeId,
      type: definition.id,
      position: { x, y },
      data: Object.keys(nodeData).length ? nodeData : undefined,
    };
    const ports = resolveNodePorts(node, definition);
    nodeIndexMap.set(nodeIndex, { id: nodeId, definition, portMeta: buildPortMeta(ports) });
    nodes.push(node);

    const commentRaw = record.comments as Record<string, unknown> | undefined;
    const commentText = commentRaw?.content;
    if (typeof commentText === "string" && commentText.trim()) {
      comments.push({
        id: nanoid(),
        nodeId,
        text: commentText,
        pinned: false,
        collapsed: false,
      });
    }
  });

  commentsRaw.forEach((commentRaw) => {
    if (!commentRaw || typeof commentRaw !== "object") return;
    const record = commentRaw as Record<string, unknown>;
    const text = pickString(record.content);
    if (!text) return;
    const x = parseNumber(record.x);
    const y = parseNumber(record.y);
    if (x == null || y == null) return;
    comments.push({
      id: nanoid(),
      position: { x, y },
      text,
      pinned: false,
      collapsed: false,
    });
  });

  const edges: GraphEdge[] = [];
  const edgeKeySet = new Set<string>();

  nodesRaw.forEach((nodeRaw) => {
    if (!nodeRaw || typeof nodeRaw !== "object") return;
    const record = nodeRaw as Record<string, unknown>;
    const nodeIndex = parseInteger(record.nodeIndex);
    if (!nodeIndex) return;
    const nodeEntry = nodeIndexMap.get(nodeIndex);
    if (!nodeEntry) return;
    const pins = Array.isArray(record.pins) ? record.pins : [];
    pins.forEach((pin) => {
      if (!pin || typeof pin !== "object") return;
      const pinRecord = pin as Record<string, unknown>;
      const i1 = pinRecord.i1 as Record<string, unknown> | undefined;
      const kind = parseGiaKind(i1?.kind);
      const pinIndex = parseInteger(i1?.index);
      if (kind === "OutFlow") {
        if (pinIndex == null) return;
        const sourcePortId = nodeEntry.portMeta.flowOut[pinIndex];
        if (!sourcePortId) {
          addWarning({
            key: "gia.import.portIndexMissing",
            params: { nodeId: nodeEntry.definition.id, index: pinIndex },
          });
          return;
        }
        const connects = Array.isArray(pinRecord.connects) ? pinRecord.connects : [];
        connects.forEach((connect) => {
          if (!connect || typeof connect !== "object") return;
          const connectRecord = connect as Record<string, unknown>;
          const targetIndex = parseInteger(connectRecord.id);
          if (!targetIndex) {
            addWarning({ key: "gia.import.edgeMissingNode" });
            return;
          }
          const targetEntry = nodeIndexMap.get(targetIndex);
          if (!targetEntry) {
            addWarning({ key: "gia.import.edgeMissingNode" });
            return;
          }
          const targetPin = connectRecord.connect as Record<string, unknown> | undefined;
          const targetPinIndex = parseInteger(targetPin?.index);
          if (targetPinIndex == null) {
            addWarning({
              key: "gia.import.portIndexMissing",
              params: { nodeId: targetEntry.definition.id, index: -1 },
            });
            return;
          }
          const targetPortId = targetEntry.portMeta.flowIn[targetPinIndex];
          if (!targetPortId) {
            addWarning({
              key: "gia.import.portIndexMissing",
              params: { nodeId: targetEntry.definition.id, index: targetPinIndex },
            });
            return;
          }
          const edgeKey = `${nodeEntry.id}:${sourcePortId}::${targetEntry.id}:${targetPortId}`;
          if (edgeKeySet.has(edgeKey)) return;
          edgeKeySet.add(edgeKey);
          edges.push({
            id: nanoid(),
            source: { nodeId: nodeEntry.id, portId: sourcePortId },
            target: { nodeId: targetEntry.id, portId: targetPortId },
          });
        });
        return;
      }
      if (kind === "InParam") {
        if (pinIndex == null) return;
        const targetPortId = nodeEntry.portMeta.dataIn[pinIndex];
        if (!targetPortId) {
          addWarning({
            key: "gia.import.portIndexMissing",
            params: { nodeId: nodeEntry.definition.id, index: pinIndex },
          });
          return;
        }
        const connects = Array.isArray(pinRecord.connects) ? pinRecord.connects : [];
        if (!connects.length) {
          const portDef = nodeEntry.definition.ports.find((port) => port.id === targetPortId);
          if (portDef && portDef.kind === "data-in") {
            const rawValue = resolveVarBaseValue(pinRecord.value, portDef.valueType);
            if (rawValue !== null) {
              const node = nodes.find((entry) => entry.id === nodeEntry.id);
              if (node) {
                const overrides = { ...(node.data?.overrides ?? {}) };
                overrides[targetPortId] = rawValue;
                node.data = { ...(node.data ?? {}), overrides };
              }
            } else if (pinRecord.value) {
              addWarning({
                key: "gia.import.valueUnsupported",
                params: { nodeId: nodeEntry.definition.id, portId: targetPortId },
              });
            }
          }
        }
        connects.forEach((connect) => {
          if (!connect || typeof connect !== "object") return;
          const connectRecord = connect as Record<string, unknown>;
          const sourceIndex = parseInteger(connectRecord.id);
          if (!sourceIndex) {
            addWarning({ key: "gia.import.edgeMissingNode" });
            return;
          }
          const sourceEntry = nodeIndexMap.get(sourceIndex);
          if (!sourceEntry) {
            addWarning({ key: "gia.import.edgeMissingNode" });
            return;
          }
          const sourcePin = connectRecord.connect as Record<string, unknown> | undefined;
          const sourcePinIndex = parseInteger(sourcePin?.index);
          if (sourcePinIndex == null) {
            addWarning({
              key: "gia.import.portIndexMissing",
              params: { nodeId: sourceEntry.definition.id, index: -1 },
            });
            return;
          }
          const sourcePortId = sourceEntry.portMeta.dataOut[sourcePinIndex];
          if (!sourcePortId) {
            addWarning({
              key: "gia.import.portIndexMissing",
              params: { nodeId: sourceEntry.definition.id, index: sourcePinIndex },
            });
            return;
          }
          const edgeKey = `${sourceEntry.id}:${sourcePortId}::${nodeEntry.id}:${targetPortId}`;
          if (edgeKeySet.has(edgeKey)) return;
          edgeKeySet.add(edgeKey);
          edges.push({
            id: nanoid(),
            source: { nodeId: sourceEntry.id, portId: sourcePortId },
            target: { nodeId: nodeEntry.id, portId: targetPortId },
          });
        });
        return;
      }
      if (kind && kind !== "OutParam" && kind !== "InFlow") {
        addWarning({ key: "gia.import.pinUnsupported", params: { kind } });
      }
    });
  });

  const graph: GraphDocument = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    comments: comments.length ? comments : undefined,
    environment,
  };

  return { graph, warnings, errors };
};
