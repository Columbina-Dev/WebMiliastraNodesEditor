import protobuf from "protobufjs";

import type {
  GraphDocument,
  GraphEdge,
  GraphEnvironment,
  GraphNode as GraphNodeDocument,
  NodeDefinition,
  ValueType,
} from "../../types/node";
import { nodeDefinitions } from "../../data/nodeDefinitions";
import giaProtoSource from "./giaProtoText";

const { root: protoRoot } = protobuf.parse(giaProtoSource, { keepCase: true });
const ROOT_MESSAGE = protoRoot.lookupType("Root");
const NODE_PROPERTY_CLASS = {
  UserDefined: 10000,
  SystemDefined: 10001,
} as const;

const NODE_PROPERTY_TYPE = {
  Server: 20000,
  Client: 20002,
} as const;

const NODE_PROPERTY_KIND = {
  SysCall: 22000,
} as const;

const NODE_PIN_KIND = {
  InFlow: 1,
  OutFlow: 2,
  InParam: 3,
  OutParam: 4,
} as const;

const VAR_TYPE = {
  UnknownVar: 0,
  Entity: 1,
  GUID: 2,
  Integer: 3,
  Boolean: 4,
  Float: 5,
  String: 6,
  StringList: 11,
  Vector: 12,
  EnumItem: 14,
  LocalVariable: 16,
  Faction: 17,
  Configuration: 20,
  Prefab: 21,
} as const;

const NODE_UNIT_ID_TYPE = {
  Node: 1,
  Basic: 5,
} as const;

const NODE_UNIT_ID_KIND = {
  ClientGraph: 3,
} as const;

const NODE_UNIT_TYPE = {
  Server: 9,
  BooleanFilter: 10,
  Skills: 11,
  IntegerFilter: 47,
} as const;

const NODE_GRAPH_CLASS = {
  UserDefined: 10000,
} as const;

const NODE_GRAPH_KIND = {
  NodeGraph: 21001,
} as const;

const NODE_GRAPH_TYPE = {
  Server: 20000,
  BooleanFilter: 20001,
  Skills: 20002,
  IntegerFilter: 20006,
} as const;

const HEADER_MAGIC = 0x00000326;
const FOOTER_MAGIC = 0x00000679;

type NormalizedEnvironment = "server" | "client:boolean" | "client:integer" | "client:skill";

const NODE_UNIT_TYPE_BY_ENV: Record<NormalizedEnvironment, number> = {
  server: NODE_UNIT_TYPE.Server,
  "client:boolean": NODE_UNIT_TYPE.BooleanFilter,
  "client:integer": NODE_UNIT_TYPE.IntegerFilter,
  "client:skill": NODE_UNIT_TYPE.Skills,
};

const NODE_GRAPH_TYPE_BY_ENV: Record<NormalizedEnvironment, number> = {
  server: NODE_GRAPH_TYPE.Server,
  "client:boolean": NODE_GRAPH_TYPE.BooleanFilter,
  "client:integer": NODE_GRAPH_TYPE.IntegerFilter,
  "client:skill": NODE_GRAPH_TYPE.Skills,
};

const NODE_UNIT_KIND_BY_ENV: Partial<Record<NormalizedEnvironment, number>> = {
  "client:boolean": NODE_UNIT_ID_KIND.ClientGraph,
  "client:integer": NODE_UNIT_ID_KIND.ClientGraph,
  "client:skill": NODE_UNIT_ID_KIND.ClientGraph,
};

export interface GiaExportOptions {
  graphId?: number;
  uid?: string;
  timestampSeconds?: number;
}

export interface GiaExportResult {
  blob: Blob;
  fileName: string;
  warnings: string[];
}

/** Experimental GIA exporter (currently supports server/entity graphs). */
export const exportGiaDocument = (
  document: GraphDocument,
  options?: GiaExportOptions,
): GiaExportResult => {
  const builder = new GiaRootBuilder(document, options);
  const { root, warnings, fileName } = builder.build();
  const verifyError = ROOT_MESSAGE.verify(root);
  if (verifyError) {
    throw new Error(`GIA payload verification failed: ${verifyError}`);
  }
  const payload = ROOT_MESSAGE.encode(root).finish();
  const buffer = wrapGiaPayload(payload);
  return {
    blob: new Blob([buffer], { type: "application/octet-stream" }),
    fileName,
    warnings,
  };
};

type GiaRecord = Record<string, unknown>;

class GiaRootBuilder {
  private readonly document: GraphDocument;
  private readonly env: NormalizedEnvironment;
  private readonly graphId: number;
  private readonly uid: string;
  private readonly timestampSeconds: number;
  private readonly warnings: string[] = [];

  constructor(doc: GraphDocument, options?: GiaExportOptions) {
    this.document = doc;
    this.env = normalizeEnvironment(doc.environment);
    this.graphId = options?.graphId ?? generateNumericId(10, "102");
    this.uid = options?.uid ?? generateNumericString(9, "201");
    this.timestampSeconds = options?.timestampSeconds ?? Math.floor(Date.now() / 1000);
  }

  build(): { root: GiaRecord; warnings: string[]; fileName: string } {
    const nodeUnit = this.buildNodeUnit();
    const root: GiaRecord = {
      graph: nodeUnit,
      utils: [],
      filePath: this.buildFilePath(),
    };
    return {
      root,
      warnings: [...this.warnings],
      fileName: this.buildFileName(),
    };
  }

  private buildNodeUnit() {
    return {
      id: {
        type: NODE_UNIT_ID_TYPE.Basic,
        kind: NODE_UNIT_KIND_BY_ENV[this.env],
        id: this.graphId,
      },
      relatedIds: [],
      name: this.document.name ?? "未命名节点图",
      type: NODE_UNIT_TYPE_BY_ENV[this.env],
      graph: {
        inner: {
          graph: this.buildNodeGraph(),
        },
      },
    };
  }

  private buildNodeGraph() {
    const nodeEncoder = new GiaGraphNodeEncoder(this.document, this.env, this.warnings);
    const nodes = nodeEncoder.build();
    if (this.document.nodes.length > 0 && nodes.length === 0) {
      this.warnings.push("导出为.gia文件：未找到可导出的节点。");
    }
    return {
      id: {
        class: NODE_GRAPH_CLASS.UserDefined,
        type: NODE_GRAPH_TYPE_BY_ENV[this.env],
        kind: NODE_GRAPH_KIND.NodeGraph,
        id: this.graphId,
      },
      name: this.document.name ?? "未命名节点图",
      nodes,
      compositePins: [],
      graphValues: [],
      affiliations: [],
      comments: nodeEncoder.getGraphComments(),
    };
  }

  private buildFilePath() {
    return `${this.uid}-${this.timestampSeconds}-${this.graphId}-\\${this.buildSafeName()}.gia`;
  }

  private buildFileName() {
    return `${this.buildSafeName()}-${this.graphId}.gia`;
  }

  private buildSafeName() {
    const base = this.document.name?.trim().length ? this.document.name.trim() : "graph";
    return Array.from(base)
      .map((char) => (INVALID_PATH_CHARS.has(char) ? "_" : char))
      .join("");
  }
}

const INVALID_PATH_CHARS = new Set(["\\", "/", ":", "*", "?", "\"", "<", ">", "|"]);

const normalizeEnvironment = (env?: GraphEnvironment): NormalizedEnvironment => {
  if (!env || env === "server") return "server";
  if (env.startsWith("client:")) {
    switch (env) {
      case "client:boolean":
        return "client:boolean";
      case "client:integer":
        return "client:integer";
      case "client:skill":
        return "client:skill";
      default:
        return "client:boolean";
    }
  }
  return env === "client" ? "client:boolean" : "server";
};

const RANDOM_SOURCE = "0123456789";

const generateNumericString = (length: number, prefix = ""): string => {
  const remaining = Math.max(length - prefix.length, 0);
  let suffix = "";
  for (let i = 0; i < remaining; i++) {
    const index = Math.floor(Math.random() * RANDOM_SOURCE.length);
    suffix += RANDOM_SOURCE[index];
  }
  return `${prefix}${suffix}`;
};

const generateNumericId = (length: number, prefix = ""): number => parseInt(generateNumericString(length, prefix), 10);

const wrapGiaPayload = (payload: Uint8Array): ArrayBuffer => {
  const headerSize = 20;
  const footerSize = 4;
  const buffer = new ArrayBuffer(headerSize + payload.length + footerSize);
  const view = new DataView(buffer);
  view.setUint32(0, headerSize + payload.length, false);
  view.setUint32(4, 1, false);
  view.setUint32(8, HEADER_MAGIC, false);
  view.setUint32(12, 3, false);
  view.setUint32(16, payload.length, false);
  new Uint8Array(buffer, headerSize, payload.length).set(payload);
  view.setUint32(headerSize + payload.length, FOOTER_MAGIC, false);
  return buffer;
};

type NodePortMeta = {
  flowIn: string[];
  flowOut: string[];
  dataIn: string[];
  dataOut: string[];
};

type FlowConnection = {
  targetNodeIndex: number;
  targetFlowIndex: number;
};

type DataConnection = {
  sourceNodeIndex: number;
  sourceDataIndex: number;
};

type NodeInfo = {
  node: GraphNodeDocument;
  definition?: NodeDefinition;
  index: number;
  portMeta?: NodePortMeta;
};

const NODE_DEFINITION_MAP = new Map(nodeDefinitions.map((def) => [def.id, def]));

type NodeCommentPayload = { content: string };
type GraphCommentPayload = { content: string; x: number; y: number };

class GiaGraphNodeEncoder {
  private readonly document: GraphDocument;
  private readonly env: NormalizedEnvironment;
  private readonly warnings: string[];
  private readonly nodeInfos: NodeInfo[];
  private readonly nodeInfoById: Map<string, NodeInfo>;
  private readonly flowConnections = new Map<string, FlowConnection[]>();
  private readonly dataConnections = new Map<string, DataConnection[]>();
  private readonly nodeComments = new Map<string, NodeCommentPayload>();
  private readonly graphComments: GraphCommentPayload[] = [];

  constructor(doc: GraphDocument, env: NormalizedEnvironment, warnings: string[]) {
    this.document = doc;
    this.env = env;
    this.warnings = warnings;
    this.nodeInfos = this.document.nodes.map((node, idx) => {
      const definition = NODE_DEFINITION_MAP.get(node.type);
      return {
        node,
        definition,
        index: idx + 1,
        portMeta: definition ? computePortMeta(definition) : undefined,
      };
    });
    this.nodeInfoById = new Map(this.nodeInfos.map((info) => [info.node.id, info]));
    this.collectComments();
    this.collectEdges();
  }

  build(): GiaRecord[] {
    return this.nodeInfos
      .map((info) => this.buildNode(info))
      .filter((item): item is GiaRecord => item !== null);
  }

  private buildNode(info: NodeInfo): GiaRecord | null {
    const definition = info.definition;
    const portMeta = info.portMeta;
    if (!definition || !portMeta) {
      this.warnings.push(`GIA：节点“${info.node.type}”暂不支持导出，将被忽略。`);
      return null;
    }
    if (!definition.officialID || definition.officialID <= 0) {
      this.warnings.push(`GIA：节点“${info.node.type}”缺少官方 ID，无法导出。`);
      return null;
    }
    const property = this.createNodeProperty(definition.officialID);
    if (!property) {
      this.warnings.push(`GIA：当前环境暂未实现对节点“${info.node.type}”的导出。`);
      return null;
    }

    const comment = this.nodeComments.get(info.node.id);
    const pins = [
      ...this.buildFlowOutPins(info, portMeta),
      ...this.buildDataInPins(info, portMeta),
    ];

    return {
      nodeIndex: info.index,
      genericId: property,
      concreteId: property,
      pins,
      x: info.node.position?.x ?? 0,
      y: info.node.position?.y ?? 0,
      comments: comment,
    };
  }

  private buildFlowOutPins(info: NodeInfo, meta: NodePortMeta) {
    const pins: GiaRecord[] = [];
    meta.flowOut.forEach((portId, index) => {
      const key = makePortKey(info.node.id, portId);
      const entries = this.flowConnections.get(key);
      if (!entries?.length) return;
      pins.push({
        i1: { kind: NODE_PIN_KIND.OutFlow, index },
        i2: { kind: NODE_PIN_KIND.OutFlow, index },
        connects: entries.map((entry) => ({
          id: entry.targetNodeIndex,
          connect: { kind: NODE_PIN_KIND.InFlow, index: entry.targetFlowIndex },
          connect2: { kind: NODE_PIN_KIND.InFlow, index: entry.targetFlowIndex },
        })),
      });
    });
    return pins;
  }

  private buildDataInPins(info: NodeInfo, meta: NodePortMeta) {
    const pins: GiaRecord[] = [];
    meta.dataIn.forEach((portId, index) => {
      const key = makePortKey(info.node.id, portId);
      const entries = this.dataConnections.get(key);
      if (!entries?.length) return;
      const varType = resolveVarType(info, portId);
      pins.push({
        i1: { kind: NODE_PIN_KIND.InParam, index },
        i2: { kind: NODE_PIN_KIND.InParam, index },
        type: varType ?? VAR_TYPE.UnknownVar ?? 0,
        connects: entries.map((entry) => ({
          id: entry.sourceNodeIndex,
          connect: { kind: NODE_PIN_KIND.OutParam, index: entry.sourceDataIndex },
          connect2: { kind: NODE_PIN_KIND.OutParam, index: entry.sourceDataIndex },
        })),
      });
    });
    return pins;
  }

  private createNodeProperty(nodeId: number) {
    if (this.env !== "server") {
      return null;
    }
    return {
      class: NODE_PROPERTY_CLASS.SystemDefined,
      type: NODE_PROPERTY_TYPE.Server,
      kind: NODE_PROPERTY_KIND.SysCall,
      nodeId,
    };
  }

  private collectComments() {
    for (const rawComment of this.document.comments ?? []) {
      const text = rawComment?.text?.trim();
      if (!text) continue;
      const nodeId = rawComment.nodeId?.trim();
      if (nodeId) {
        const targetNode = this.nodeInfoById.get(nodeId);
        if (!targetNode) {
          this.warnings.push(`GIA：注释指向的节点（ID=${nodeId}）不存在，已忽略。`);
          continue;
        }
        if (this.nodeComments.has(nodeId)) {
          this.warnings.push(`GIA：节点“${targetNode.node.type}”存在多个注释，仅导出第一个。`);
          continue;
        }
        this.nodeComments.set(nodeId, { content: text });
        continue;
      }
      const x = sanitizeCoordinate(rawComment.position?.x);
      const y = sanitizeCoordinate(rawComment.position?.y);
      if (rawComment.position === undefined) {
        this.warnings.push("GIA：存在未绑定节点且缺少坐标的注释，已放置在 (0, 0)。");
      }
      this.graphComments.push({ content: text, x, y });
    }
  }

  getGraphComments() {
    return this.graphComments;
  }

  private collectEdges() {
    (this.document.edges ?? []).forEach((edge) => this.processEdge(edge));
  }

  private processEdge(edge: GraphEdge) {
    const sourceInfo = this.nodeInfoById.get(edge.source.nodeId);
    const targetInfo = this.nodeInfoById.get(edge.target.nodeId);
    if (!sourceInfo || !targetInfo) {
      this.warnings.push(`GIA：无法解析连线 ${edge.id}（节点缺失）。`);
      return;
    }
    const sourcePort = sourceInfo.definition?.ports.find((port) => port.id === edge.source.portId);
    const targetPort = targetInfo.definition?.ports.find((port) => port.id === edge.target.portId);
    if (!sourcePort || !targetPort) {
      this.warnings.push(`GIA：连线 ${edge.id} 引用了未知端口。`);
      return;
    }
    if (sourcePort.kind === "flow-out" && targetPort.kind === "flow-in") {
      const targetFlowIndex = getPortIndex(targetInfo, targetPort.id, "flowIn");
      if (targetFlowIndex === -1) {
        this.warnings.push(`GIA：无法定位 ${targetInfo.node.type}.${targetPort.id} 的 flow-in 序号。`);
        return;
      }
      const key = makePortKey(sourceInfo.node.id, sourcePort.id);
      const list = this.flowConnections.get(key) ?? [];
      list.push({ targetNodeIndex: targetInfo.index, targetFlowIndex });
      this.flowConnections.set(key, list);
      return;
    }
    if (sourcePort.kind === "data-out" && targetPort.kind === "data-in") {
      const sourceDataIndex = getPortIndex(sourceInfo, sourcePort.id, "dataOut");
      if (sourceDataIndex === -1) {
        this.warnings.push(`GIA：无法定位 ${sourceInfo.node.type}.${sourcePort.id} 的 data-out 序号。`);
        return;
      }
      const key = makePortKey(targetInfo.node.id, targetPort.id);
      const list = this.dataConnections.get(key) ?? [];
      list.push({ sourceNodeIndex: sourceInfo.index, sourceDataIndex });
      this.dataConnections.set(key, list);
      return;
    }
    this.warnings.push(
      `GIA：暂不支持从 ${sourceInfo.node.type}.${sourcePort.id} 到 ${targetInfo.node.type}.${targetPort.id} 的连线。`,
    );
  }
}

const computePortMeta = (def: NodeDefinition): NodePortMeta => {
  const meta: NodePortMeta = {
    flowIn: [],
    flowOut: [],
    dataIn: [],
    dataOut: [],
  };
  def.ports.forEach((port) => {
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

const valueTypeToVarType: Partial<Record<ValueType, number>> = {
  bool: VAR_TYPE.Boolean,
  int: VAR_TYPE.Integer,
  float: VAR_TYPE.Float,
  string: VAR_TYPE.String,
  vector3: VAR_TYPE.Vector,
  entity: VAR_TYPE.Entity,
  guid: VAR_TYPE.GUID,
  enum: VAR_TYPE.EnumItem,
  camp: VAR_TYPE.Faction,
  configId: VAR_TYPE.Configuration,
  componentId: VAR_TYPE.Prefab,
};

const resolveVarType = (info: NodeInfo, portId: string): number | undefined => {
  const def = info.definition;
  if (!def) return undefined;
  const port = def.ports.find((candidate) => candidate.id === portId);
  if (!port || port.kind !== "data-in") return undefined;
  const mapped = valueTypeToVarType[port.valueType as ValueType];
  if (mapped !== undefined) {
    return mapped;
  }
  if (port.valueType === "list") {
    return VAR_TYPE.StringList ?? VAR_TYPE.UnknownVar ?? 0;
  }
  if (port.valueType === "any") {
    return VAR_TYPE.UnknownVar ?? 0;
  }
  return undefined;
};

const sanitizeCoordinate = (value?: number) => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const makePortKey = (nodeId: string, portId: string) => `${nodeId}::${portId}`;

const getPortIndex = (info: NodeInfo, portId: string, category: keyof NodePortMeta) => {
  const list = info.portMeta?.[category];
  if (!list) return -1;
  return list.indexOf(portId);
};
