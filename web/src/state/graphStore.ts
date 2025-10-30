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
}

interface GraphState {
  graphId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  comments: GraphCommentState[];
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
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[], options?: { recordHistory?: boolean }) => void;
  setNodeData: (nodeId: string, data: GraphNodeData) => void;
  setPortOverride: (nodeId: string, portId: string, value: unknown) => void;
  clearPortOverride: (nodeId: string, portId: string) => void;
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
  reset: (options?: { graphId?: string }) => void;
  undo: () => void;
  redo: () => void;
  zoomLevel: number;
  requestedZoom: number | null;
  setZoomLevel: (zoom: number) => void;
  setRequestedZoom: (zoom: number | null) => void;
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
const cloneComments = (comments: GraphCommentState[]) => comments.map((comment) => ({ ...comment }));

const createSnapshot = (state: GraphState): GraphSnapshot => ({
  graphId: state.graphId,
  name: state.name,
  nodes: cloneNodes(state.nodes),
  edges: cloneEdges(state.edges),
  comments: cloneComments(state.comments),
  selectedNodeId: state.selectedNodeId,
  zoomLevel: state.zoomLevel,
});

const applySnapshot = (snapshot: GraphSnapshot) => ({
  graphId: snapshot.graphId,
  name: snapshot.name,
  nodes: cloneNodes(snapshot.nodes),
  edges: cloneEdges(snapshot.edges),
  comments: cloneComments(snapshot.comments),
  selectedNodeId: snapshot.selectedNodeId,
  zoomLevel: snapshot.zoomLevel,
});

const createDefaultState = (graphId?: string) => {
  const id = graphId ?? nanoid();
  return {
    name: '新建节点图',
    nodes: [],
    edges: [],
    comments: [],
    commentMode: 'inactive' as CommentMode,
    selectedCommentId: undefined,
    graphId: id,
    zoomLevel: 1,
    requestedZoom: null,
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
      set(() => ({
        name: doc.name,
        nodes: cloneNodes(doc.nodes),
        edges: cloneEdges(doc.edges),
        comments: normalizedComments,
        commentMode: 'inactive',
        selectedCommentId: undefined,
        graphId: incomingGraphId,
        selectedNodeId: undefined,
        zoomLevel: 1,
        requestedZoom: null,
      }));
    },
    exportGraph: () => {
      const state = get();
      return {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        name: state.name,
        nodes: cloneNodes(state.nodes),
        edges: cloneEdges(state.edges),
        comments: cloneComments(state.comments),
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
