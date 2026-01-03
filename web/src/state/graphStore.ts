import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';
import {
  CLIENT_BOOLEAN_RESULT_NODE_ID,
  CLIENT_GRAPH_START_NODE_ID,
  CLIENT_INTEGER_RESULT_NODE_ID,
  CLIENT_SEQUENCE_START_NODE_ID,
  GRAPH_SCHEMA_VERSION,
  GRAPH_SYSTEM_NODE_IDS,
} from '../types/node';
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphNodeData,
  GraphEnvironment,
} from '../types/node';
import {
  clientKindFromEnvironment,
  getDefaultExecutionInterval,
  normalizeGraphEnvironment,
  sanitizeExecutionInterval,
} from '../utils/graphEnvironment';
import {
  BRANCH_FLOW_OUT_PREFIX,
  MAX_BRANCH_FLOW_OUTS,
  MAX_SEQUENCE_FLOW_OUTS,
  MULTI_BRANCH_NODE_ID,
  SEQUENCE_FLOW_OUT_PREFIX,
  SEQUENCE_NODE_ID,
  getBranchFlowOutLabels,
  getSequenceFlowOutCount,
  parseBranchFlowOutIndex,
  parseSequenceFlowOutIndex,
} from '../utils/dynamicFlowOuts';
import { t as translateText } from '../utils/i18n';
import { loadEditorSettings } from '../utils/storage';

const HISTORY_LIMIT = 50;
const CLIENT_SYSTEM_NODE_DEFAULT_POSITION = { x: -240, y: -120 };
const CLIENT_START_NODE_DEFAULT_POSITION = { ...CLIENT_SYSTEM_NODE_DEFAULT_POSITION };
const CLIENT_RESULT_NODE_DEFAULT_POSITION = { ...CLIENT_SYSTEM_NODE_DEFAULT_POSITION };

type SystemNodeType = (typeof GRAPH_SYSTEM_NODE_IDS)[number];

const GRAPH_SYSTEM_NODE_ID_SET = new Set<string>(GRAPH_SYSTEM_NODE_IDS);

const isClientStartNode = (node: { type: string }) =>
  node.type === CLIENT_GRAPH_START_NODE_ID || node.type === CLIENT_SEQUENCE_START_NODE_ID;
const isSystemNode = (node: { type: string }) => GRAPH_SYSTEM_NODE_ID_SET.has(node.type);

type IndexedPortChange =
  | { type: 'insert'; index: number; mode: 'above' | 'below' }
  | { type: 'remove'; index: number };

const buildSequenceFlowOutId = (index: number) => `${SEQUENCE_FLOW_OUT_PREFIX}${index}`;
const buildBranchFlowOutId = (index: number) => `${BRANCH_FLOW_OUT_PREFIX}${index}`;

const updateEdgesForIndexedPortChange = (
  edges: GraphEdge[],
  nodeId: string,
  parseIndex: (portId: string) => number | null,
  makePortId: (index: number) => string,
  change: IndexedPortChange,
) =>
  edges.flatMap((edge) => {
    let removeEdge = false;
    const updateEndpoint = (endpoint: GraphEdge['source']) => {
      if (endpoint.nodeId !== nodeId) return endpoint;
      const portIndex = parseIndex(endpoint.portId);
      if (portIndex == null) return endpoint;
      if (change.type === 'remove') {
        if (portIndex === change.index) {
          removeEdge = true;
          return endpoint;
        }
        if (portIndex > change.index) {
          return { ...endpoint, portId: makePortId(portIndex - 1) };
        }
        return endpoint;
      }
      const shouldShift =
        change.mode === 'above' ? portIndex >= change.index : portIndex > change.index;
      if (!shouldShift) return endpoint;
      return { ...endpoint, portId: makePortId(portIndex + 1) };
    };
    const nextSource = updateEndpoint(edge.source);
    const nextTarget = updateEndpoint(edge.target);
    if (removeEdge) return [];
    if (nextSource === edge.source && nextTarget === edge.target) return [edge];
    return [{ ...edge, source: nextSource, target: nextTarget }];
  });

const computeClientStartNodePosition = (nodes: GraphNode[]) => {
  const candidates = nodes.filter((node) => !isClientStartNode(node));
  if (!candidates.length) {
    return { ...CLIENT_START_NODE_DEFAULT_POSITION };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  candidates.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { ...CLIENT_START_NODE_DEFAULT_POSITION };
  }
  return {
    x: minX - 200,
    y: minY - 60,
  };
};

const computeResultNodePosition = (nodes: GraphNode[]) => {
  const candidates = nodes.filter((node) => !isSystemNode(node));
  if (!candidates.length) {
    return { ...CLIENT_RESULT_NODE_DEFAULT_POSITION };
  }
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  candidates.forEach((node) => {
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
  });
  if (!Number.isFinite(maxX) || !Number.isFinite(minY)) {
    return { ...CLIENT_RESULT_NODE_DEFAULT_POSITION };
  }
  return {
    x: maxX + 200,
    y: minY - 60,
  };
};

const getRequiredSystemNodeTypes = (environment: GraphEnvironment): SystemNodeType[] => {
  const kind = clientKindFromEnvironment(environment);
  if (!kind) return [];
  if (kind === 'boolean') return [CLIENT_BOOLEAN_RESULT_NODE_ID];
  if (kind === 'integer') return [CLIENT_INTEGER_RESULT_NODE_ID];
  if (kind === 'creation-state' || kind === 'creation-state-decision') {
    return [CLIENT_SEQUENCE_START_NODE_ID];
  }
  return [CLIENT_GRAPH_START_NODE_ID];
};

const createSystemNode = (type: SystemNodeType, nodes: GraphNode[]): GraphNode => {
  const position =
    type === CLIENT_GRAPH_START_NODE_ID || type === CLIENT_SEQUENCE_START_NODE_ID
      ? computeClientStartNodePosition(nodes)
      : computeResultNodePosition(nodes);
  return {
    id: nanoid(),
    type,
    position,
  };
};

const reconcileSystemNodes = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  environment: GraphEnvironment,
) => {
  const requiredTypes = new Set(getRequiredSystemNodeTypes(environment));
  const nodesByType = new Map<SystemNodeType, GraphNode[]>();
  nodes.forEach((node) => {
    if (isSystemNode(node)) {
      const list = nodesByType.get(node.type as SystemNodeType) ?? [];
      list.push(node);
      nodesByType.set(node.type as SystemNodeType, list);
    }
  });

  const nodesToRemove = new Set<string>();
  nodesByType.forEach((list, type) => {
    if (!requiredTypes.has(type)) {
      list.forEach((node) => nodesToRemove.add(node.id));
    } else if (list.length > 1) {
      list
        .slice(1)
        .forEach((node) => nodesToRemove.add(node.id));
    }
  });

  const filteredNodes = nodes.filter((node) => !nodesToRemove.has(node.id));
  const nodesToAdd: GraphNode[] = [];

  requiredTypes.forEach((type) => {
    const existing = filteredNodes.find((node) => node.type === type);
    if (!existing) {
      nodesToAdd.push(createSystemNode(type, filteredNodes));
    }
  });

  if (!nodesToAdd.length && !nodesToRemove.size) {
    return { nodes, edges };
  }

  const nextNodes = [...filteredNodes, ...nodesToAdd];
  const removedIds = nodesToRemove;
  const nextEdges = edges.filter(
    (edge) => !removedIds.has(edge.source.nodeId) && !removedIds.has(edge.target.nodeId),
  );
  return { nodes: nextNodes, edges: nextEdges };
};


interface GraphCommentState {
  id: string;
  nodeId?: string;
  position?: { x: number; y: number };
  text: string;
  pinned: boolean;
  collapsed: boolean;
}

type CommentMode = 'inactive' | 'selecting';

interface GraphSnapshot {
  graphId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  comments: GraphCommentState[];
  selectedNodeId?: string;
  zoomLevel: number;
  environment: GraphEnvironment;
  executionIntervalSeconds: number;
}

interface GraphState {
  graphId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  comments: GraphCommentState[];
  environment: GraphEnvironment;
  executionIntervalSeconds: number;
  commentMode: CommentMode;
  selectedCommentId?: string;
  selectedNodeId?: string;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  setGraphId: (graphId: string) => void;
  setName: (name: string) => void;
  addNode: (node: Omit<GraphNode, 'id'> & { id?: string }) => string;
  duplicateNode: (nodeId: string) => string | undefined;
  duplicateNodes: (nodeIds: string[]) => string[];
  updateNode: (nodeId: string, updater: (node: GraphNode) => GraphNode, options?: { recordHistory?: boolean }) => void;
  repositionNodes: (
    positions: Record<string, { x: number; y: number }>,
    commentPositions?: Record<string, { x: number; y: number }>
  ) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[], options?: { recordHistory?: boolean }) => void;
  setNodeData: (nodeId: string, data: GraphNodeData) => void;
  setPortOverride: (nodeId: string, portId: string, value: unknown) => void;
  clearPortOverride: (nodeId: string, portId: string) => void;
  addSequenceFlowOut: (nodeId: string) => void;
  insertSequenceFlowOut: (nodeId: string, index: number, mode: 'above' | 'below') => void;
  removeSequenceFlowOut: (nodeId: string, index: number) => void;
  addBranchFlowOut: (nodeId: string) => void;
  insertBranchFlowOut: (nodeId: string, index: number, mode: 'above' | 'below') => void;
  removeBranchFlowOut: (nodeId: string, index: number) => void;
  setBranchFlowOutLabel: (nodeId: string, index: number, label: string) => void;
  upsertEdge: (edge: Omit<GraphEdge, 'id'> & { id?: string }, replace?: boolean) => void;
  removeEdge: (edgeId: string, options?: { recordHistory?: boolean }) => void;
  removeEdges: (edgeIds: string[], options?: { recordHistory?: boolean }) => void;
  setSelectedNode: (nodeId?: string) => void;
  setCommentMode: (mode: CommentMode) => void;
  setSelectedComment: (commentId?: string) => void;
  addComment: (nodeId: string) => string;
  addFloatingComment: (position: { x: number; y: number }) => string;
  setCommentPosition: (commentId: string, position: { x: number; y: number }) => void;
  updateCommentText: (commentId: string, text: string) => void;
  setCommentPinned: (commentId: string, pinned: boolean) => void;
  setCommentCollapsed: (commentId: string, collapsed: boolean) => void;
  removeComment: (commentId: string) => void;
  collapseUnpinnedComments: (activeNodeId?: string) => void;
  importGraph: (
    doc: GraphDocument,
    options?: { graphId?: string; recordHistory?: boolean },
  ) => void;
  exportGraph: () => GraphDocument;
  setExecutionIntervalSeconds: (value: number) => void;
  reset: (options?: { graphId?: string }) => void;
  undo: () => void;
  redo: () => void;
  zoomLevel: number;
  requestedZoom: number | null;
  setZoomLevel: (zoom: number) => void;
  setRequestedZoom: (zoom: number | null) => void;
}

const getProtectedNodeIds = (state: GraphState) =>
  new Set(state.nodes.filter(isSystemNode).map((node) => node.id));

const filterRemovableNodeIds = (state: GraphState, nodeIds: string[]) => {
  if (!nodeIds.length) return [];
  const protectedIds = getProtectedNodeIds(state);
  if (!protectedIds.size) return nodeIds;
  return nodeIds.filter((id) => !protectedIds.has(id));
};

const findSystemManagedNodeId = (state: GraphState, type: SystemNodeType) =>
  state.nodes.find((node) => node.type === type)?.id;

const cloneNode = (node: GraphNode): GraphNode => {
  const data = node.data
    ? {
        overrides: node.data.overrides ? { ...node.data.overrides } : undefined,
        controls: node.data.controls ? { ...node.data.controls } : undefined,
        sequenceFlowOutCount: node.data.sequenceFlowOutCount,
        branchFlowOutLabels: Array.isArray(node.data.branchFlowOutLabels)
          ? [...node.data.branchFlowOutLabels]
          : undefined,
      }
    : undefined;


  return {
    ...node,
    position: { ...node.position },
    data,
  };
};

const cloneEdge = (edge: GraphEdge): GraphEdge => ({
  ...edge,
  source: { ...edge.source },
  target: { ...edge.target },
});

const cloneNodes = (nodes: GraphNode[]) => nodes.map(cloneNode);
const cloneEdges = (edges: GraphEdge[]) => edges.map(cloneEdge);
const cloneComments = (comments: GraphCommentState[]) => comments.map((comment) => ({ ...comment }));

const getDefaultGraphName = () => {
  const settings = loadEditorSettings();
  return translateText('graph.defaultName', settings.uiPrimaryLanguage, settings.uiSecondaryLanguage);
};

const createSnapshot = (state: GraphState): GraphSnapshot => ({
  graphId: state.graphId,
  name: state.name,
  nodes: cloneNodes(state.nodes),
  edges: cloneEdges(state.edges),
  comments: cloneComments(state.comments),
  selectedNodeId: state.selectedNodeId,
  zoomLevel: state.zoomLevel,
  environment: state.environment,
  executionIntervalSeconds: state.executionIntervalSeconds,
});

const applySnapshot = (snapshot: GraphSnapshot) => ({
  graphId: snapshot.graphId,
  name: snapshot.name,
  nodes: cloneNodes(snapshot.nodes),
  edges: cloneEdges(snapshot.edges),
  comments: cloneComments(snapshot.comments),
  selectedNodeId: snapshot.selectedNodeId,
  zoomLevel: snapshot.zoomLevel,
  environment: snapshot.environment,
  executionIntervalSeconds: snapshot.executionIntervalSeconds,
});

const createDefaultState = (graphId?: string) => {
  const id = graphId ?? nanoid();
  return {
    name: getDefaultGraphName(),
    nodes: [],
    edges: [],
    comments: [],
    commentMode: 'inactive' as CommentMode,
    selectedCommentId: undefined,
    graphId: id,
    zoomLevel: 1,
    requestedZoom: null,
    environment: 'server' as GraphEnvironment,
    executionIntervalSeconds: 0,
  };
};

export const useGraphStore = create<GraphState>((set, get) => {
  const captureSnapshot = () => {
    const snapshot = createSnapshot({ ...get() });
    set((state) => {
      const withSnapshot = [...state.past, snapshot];
      if (withSnapshot.length > HISTORY_LIMIT) {
        withSnapshot.shift();
      }
      return {
        past: withSnapshot,
        future: [],
      };
    });
  };

  const initial = createDefaultState();

  return {
    ...initial,
    selectedNodeId: undefined,
    past: [],
    future: [],
    setGraphId: (graphId) => {
      set(() => ({
        graphId,
      }));
    },
    setName: (name) => {
      captureSnapshot();
      set(() => ({ name }));
    },
    setExecutionIntervalSeconds: (value) => {
      const state = get();
      const defaultInterval = getDefaultExecutionInterval(state.environment);
      if (defaultInterval === undefined) {
        return;
      }
      const sanitized = sanitizeExecutionInterval(value, defaultInterval);
      if (sanitized === state.executionIntervalSeconds) {
        return;
      }
      captureSnapshot();
      set(() => ({ executionIntervalSeconds: sanitized }));
    },
    addNode: (node) => {
      if (isSystemNode(node)) {
        const state = get();
        const requiredTypes = new Set(getRequiredSystemNodeTypes(state.environment));
        const type = node.type as SystemNodeType;
        if (!requiredTypes.has(type)) {
          return '';
        }
        const existingId = findSystemManagedNodeId(state, type);
        if (existingId) {
          return existingId;
        }
      }
      captureSnapshot();
      const id = node.id ?? nanoid();
      set((state) => ({
        nodes: [...state.nodes, { ...node, id }],
        selectedNodeId: id,
      }));
      return id;
    },
    duplicateNode: (nodeId) => {
      const created = get().duplicateNodes([nodeId]);
      return created[0];
    },
    duplicateNodes: (nodeIds) => {
      const uniqueIds = Array.from(new Set(nodeIds));
      if (!uniqueIds.length) return [];
      captureSnapshot();
      let createdIds: string[] = [];
      set((state) => {
        const selected = state.nodes.filter((node) => uniqueIds.includes(node.id));
        const duplicable = selected.filter((node) => !isSystemNode(node));
        if (!duplicable.length) return {};

        const idMap = new Map<string, string>();
        const duplicableIdSet = new Set(duplicable.map((node) => node.id));
        const newNodes = duplicable.map((node) => {
          const cloned = cloneNode(node);
          const id = nanoid();
          idMap.set(node.id, id);
          cloned.id = id;
          cloned.position = {
            x: cloned.position.x + 32,
            y: cloned.position.y + 32,
          };
          return cloned;
        });

        const newEdges = state.edges
          .filter(
            (edge) =>
              duplicableIdSet.has(edge.source.nodeId) &&
              duplicableIdSet.has(edge.target.nodeId)
          )
          .map((edge) => {
            const cloned = cloneEdge(edge);
            cloned.id = nanoid();
            cloned.source.nodeId = idMap.get(edge.source.nodeId) ?? edge.source.nodeId;
            cloned.target.nodeId = idMap.get(edge.target.nodeId) ?? edge.target.nodeId;
            return cloned;
          });

        createdIds = newNodes.map((node) => node.id);

        return {
          nodes: [...state.nodes, ...newNodes],
          edges: [...state.edges, ...newEdges],
          selectedNodeId: newNodes.length === 1 ? newNodes[0].id : state.selectedNodeId,
        };
      });

      return createdIds;
    },
    updateNode: (nodeId, updater, options) => {
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      set((state) => ({
        nodes: state.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
      }));
    },
    repositionNodes: (positions, commentPositions) => {
      const ids = Object.keys(positions);
      const commentIds = commentPositions ? Object.keys(commentPositions) : [];
      if (!ids.length && !commentIds.length) return;
      captureSnapshot();
      set((state) => {
        let nodesChanged = false;
        const nextNodes = state.nodes.map((node) => {
          const nextPosition = positions[node.id];
          if (!nextPosition) return node;
          if (
            node.position.x === nextPosition.x &&
            node.position.y === nextPosition.y
          ) {
            return node;
          }
          nodesChanged = true;
          return {
            ...node,
            position: { x: nextPosition.x, y: nextPosition.y },
          };
        });
        let commentsChanged = false;
        const nextComments = commentPositions
          ? state.comments.map((comment) => {
              const nextPosition = commentPositions[comment.id];
              if (!nextPosition) return comment;
              if (
                comment.position?.x === nextPosition.x &&
                comment.position?.y === nextPosition.y
              ) {
                return comment;
              }
              commentsChanged = true;
              return {
                ...comment,
                position: { x: nextPosition.x, y: nextPosition.y },
              };
            })
          : state.comments;
        if (!nodesChanged && !commentsChanged) {
          return {};
        }
        return {
          ...(nodesChanged ? { nodes: nextNodes } : {}),
          ...(commentsChanged ? { comments: nextComments } : {}),
        };
      });
    },
    removeNode: (nodeId) => {
      get().removeNodes([nodeId]);
    },
    removeNodes: (nodeIds, options) => {
      const uniqueIds = Array.from(new Set(nodeIds));
      if (!uniqueIds.length) return;
      const removableIds = filterRemovableNodeIds(get(), uniqueIds);
      if (!removableIds.length) return;
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      const idSet = new Set(removableIds);
      set((state) => {
        const remainingComments = state.comments.filter(
          (comment) => !comment.nodeId || !idSet.has(comment.nodeId)
        );
        const selectedCommentStillExists =
          state.selectedCommentId &&
          remainingComments.some((comment) => comment.id === state.selectedCommentId);
        return {
          nodes: state.nodes.filter((node) => !idSet.has(node.id)),
          edges: state.edges.filter(
            (edge) => !idSet.has(edge.source.nodeId) && !idSet.has(edge.target.nodeId)
          ),
          comments: remainingComments,
          selectedNodeId: state.selectedNodeId && idSet.has(state.selectedNodeId)
            ? undefined
            : state.selectedNodeId,
          selectedCommentId: selectedCommentStillExists ? state.selectedCommentId : undefined,
          commentMode: selectedCommentStillExists ? state.commentMode : 'inactive',
        };
      });
    },
    setNodeData: (nodeId, data) => {
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, data } : node)),
      }));
    },
    setPortOverride: (nodeId, portId, value) => {
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const overrides = { ...(node.data?.overrides ?? {}) };
          overrides[portId] = value;
          return {
            ...node,
            data: { ...node.data, overrides },
          };
        }),
      }));
    },
    clearPortOverride: (nodeId, portId) => {
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          if (!node.data?.overrides || !(portId in node.data.overrides)) return node;
          const overrides = { ...node.data.overrides };
          delete overrides[portId];
          const hasOverrides = Object.keys(overrides).length > 0;
          const controls = node.data?.controls;
          const sequenceFlowOutCount = node.data?.sequenceFlowOutCount;
          const branchFlowOutLabels = Array.isArray(node.data?.branchFlowOutLabels)
            ? [...node.data.branchFlowOutLabels]
            : undefined;
          const data: GraphNodeData | undefined =
            hasOverrides ||
            controls ||
            sequenceFlowOutCount !== undefined ||
            branchFlowOutLabels !== undefined
            ? {
                overrides: hasOverrides ? overrides : undefined,
                controls,
                sequenceFlowOutCount,
                branchFlowOutLabels,
              }
            : undefined;
          return { ...node, data };
        }),
      }));
    },
    addSequenceFlowOut: (nodeId) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== SEQUENCE_NODE_ID) return;
      const count = getSequenceFlowOutCount(target.data);
      if (count >= MAX_SEQUENCE_FLOW_OUTS) return;
      const nextCount = count + 1;
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...(node.data ?? {}), sequenceFlowOutCount: nextCount },
              }
            : node
        ),
      }));
    },
    insertSequenceFlowOut: (nodeId, index, mode) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== SEQUENCE_NODE_ID) return;
      const count = getSequenceFlowOutCount(target.data);
      if (count >= MAX_SEQUENCE_FLOW_OUTS || index < 1 || index > count) return;
      const nextCount = count + 1;
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...(node.data ?? {}), sequenceFlowOutCount: nextCount },
              }
            : node
        ),
        edges: updateEdgesForIndexedPortChange(
          state.edges,
          nodeId,
          parseSequenceFlowOutIndex,
          buildSequenceFlowOutId,
          { type: 'insert', index, mode },
        ),
      }));
    },
    removeSequenceFlowOut: (nodeId, index) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== SEQUENCE_NODE_ID) return;
      const count = getSequenceFlowOutCount(target.data);
      if (count <= 1 || index < 1 || index > count) return;
      const nextCount = count - 1;
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...(node.data ?? {}), sequenceFlowOutCount: nextCount },
              }
            : node
        ),
        edges: updateEdgesForIndexedPortChange(
          state.edges,
          nodeId,
          parseSequenceFlowOutIndex,
          buildSequenceFlowOutId,
          { type: 'remove', index },
        ),
      }));
    },
    addBranchFlowOut: (nodeId) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== MULTI_BRANCH_NODE_ID) return;
      const labels = getBranchFlowOutLabels(target.data);
      if (labels.length >= MAX_BRANCH_FLOW_OUTS) return;
      const nextLabels = [...labels, ''];
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data ?? {}), branchFlowOutLabels: nextLabels } }
            : node
        ),
      }));
    },
    insertBranchFlowOut: (nodeId, index, mode) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== MULTI_BRANCH_NODE_ID) return;
      const labels = getBranchFlowOutLabels(target.data);
      if (labels.length >= MAX_BRANCH_FLOW_OUTS || index < 1 || index > labels.length) return;
      const insertIndex = mode === 'above' ? index - 1 : index;
      const nextLabels = [...labels];
      nextLabels.splice(insertIndex, 0, '');
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data ?? {}), branchFlowOutLabels: nextLabels } }
            : node
        ),
        edges: updateEdgesForIndexedPortChange(
          state.edges,
          nodeId,
          parseBranchFlowOutIndex,
          buildBranchFlowOutId,
          { type: 'insert', index, mode },
        ),
      }));
    },
    removeBranchFlowOut: (nodeId, index) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== MULTI_BRANCH_NODE_ID) return;
      const labels = getBranchFlowOutLabels(target.data);
      if (index < 1 || index > labels.length) return;
      const nextLabels = [...labels];
      nextLabels.splice(index - 1, 1);
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data ?? {}), branchFlowOutLabels: nextLabels } }
            : node
        ),
        edges: updateEdgesForIndexedPortChange(
          state.edges,
          nodeId,
          parseBranchFlowOutIndex,
          buildBranchFlowOutId,
          { type: 'remove', index },
        ),
      }));
    },
    setBranchFlowOutLabel: (nodeId, index, label) => {
      const state = get();
      const target = state.nodes.find((node) => node.id === nodeId);
      if (!target || target.type !== MULTI_BRANCH_NODE_ID) return;
      const labels = getBranchFlowOutLabels(target.data);
      if (index < 1 || index > labels.length) return;
      const nextLabels = [...labels];
      nextLabels[index - 1] = label;
      captureSnapshot();
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...(node.data ?? {}), branchFlowOutLabels: nextLabels } }
            : node
        ),
      }));
    },
    upsertEdge: (edge, replace = true) => {
      captureSnapshot();
      set((state) => {
        let edges = state.edges;
        if (replace) {
          edges = edges.filter(
            (existing) =>
              !(
                existing.source.nodeId === edge.source.nodeId &&
                existing.source.portId === edge.source.portId &&
                existing.target.nodeId === edge.target.nodeId &&
                existing.target.portId === edge.target.portId
              )
          );
        }
        const id = edge.id ?? nanoid();
        return { edges: [...edges, { ...edge, id }] };
      });
    },
    removeEdge: (edgeId, options) => {
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      set((state) => ({ edges: state.edges.filter((edge) => edge.id !== edgeId) }));
    },
    removeEdges: (edgeIds, options) => {
      const uniqueIds = Array.from(new Set(edgeIds));
      if (!uniqueIds.length) return;
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      const idSet = new Set(uniqueIds);
      set((state) => ({ edges: state.edges.filter((edge) => !idSet.has(edge.id)) }));
    },
    setSelectedNode: (nodeId) =>
      set((state) => (state.selectedNodeId === nodeId ? {} : { selectedNodeId: nodeId })),
    setCommentMode: (mode) =>
      set((state) => (state.commentMode === mode ? {} : { commentMode: mode })),
    setSelectedComment: (commentId) =>
      set((state) =>
        state.selectedCommentId === commentId ? {} : { selectedCommentId: commentId }
      ),
    addComment: (nodeId) => {
      const existing = get().comments.find((comment) => comment.nodeId === nodeId);
      if (existing) {
        set(() => ({
          selectedCommentId: existing.id,
          commentMode: 'inactive',
        }));
        return existing.id;
      }
      captureSnapshot();
      const commentId = nanoid();
      set((state) => ({
        comments: [
          ...state.comments,
          { id: commentId, nodeId, text: '', pinned: false, collapsed: false },
        ],
        selectedCommentId: commentId,
        commentMode: 'inactive',
      }));
      return commentId;
    },
    addFloatingComment: (position) => {
      captureSnapshot();
      const commentId = nanoid();
      set((state) => ({
        comments: [
          ...state.comments,
          {
            id: commentId,
            position,
            text: '',
            pinned: false,
            collapsed: false,
          },
        ],
        selectedCommentId: commentId,
        commentMode: 'inactive',
      }));
      return commentId;
    },
    updateCommentText: (commentId, text) => {
      const target = get().comments.find((comment) => comment.id === commentId);
      if (!target || target.text === text) return;
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, text } : comment
        ),
      }));
    },
    setCommentPinned: (commentId, pinned) => {
      const target = get().comments.find((comment) => comment.id === commentId);
      if (!target || target.pinned === pinned) return;
      captureSnapshot();
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, pinned } : comment
        ),
      }));
    },
    setCommentCollapsed: (commentId, collapsed) => {
      const target = get().comments.find((comment) => comment.id === commentId);
      if (!target || target.collapsed === collapsed) return;
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, collapsed } : comment
        ),
      }));
    },
    removeComment: (commentId) => {
      captureSnapshot();
      set((state) => ({
        comments: state.comments.filter((comment) => comment.id !== commentId),
        selectedCommentId:
          state.selectedCommentId === commentId ? undefined : state.selectedCommentId,
        commentMode: state.selectedCommentId === commentId ? 'inactive' : state.commentMode,
      }));
    },
    setCommentPosition: (commentId, position) => {
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, position } : comment
        ),
      }));
    },
    collapseUnpinnedComments: (activeNodeId) => {
      set((state) => {
        let changed = false;
        const comments = state.comments.map((comment) => {
          if (!comment.nodeId) return comment;
          if (comment.pinned || comment.nodeId === activeNodeId) return comment;
          if (comment.collapsed) return comment;
          changed = true;
          return { ...comment, collapsed: true };
        });
        return changed ? { comments } : {};
      });
    },
    setRequestedZoom: (zoom) =>
      set((state) => (state.requestedZoom === zoom ? {} : { requestedZoom: zoom })),
    setZoomLevel: (zoom) =>
      set((state) => (state.zoomLevel === zoom ? {} : { zoomLevel: zoom })),
    importGraph: (doc, options) => {
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      const incomingGraphId = options?.graphId ?? get().graphId ?? nanoid();
      const normalizedComments: GraphCommentState[] = [];
      if (Array.isArray(doc.comments)) {
        for (const comment of doc.comments) {
          const rawNodeId = (comment.nodeId ?? '').trim();
          const position = comment.position
            ? { x: Number(comment.position.x) || 0, y: Number(comment.position.y) || 0 }
            : undefined;
          if (!rawNodeId && !position) continue;
          normalizedComments.push({
            id: comment.id ?? nanoid(),
            nodeId: rawNodeId ? rawNodeId : undefined,
            position,
            text: comment.text ?? '',
            pinned: Boolean(comment.pinned),
            collapsed: Boolean(comment.collapsed),
          });
        }
      }
      const fallbackEnvironment: GraphEnvironment = options?.graphId
        ? get().environment
        : 'server';
      const fallbackKind = clientKindFromEnvironment(fallbackEnvironment) ?? undefined;
      const environment = normalizeGraphEnvironment(doc.environment ?? fallbackEnvironment, {
        fallbackClientKind: fallbackKind,
      });
      const defaultInterval = getDefaultExecutionInterval(environment);
      const executionIntervalSeconds =
        defaultInterval !== undefined
          ? sanitizeExecutionInterval(
              doc.executionIntervalSeconds ?? defaultInterval,
              defaultInterval,
            )
          : 0;
      const clonedNodes = cloneNodes(doc.nodes);
      const clonedEdges = cloneEdges(doc.edges);
      const { nodes: normalizedNodes, edges: normalizedEdges } = reconcileSystemNodes(
        clonedNodes,
        clonedEdges,
        environment,
      );
      set(() => ({
        name: doc.name,
        nodes: normalizedNodes,
        edges: normalizedEdges,
        comments: normalizedComments,
        commentMode: 'inactive',
        selectedCommentId: undefined,
        graphId: incomingGraphId,
        selectedNodeId: undefined,
        zoomLevel: 1,
        requestedZoom: null,
        environment,
        executionIntervalSeconds,
      }));
    },
    exportGraph: () => {
      const state = get();
      const environment = state.environment;
      const intervalApplicable = getDefaultExecutionInterval(environment) !== undefined;
      return {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        name: state.name,
        nodes: cloneNodes(state.nodes),
        edges: cloneEdges(state.edges),
        comments: cloneComments(state.comments),
        environment,
        executionIntervalSeconds: intervalApplicable ? state.executionIntervalSeconds : undefined,
      } satisfies GraphDocument;
    },
    reset: (options) => {
      captureSnapshot();
      const nextGraphId = options?.graphId ?? nanoid();
      set(() => ({
        ...createDefaultState(nextGraphId),
        selectedNodeId: undefined,
      }));
    },
    undo: () => {
      const state = get();
      if (!state.past.length) return;
      const previous = state.past[state.past.length - 1];
      const currentSnapshot = createSnapshot(state);
      set(() => ({
        ...applySnapshot(previous),
        past: state.past.slice(0, -1),
        future: [currentSnapshot, ...state.future],
        commentMode: 'inactive',
        selectedCommentId: undefined,
        requestedZoom: previous.zoomLevel,
      }));
    },
    redo: () => {
      const state = get();
      if (!state.future.length) return;
      const next = state.future[0];
      const currentSnapshot = createSnapshot(state);
      set(() => ({
        ...applySnapshot(next),
        past: [...state.past, currentSnapshot],
        future: state.future.slice(1),
        commentMode: 'inactive',
        selectedCommentId: undefined,
        requestedZoom: next.zoomLevel,
      }));
    },
  };
});
