import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';
import { GRAPH_SCHEMA_VERSION } from '../types/node';
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphNodeData,
} from '../types/node';

const HISTORY_LIMIT = 50;

interface GraphSnapshot {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, unknown>;
  projectId: string;
  selectedNodeId?: string;
}

interface GraphState {
  projectId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, unknown>;
  selectedNodeId?: string;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  setProjectId: (projectId: string) => void;
  setName: (name: string) => void;
  addNode: (node: Omit<GraphNode, 'id'> & { id?: string }) => string;
  duplicateNode: (nodeId: string) => string | undefined;
  duplicateNodes: (nodeIds: string[]) => string[];
  updateNode: (nodeId: string, updater: (node: GraphNode) => GraphNode, options?: { recordHistory?: boolean }) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[], options?: { recordHistory?: boolean }) => void;
  setNodeData: (nodeId: string, data: GraphNodeData) => void;
  setPortOverride: (nodeId: string, portId: string, value: unknown) => void;
  clearPortOverride: (nodeId: string, portId: string) => void;
  upsertEdge: (edge: Omit<GraphEdge, 'id'> & { id?: string }, replace?: boolean) => void;
  removeEdge: (edgeId: string, options?: { recordHistory?: boolean }) => void;
  removeEdges: (edgeIds: string[], options?: { recordHistory?: boolean }) => void;
  setSelectedNode: (nodeId?: string) => void;
  importGraph: (doc: GraphDocument, options?: { projectId?: string; recordHistory?: boolean }) => void;
  exportGraph: () => GraphDocument;
  reset: (options?: { projectId?: string }) => void;
  undo: () => void;
  redo: () => void;
}

const cloneNode = (node: GraphNode): GraphNode => {
  const data = node.data
    ? {
        overrides: node.data.overrides ? { ...node.data.overrides } : undefined,
        controls: node.data.controls ? { ...node.data.controls } : undefined,
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

const createSnapshot = (state: GraphState): GraphSnapshot => ({
  name: state.name,
  nodes: cloneNodes(state.nodes),
  edges: cloneEdges(state.edges),
  metadata: state.metadata ? { ...state.metadata } : undefined,
  projectId: state.projectId,
  selectedNodeId: state.selectedNodeId,
});

const applySnapshot = (snapshot: GraphSnapshot) => ({
  name: snapshot.name,
  nodes: cloneNodes(snapshot.nodes),
  edges: cloneEdges(snapshot.edges),
  metadata: snapshot.metadata ? { ...snapshot.metadata } : undefined,
  projectId: snapshot.projectId,
  selectedNodeId: snapshot.selectedNodeId,
});

const createDefaultState = (projectId?: string) => {
  const id = projectId ?? nanoid();
  return {
    name: '新建节点图',
    nodes: [],
    edges: [],
    metadata: { projectId: id } as Record<string, unknown>,
    projectId: id,
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
    setProjectId: (projectId) => {
      set((state) => ({
        projectId,
        metadata: { ...(state.metadata ?? {}), projectId },
      }));
    },
    setName: (name) => {
      captureSnapshot();
      set(() => ({ name }));
    },
    addNode: (node) => {
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
        if (!selected.length) return {};

        const idMap = new Map<string, string>();
        const newNodes = selected.map((node) => {
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
              uniqueIds.includes(edge.source.nodeId) &&
              uniqueIds.includes(edge.target.nodeId)
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
    removeNode: (nodeId) => {
      get().removeNodes([nodeId]);
    },
    removeNodes: (nodeIds, options) => {
      const uniqueIds = Array.from(new Set(nodeIds));
      if (!uniqueIds.length) return;
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      const idSet = new Set(uniqueIds);
      set((state) => ({
        nodes: state.nodes.filter((node) => !idSet.has(node.id)),
        edges: state.edges.filter(
          (edge) => !idSet.has(edge.source.nodeId) && !idSet.has(edge.target.nodeId)
        ),
        selectedNodeId: state.selectedNodeId && idSet.has(state.selectedNodeId)
          ? undefined
          : state.selectedNodeId,
      }));
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
          const data: GraphNodeData | undefined = hasOverrides || controls
            ? {
                overrides: hasOverrides ? overrides : undefined,
                controls,
              }
            : undefined;
          return { ...node, data };
        }),
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
    setSelectedNode: (nodeId) => set(() => ({ selectedNodeId: nodeId })),
    importGraph: (doc, options) => {
      if (options?.recordHistory !== false) {
        captureSnapshot();
      }
      const incomingMetadata = doc.metadata ? { ...doc.metadata } : undefined;
      const incomingProjectId =
        options?.projectId ??
        (typeof incomingMetadata?.projectId === 'string' && incomingMetadata.projectId
          ? String(incomingMetadata.projectId)
          : nanoid());
      const nextMetadata = { ...(incomingMetadata ?? {}), projectId: incomingProjectId };
      set(() => ({
        name: doc.name,
        nodes: cloneNodes(doc.nodes),
        edges: cloneEdges(doc.edges),
        metadata: nextMetadata,
        projectId: incomingProjectId,
        selectedNodeId: undefined,
      }));
    },
    exportGraph: () => {
      const state = get();
      const metadata = { ...(state.metadata ?? {}), projectId: state.projectId };
      return {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        name: state.name,
        nodes: cloneNodes(state.nodes),
        edges: cloneEdges(state.edges),
        metadata,
        updatedAt: new Date().toISOString(),
      } satisfies GraphDocument;
    },
    reset: (options) => {
      captureSnapshot();
      const nextProjectId = options?.projectId ?? nanoid();
      set(() => ({
        ...createDefaultState(nextProjectId),
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
      }));
    },
  };
});
