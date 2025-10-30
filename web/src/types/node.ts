﻿export type NodeKind =
  | 'event'
  | 'action'
  | 'query'
  | 'flow-control'
  | 'logic'
  | 'math'
  | 'data';

export type PortKind = 'flow-in' | 'flow-out' | 'data-in' | 'data-out';

export type ValueType =
  | 'bool'
  | 'int'
  | 'float'
  | 'string'
  | 'vector3'
  | 'entity'
  | 'guid'
  | 'list'
  | 'enum'
  | 'any'
  | 'camp'
  | 'configId'
  | 'componentId';

export type PortAccessory = 'gear';
export type PortDecoratorPosition = 'before' | 'after' | 'center';

export interface PortUiHints {
  accessory?: PortAccessory;
  decorator?: string;
  decoratorPosition?: PortDecoratorPosition;
  placeholder?: string;
}

export interface PortDefinitionBase {
  id: string;
  label: string;
  description?: string;
  allowMultipleConnections?: boolean;
  optional?: boolean;
  ui?: PortUiHints;
}

export interface FlowPortDefinition extends PortDefinitionBase {
  kind: 'flow-in' | 'flow-out';
}

export interface DataPortDefinition extends PortDefinitionBase {
  kind: 'data-in' | 'data-out';
  valueType: ValueType;
  accepts?: ValueType[];
  defaultValue?: unknown;
  enumValues?: Array<{ label: string; value: string | number }>;
}

export type PortDefinition = FlowPortDefinition | DataPortDefinition;

export type NodeLayoutItem =
  | { type: 'port'; id: string }
  | { type: 'decor'; id: string; content: string; position?: 'inline' | 'block' };

export interface NodeDefinition {
  id: string;
  displayName: string;
  category: string;
  kind: NodeKind;
  description?: string;
  icon?: string;
  headerColor?: string;
  ports: PortDefinition[];
  controls?: NodeControlDefinition[];
  layout?: NodeLayoutItem[];
}

export interface NodeControlDefinition {
  id: string;
  label: string;
  valueType: ValueType;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string | number }>;
}

export interface GraphNodeData {
  overrides?: Record<string, unknown>;
  controls?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  type: string; // references NodeDefinition.id
  position: { x: number; y: number };
  label?: string;
  data?: GraphNodeData;
}

export interface GraphEdgeEndpoint {
  nodeId: string;
  portId: string;
}

export interface GraphEdge {
  id: string;
  source: GraphEdgeEndpoint;
  target: GraphEdgeEndpoint;
}

export interface GraphComment {
  id: string;
  nodeId?: string;
  position?: { x: number; y: number };
  text: string;
  pinned?: boolean;
  collapsed?: boolean;
}

export type GraphSchemaVersion = 1 | 2;

export interface GraphDocument {
  schemaVersion: GraphSchemaVersion;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  comments?: GraphComment[];
}

export const GRAPH_SCHEMA_VERSION: GraphSchemaVersion = 2;

export interface ConnectionPreview {
  handleType: 'source' | 'target';
  nodeId: string;
  port: PortDefinition;
}
