import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
} from 'react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import classNames from 'classnames';
import ReactFlow, { ReactFlowProvider, SelectionMode, useReactFlow } from 'reactflow';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnConnectEnd,
  OnConnectStart,
  OnEdgesChange,
  OnNodesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  nodeDefinitions,
  nodeDefinitionsById,
} from '../data/nodeDefinitions';
import { useGraphStore } from '../state/graphStore';
import MiliastraNode from './MiliastraNode';
import {
  GRAPH_SYSTEM_NODE_IDS,
  type ConnectionPreview,
  type PortDefinition,
} from '../types/node';
import NodeLibrary from './NodeLibrary';
import GraphCommentsOverlay from './GraphCommentsOverlay';
import {
  canConnectPorts,
  isDataPort,
  isFlowPort,
} from '../utils/graph';
import { getEnvironmentTopFolder } from '../utils/graphEnvironment';
import {
  getNodeDefinitionsForEnvironment,
  isNodeAllowedInEnvironment,
} from '../utils/nodeAvailability';
import { NODE_LIBRARY_TOUCH_DRAG_EVENT, type NodeLibraryTouchDragDetail } from '../utils/touchDrag';
import type { EditorSettings } from '../utils/storage';
import './GraphCanvas.css';

const nodeTypes = { miliastra: MiliastraNode } as const;

interface GraphCanvasProps {
  isMobileMode?: boolean;
  settings: EditorSettings;
}

type ScreenPoint = { x: number; y: number };

type FlowRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SelectionBox = {
  start: ScreenPoint;
  current: ScreenPoint;
};

type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ClickSelectionPreview = {
  left: number;
  top: number;
  width: number;
  height: number;
  mode: SelectionMode;
};

type PositionedEdge = Edge & {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
};

const MIN_SELECTION_DISTANCE = 4;
const INTERSECTION_EPSILON = 1e-4;
const TWO_FINGER_TAP_DISTANCE = 18;
const TWO_FINGER_TAP_DURATION = 400;

const isPointInsideRect = (point: ScreenPoint, rect: FlowRect) =>
  point.x >= rect.minX &&
  point.x <= rect.maxX &&
  point.y >= rect.minY &&
  point.y <= rect.maxY;

const orientation = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < INTERSECTION_EPSILON) return 0;
  return value > 0 ? 1 : -1;
};

const onSegment = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
  Math.min(a.x, c.x) - INTERSECTION_EPSILON <= b.x &&
  b.x <= Math.max(a.x, c.x) + INTERSECTION_EPSILON &&
  Math.min(a.y, c.y) - INTERSECTION_EPSILON <= b.y &&
  b.y <= Math.max(a.y, c.y) + INTERSECTION_EPSILON;

const segmentsIntersect = (p1: ScreenPoint, p2: ScreenPoint, q1: ScreenPoint, q2: ScreenPoint) => {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, q1, p2)) return true;
  if (o2 === 0 && onSegment(p1, q2, p2)) return true;
  if (o3 === 0 && onSegment(q1, p1, q2)) return true;
  if (o4 === 0 && onSegment(q1, p2, q2)) return true;
  return false;
};

const lineIntersectsRect = (start: ScreenPoint, end: ScreenPoint, rect: FlowRect) => {
  if (isPointInsideRect(start, rect) || isPointInsideRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.minX, y: rect.minY };
  const topRight = { x: rect.maxX, y: rect.minY };
  const bottomLeft = { x: rect.minX, y: rect.maxY };
  const bottomRight = { x: rect.maxX, y: rect.maxY };


  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
};

const buildFlowRect = (a: ScreenPoint, b: ScreenPoint): FlowRect => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

const rectanglesIntersect = (a: ScreenRect, b: ScreenRect) =>
  a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

const computeSelectionBounds = (nodes: Node[], edges: Edge[]): FlowRect | null => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const width = node.width ?? 0;
    const height = node.height ?? 0;
    const position = node.positionAbsolute ?? node.position;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
  });

  edges.forEach((edge) => {
    const positioned = edge as PositionedEdge;
    const { sourceX, sourceY, targetX, targetY } = positioned;
    if (
      sourceX == null ||
      sourceY == null ||
      targetX == null ||
      targetY == null
    ) {
      return;
    }
    minX = Math.min(minX, sourceX, targetX);
    minY = Math.min(minY, sourceY, targetY);
    maxX = Math.max(maxX, sourceX, targetX);
    maxY = Math.max(maxY, sourceY, targetY);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
};

type FloatingPanelState =
  | {
      type: 'node';
      nodeId: string;
      screen: ScreenPoint;
    }
  | {
      type: 'edge';
      edgeId: string;
      screen: ScreenPoint;
    }
  | {
      type: 'canvas';
      screen: ScreenPoint;
      flowPosition: ScreenPoint;
    }
  | {
      type: 'connection';
      screen: ScreenPoint;
      flowPosition: ScreenPoint;
      connection: ConnectionPreview;
    }
  | {
      type: 'selection';
      nodeIds: string[];
      screen: ScreenPoint;
    }
  | null;

const useViewportAdjustedPosition = (
  anchor: ScreenPoint | null,
  deps: DependencyList
) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<ScreenPoint | null>(anchor);
  const previousDepsRef = useRef<DependencyList>(deps);
  const [depsVersion, setDepsVersion] = useState(0);

  useEffect(() => {
    const previous = previousDepsRef.current;
    let changed = previous.length !== deps.length;
    if (!changed) {
      for (let i = 0; i < deps.length; i += 1) {
        if (previous[i] !== deps[i]) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      previousDepsRef.current = deps;
      setDepsVersion((value) => value + 1);
    }
  }, [deps]);

  useLayoutEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }
    const element = ref.current;
    if (!element) {
      setPosition(anchor);
      return;
    }
    const { offsetWidth, offsetHeight } = element;
    const padding = 12;
    let left = anchor.x;
    let top = anchor.y;
    if (left + offsetWidth + padding > window.innerWidth) {
      left = Math.max(padding, window.innerWidth - offsetWidth - padding);
    }
    if (top + offsetHeight + padding > window.innerHeight) {
      top = Math.max(padding, window.innerHeight - offsetHeight - padding);
    }
    setPosition({ x: left, y: top });
  }, [anchor, depsVersion]);

  return { ref, position } as const;
};

const FloatingPanel: React.FC<{
  anchor: ScreenPoint | null;
  className?: string;
  deps?: DependencyList;
  children: React.ReactNode;
}> = ({ anchor, className, children, deps = [] }) => {
  const { ref, position } = useViewportAdjustedPosition(anchor, deps);
  if (!position) return null;
  return (
    <div
      ref={ref}
      className={classNames('floating-panel', className)}
      style={{ left: position.x, top: position.y }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
};

const extractEventPosition = (event: MouseEvent | TouchEvent): ScreenPoint => {
  if ('changedTouches' in event && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  if ('touches' in event && event.touches.length > 0) {
    const touch = event.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  return {
    x: (event as MouseEvent).clientX,
    y: (event as MouseEvent).clientY,
  };
};

const SYSTEM_NODE_ID_SET = new Set<string>(GRAPH_SYSTEM_NODE_IDS as readonly string[]);

const GraphCanvasInner = ({ isMobileMode = false, settings }: GraphCanvasProps) => {
  const reactFlow = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const environment = useGraphStore((state) => state.environment);
  const availableDefinitions = useMemo(
    () => getNodeDefinitionsForEnvironment(environment, { includeSystem: false }),
    [environment]
  );
  const protectedNodeIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((node) => SYSTEM_NODE_ID_SET.has(node.type))
          .map((node) => node.id)
      ),
    [nodes]
  );
  const comments = useGraphStore((state) => state.comments);
  const updateNode = useGraphStore((state) => state.updateNode);
  const removeNode = useGraphStore((state) => state.removeNode);
  const removeNodesBatch = useGraphStore((state) => state.removeNodes);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);
  const duplicateNodesBatch = useGraphStore((state) => state.duplicateNodes);
  const removeEdge = useGraphStore((state) => state.removeEdge);
  const removeEdgesBatch = useGraphStore((state) => state.removeEdges);
  const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
  const upsertEdge = useGraphStore((state) => state.upsertEdge);
  const clearOverride = useGraphStore((state) => state.clearPortOverride);
  const setZoomLevel = useGraphStore((state) => state.setZoomLevel);
  const requestedZoom = useGraphStore((state) => state.requestedZoom);
  const setRequestedZoom = useGraphStore((state) => state.setRequestedZoom);
  const commentMode = useGraphStore((state) => state.commentMode);
  const setCommentMode = useGraphStore((state) => state.setCommentMode);
  const addComment = useGraphStore((state) => state.addComment);
  const addFloatingComment = useGraphStore((state) => state.addFloatingComment);
  const setSelectedComment = useGraphStore((state) => state.setSelectedComment);
  const collapseUnpinnedComments = useGraphStore((state) => state.collapseUnpinnedComments);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const commentByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    comments.forEach((comment) => {
      if (comment.nodeId) {
        map.set(comment.nodeId, comment.id);
      }
    });
    return map;
  }, [comments]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [floatingPanel, setFloatingPanel] = useState<FloatingPanelState>(null);
  const [activeConnection, setActiveConnection] =
    useState<ConnectionPreview | null>(null);
  const [connectionValueTypeFilter, setConnectionValueTypeFilter] =
    useState<string>('all');
  const connectionSuccessRef = useRef(false);
  const skipGlobalClickCloseRef = useRef(false);
  const [currentSelectionMode, setCurrentSelectionMode] = useState<SelectionMode>(SelectionMode.Full);
  const [isCrossSelection, setIsCrossSelection] = useState(false);
  const [connectionCursor, setConnectionCursor] = useState<'valid' | 'invalid' | null>(null);
  const [hasPartialSelection, setHasPartialSelection] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const selectionStartRef = useRef<ScreenPoint | null>(null);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const selectionActiveRef = useRef(false);
  const selectionModeRef = useRef<SelectionMode>(SelectionMode.Full);
  const crossSelectionRef = useRef(false);
  const skipEdgeHistoryRef = useRef(false);
  const panButtonStateRef = useRef({
    active: false,
    moved: false,
    origin: { x: 0, y: 0 },
  });
  const previousSelectedIdsRef = useRef<string[]>([]);
  const libraryTouchDragRef = useRef<{ definitionId: string; screen: ScreenPoint } | null>(null);
  const clickSelectionStartRef = useRef<ScreenPoint | null>(null);
  const [clickSelectionPreview, setClickSelectionPreview] = useState<ClickSelectionPreview | null>(null);
  const watermarkText =
    getEnvironmentTopFolder(environment) === 'client' ? '客户端节点图编辑' : '服务器节点图编辑';
  const selectionHasProtectedNode =
    floatingPanel?.type === 'selection'
      ? floatingPanel.nodeIds.some((nodeId) => protectedNodeIds.has(nodeId))
      : false;
  const singleNodeIsProtected =
    floatingPanel?.type === 'node' ? protectedNodeIds.has(floatingPanel.nodeId) : false;
  const nodeLongPressRef = useRef<{ nodeId: string; timeoutId: number | null; triggered: boolean; screen: ScreenPoint } | null>(null);
  const mobileContextTapRef = useRef<{
    active: boolean;
    startTouches: Array<{ id: number; x: number; y: number }>;
    lastTouches: Array<{ id: number; x: number; y: number }>;
    startTime: number;
  } | null>(null);

  const [isMousePanning, setIsMousePanning] = useState(false);
  const [isClickSelectionActive, setIsClickSelectionActive] = useState(false);
  const panMouseButton = isMobileMode ? 0 : settings.panButton === 'middle' ? 1 : 2;
  const dragSelectionEnabled = !isMobileMode && settings.selectionActivation === 'drag';
  const clickSelectionEnabled = !isMobileMode && settings.selectionActivation === 'click';
  const multiSelectBehavior = isMobileMode ? 'leftTouchRightBox' : settings.multiSelectBehavior;
  const zoomWithWheel =
    settings.zoomControl === 'wheel' || settings.zoomControl === 'both';
  const zoomWithKeys =
    settings.zoomControl === 'keys' || settings.zoomControl === 'both';

  const determineSelectionMode = useCallback(
    (deltaX: number) => {
      if (multiSelectBehavior === 'touch') {
        return SelectionMode.Partial;
      }
      if (multiSelectBehavior === 'box') {
        return SelectionMode.Full;
      }
      if (multiSelectBehavior === 'leftTouchRightBox') {
        return deltaX < 0 ? SelectionMode.Partial : SelectionMode.Full;
      }
      if (multiSelectBehavior === 'leftBoxRightTouch') {
        return deltaX < 0 ? SelectionMode.Full : SelectionMode.Partial;
      }
      return SelectionMode.Partial;
    },
    [multiSelectBehavior],
  );

  const updateClickSelectionPreview = useCallback(
    (start: ScreenPoint, current: ScreenPoint) => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      const left = Math.min(start.x, current.x) - wrapperRect.left;
      const top = Math.min(start.y, current.y) - wrapperRect.top;
      const width = Math.abs(current.x - start.x);
      const height = Math.abs(current.y - start.y);
      const mode = determineSelectionMode(current.x - start.x);
      setClickSelectionPreview({
        left,
        top,
        width,
        height,
        mode,
      });
    },
    [determineSelectionMode],
  );

  useEffect(() => {
    const handleGlobalClick = () => {
      if (skipGlobalClickCloseRef.current) {
        skipGlobalClickCloseRef.current = false;
        return;
      }
      setFloatingPanel(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFloatingPanel(null);
      setActiveConnection(null);
      setConnectionCursor(null);
      clickSelectionStartRef.current = null;
      setClickSelectionPreview(null);
      setIsClickSelectionActive(false);
      const state = useGraphStore.getState();
      if (state.commentMode === 'selecting') {
        setCommentMode('inactive');
      }
      if (state.selectedCommentId) {
        setSelectedComment(undefined);
        collapseUnpinnedComments(undefined);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [collapseUnpinnedComments, setCommentMode, setConnectionCursor, setSelectedComment]);

  useEffect(() => {
    const selectedIds = reactFlow
      .getNodes()
      .filter((node) => node.selected)
      .map((node) => node.id);
    previousSelectedIdsRef.current = selectedIds;
  });

  useEffect(() => {
    if (!isMobileMode) {
      libraryTouchDragRef.current = null;
      return;
    }

    const handleTouchDragEvent = (event: Event) => {
      const custom = event as CustomEvent<NodeLibraryTouchDragDetail>;
      const detail = custom.detail;
      if (!detail || !nodeDefinitionsById[detail.definitionId]) return;
      const screen = { x: detail.clientX, y: detail.clientY };

      switch (detail.phase) {
        case 'start':
          libraryTouchDragRef.current = {
            definitionId: detail.definitionId,
            screen,
          };
          break;
        case 'move':
          if (libraryTouchDragRef.current) {
            libraryTouchDragRef.current.screen = screen;
          }
          break;
        case 'end': {
          const state = libraryTouchDragRef.current;
          libraryTouchDragRef.current = null;
          if (!state) return;
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (
            !rect ||
            screen.x < rect.left ||
            screen.x > rect.right ||
            screen.y < rect.top ||
            screen.y > rect.bottom
          ) {
            return;
          }
          const flowPosition = reactFlow.screenToFlowPosition(screen);
          const graphState = useGraphStore.getState();
          graphState.addNode({
            type: detail.definitionId,
            position: flowPosition,
            data: {},
          });
          setFloatingPanel(null);
          break;
        }
        case 'cancel':
          libraryTouchDragRef.current = null;
          break;
      }
    };

    window.addEventListener(
      NODE_LIBRARY_TOUCH_DRAG_EVENT,
      handleTouchDragEvent as EventListener
    );
    return () => {
      window.removeEventListener(
        NODE_LIBRARY_TOUCH_DRAG_EVENT,
        handleTouchDragEvent as EventListener
      );
      libraryTouchDragRef.current = null;
    };
  }, [isMobileMode, reactFlow, setFloatingPanel]);

  useEffect(() => {
    setZoomLevel(reactFlow.getZoom());
  }, [reactFlow, setZoomLevel]);
  useEffect(() => {
    if (!zoomWithKeys) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key;
      if (key !== '+' && key !== '=' && key !== '-') return;
      event.preventDefault();
      const direction = key === '-' ? -1 : 1;
      const currentZoom = reactFlow.getZoom();
      const nextZoom = Math.min(1.5, Math.max(0.25, Number((currentZoom + direction * 0.1).toFixed(2))));
      reactFlow.zoomTo(nextZoom);
      setZoomLevel(nextZoom);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlow, setZoomLevel, zoomWithKeys]);

  useEffect(() => {
    if (zoomWithKeys) return;
    const preventPageZoom = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key;
      if (key !== '+' && key !== '=' && key !== '-') return;
      event.preventDefault();
    };
    window.addEventListener('keydown', preventPageZoom);
    return () => window.removeEventListener('keydown', preventPageZoom);
  }, [zoomWithKeys]);


  useEffect(() => {
    if (requestedZoom == null) return;
    reactFlow.zoomTo(requestedZoom);
    setZoomLevel(requestedZoom);
    setRequestedZoom(null);
  }, [requestedZoom, reactFlow, setRequestedZoom, setZoomLevel]);

  useEffect(() => {
    collapseUnpinnedComments(selectedNodeId);
  }, [collapseUnpinnedComments, selectedNodeId]);

  useEffect(() => {
    if (!activeConnection) {
      setConnectionCursor(null);
    }
  }, [activeConnection]);

  useEffect(() => {
    selectionModeRef.current = currentSelectionMode;
  }, [currentSelectionMode]);

  useEffect(() => {
    crossSelectionRef.current = isCrossSelection;
  }, [isCrossSelection]);

  const clearSelectionState = useCallback(() => {
    setSelectedNode(undefined);
    setFloatingPanel(null);
    setIsCrossSelection(false);
    setHasPartialSelection(false);
    setIsSelectionActive(false);
    selectionActiveRef.current = false;
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    selectionModeRef.current = SelectionMode.Full;
    setCurrentSelectionMode(SelectionMode.Full);
    clickSelectionStartRef.current = null;
    setClickSelectionPreview(null);
    setIsClickSelectionActive(false);
    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    if (selectedNodes.length) {
      reactFlow.setNodes((nodes) =>
        nodes.map((node) => (node.selected ? { ...node, selected: false } : node))
      );
    }
    const selectedEdges = reactFlow.getEdges().filter((edge) => edge.selected);
    if (selectedEdges.length) {
      reactFlow.setEdges((edges) =>
        edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge))
      );
    }
  }, [reactFlow, setSelectedNode]);

  const applyManualSelection = useCallback(
    (selectedIds: string[]) => {
      previousSelectedIdsRef.current = selectedIds;
      if (selectedIds.length) {
        const anchorId = selectedIds[selectedIds.length - 1];
        setSelectedNode(anchorId);
        collapseUnpinnedComments(anchorId);
      } else {
        setSelectedNode(undefined);
        collapseUnpinnedComments(undefined);
      }
    },
    [collapseUnpinnedComments, setSelectedNode],
  );

  const getSelectionBounds = useCallback(() => {
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return null;

    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    const selectedEdges = reactFlow.getEdges().filter((edge) => edge.selected);
    if (!selectedNodes.length && !selectedEdges.length) return null;

    const bounds = computeSelectionBounds(selectedNodes, selectedEdges);
    if (!bounds) return null;

    const topLeft = reactFlow.flowToScreenPosition({ x: bounds.minX, y: bounds.minY });
    const bottomRight = reactFlow.flowToScreenPosition({ x: bounds.maxX, y: bounds.maxY });
    const left = Math.min(topLeft.x, bottomRight.x) - wrapperRect.left;
    const right = Math.max(topLeft.x, bottomRight.x) - wrapperRect.left;
    const top = Math.min(topLeft.y, bottomRight.y) - wrapperRect.top;
    const bottom = Math.max(topLeft.y, bottomRight.y) - wrapperRect.top;

    if (right <= left || bottom <= top) return null;

    return { left, top, right, bottom };
  }, [reactFlow]);

  const isPointInsideSelection = useCallback(
    (point: ScreenPoint) => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return false;
      const bounds = getSelectionBounds();
      if (!bounds) return false;
      const localX = point.x - wrapperRect.left;
      const localY = point.y - wrapperRect.top;
      return localX >= bounds.left && localX <= bounds.right && localY >= bounds.top && localY <= bounds.bottom;
    },
    [getSelectionBounds]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!selectionActiveRef.current || !selectionStartRef.current) return;
      if ((event.buttons & 1) === 0 && !isClickSelectionActive) return;
      const start = selectionStartRef.current;
      const current = { x: event.clientX, y: event.clientY };
      selectionBoxRef.current = { start, current };
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance < MIN_SELECTION_DISTANCE) return;
      const nextMode = determineSelectionMode(dx);
      const shouldCrossSelect = nextMode === SelectionMode.Partial;
      if (shouldCrossSelect !== crossSelectionRef.current) {
        setIsCrossSelection(shouldCrossSelect);
      }
      if (nextMode !== selectionModeRef.current) {
        setCurrentSelectionMode(nextMode);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [determineSelectionMode, isClickSelectionActive]);

  useEffect(() => {
    if (!clickSelectionEnabled) {
      clickSelectionStartRef.current = null;
      setClickSelectionPreview(null);
      setIsClickSelectionActive(false);
      return;
    }
    const handleMove = (event: PointerEvent) => {
      const start = clickSelectionStartRef.current;
      if (!start) return;
      updateClickSelectionPreview(start, { x: event.clientX, y: event.clientY });
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [clickSelectionEnabled, updateClickSelectionPreview]);


  useEffect(() => {
    if (floatingPanel?.type === 'connection') {
      if (isDataPort(floatingPanel.connection.port)) {
        setConnectionValueTypeFilter(floatingPanel.connection.port.valueType ?? 'all');
      } else {
        setConnectionValueTypeFilter('all');
      }
    } else {
      setConnectionValueTypeFilter('all');
    }
  }, [floatingPanel]);

  const rfNodes: Node[] = useMemo(() => {
    return nodes.flatMap((node) => {
      const definition = nodeDefinitionsById[node.type];
      if (!definition) return [];
      const rfNode: Node = {
        id: node.id,
        type: 'miliastra',
        position: node.position,
        data: {
          nodeId: node.id,
          definition,
          label: node.label,
          overrides: node.data?.overrides,
          controls: node.data?.controls,
          connectionPreview: activeConnection,
        },
      };
      return [rfNode];
    });
  }, [nodes, activeConnection]);
  const portKindMap = useMemo(() => {
    const map = new Map<string, PortDefinition['kind']>();
    nodes.forEach((node) => {
      const definition = nodeDefinitionsById[node.type];
      if (!definition) return;
      definition.ports.forEach((port) => {
        map.set(`${node.id}:${port.id}`, port.kind);
      });
    });
    return map;
  }, [nodes]);

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => {
        const sourceKey = `${edge.source.nodeId}:${edge.source.portId}`;
        const targetKey = `${edge.target.nodeId}:${edge.target.portId}`;
        const sourceKind = portKindMap.get(sourceKey);
        const targetKind = portKindMap.get(targetKey);
        const isDataEdge =
          sourceKind?.startsWith('data') && targetKind?.startsWith('data');
        return {
          id: edge.id,
          source: edge.source.nodeId,
          sourceHandle: edge.source.portId,
          target: edge.target.nodeId,
          targetHandle: edge.target.portId,
          className: isDataEdge ? 'graph-edge--data' : undefined,
        };
      }),
    [edges, portKindMap]
  );

  const draggingNodesRef = useRef(new Set<string>());

  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removals: string[] = [];
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          const isDragging = change.dragging === true;
          const draggingNodes = draggingNodesRef.current;
          let recordHistory = true;
          if (isDragging) {
            if (draggingNodes.has(change.id)) {
              recordHistory = false;
            } else {
              draggingNodes.add(change.id);
              recordHistory = true;
            }
          } else {
            draggingNodes.delete(change.id);
            recordHistory = true;
          }

          updateNode(
            change.id,
            (node) => ({
              ...node,
              position: change.position ?? node.position,
            }),
            { recordHistory }
          );
        }
        if (change.type === 'remove') {
          removals.push(change.id);
        }
      });

      if (removals.length) {
        skipEdgeHistoryRef.current = true;
        removeNodesBatch(removals);
        skipEdgeHistoryRef.current = false;
      }
    },
    [removeNodesBatch, updateNode]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removals: string[] = [];
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removals.push(change.id);
        }
      });
      if (removals.length) {
        removeEdgesBatch(removals, { recordHistory: !skipEdgeHistoryRef.current });
      }
    },
    [removeEdgesBatch]
  );

  const validateConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceDefinition = nodeDefinitionsById[sourceNode.type];
      const targetDefinition = nodeDefinitionsById[targetNode.type];
      if (!sourceDefinition || !targetDefinition) return false;
      const sourcePort = sourceDefinition.ports.find(
        (port) => port.id === connection.sourceHandle
      );
      const targetPort = targetDefinition.ports.find(
        (port) => port.id === connection.targetHandle
      );
      if (!sourcePort || !targetPort) return false;
      if (
        connection.source === connection.target &&
        isFlowPort(sourcePort) &&
        isFlowPort(targetPort)
      ) {
        return false;
      }
      return canConnectPorts(sourcePort, targetPort);
    },
    [nodes]
  );

  const handleConnect: (connection: Connection) => void = useCallback(
    (connection) => {
      setFloatingPanel(null);
      setActiveConnection(null);
      if (!validateConnection(connection)) return;
      connectionSuccessRef.current = true;
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return;
      }
      const state = useGraphStore.getState();
      const targetNode = state.nodes.find((node) => node.id === connection.target);
      const targetDefinition = targetNode
        ? nodeDefinitionsById[targetNode.type]
        : undefined;
      const targetPort = targetDefinition?.ports.find(
        (port) => port.id === connection.targetHandle
      );

      if (targetPort && isDataPort(targetPort) && targetPort.kind === 'data-in') {
        if (!targetPort.allowMultipleConnections) {
          const existingEdges = state.edges.filter(
            (edge) =>
              edge.target.nodeId === connection.target &&
              edge.target.portId === connection.targetHandle
          );
          existingEdges.forEach((edge) =>
            state.removeEdge(edge.id, { recordHistory: false })
          );
          state.clearPortOverride(connection.target, connection.targetHandle);
        }
      }

      upsertEdge({
        source: { nodeId: connection.source, portId: connection.sourceHandle },
        target: { nodeId: connection.target, portId: connection.targetHandle },
      });
      if (targetPort && isDataPort(targetPort) && targetPort.kind === 'data-in') {
        clearOverride(connection.target, connection.targetHandle);
      }
      setConnectionCursor(null);
    },
    [clearOverride, upsertEdge, validateConnection]
  );

  const handleConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      connectionSuccessRef.current = false;
      setFloatingPanel(null);
      setConnectionCursor('invalid');
      if (!params.handleId || !params.nodeId || !params.handleType) {
        setActiveConnection(null);
        return;
      }
      const node = nodes.find((item) => item.id === params.nodeId);
      const definition = node ? nodeDefinitionsById[node.type] : undefined;
      const port = definition?.ports.find((item) => item.id === params.handleId);
      if (!port) {
        setActiveConnection(null);
        return;
      }
      setActiveConnection({
        handleType: params.handleType,
        nodeId: params.nodeId,
        port,
      });
    },
    [nodes]
  );

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      if (!activeConnection) return;
      const targetPosition = extractEventPosition(event);
      if (!connectionSuccessRef.current) {
        skipGlobalClickCloseRef.current = true;
        setFloatingPanel({
          type: 'connection',
          screen: targetPosition,
          flowPosition: reactFlow.screenToFlowPosition(targetPosition),
          connection: activeConnection,
        });
      }
      setActiveConnection(null);
      connectionSuccessRef.current = false;
      setConnectionCursor(null);
    },
    [activeConnection, reactFlow]
  );

  const clearNodeLongPress = useCallback(() => {
    const state = nodeLongPressRef.current;
    if (state?.timeoutId) {
      window.clearTimeout(state.timeoutId);
    }
    nodeLongPressRef.current = null;
  }, []);

  const scheduleNodeLongPress = useCallback(
    (nodeId: string, screen: ScreenPoint) => {
      if (!isMobileMode) return;
      clearNodeLongPress();
      const timeoutId = window.setTimeout(() => {
        if (nodeLongPressRef.current && nodeLongPressRef.current.nodeId === nodeId) {
          nodeLongPressRef.current.triggered = true;
        }
      }, 2000);
      nodeLongPressRef.current = { nodeId, timeoutId, triggered: false, screen };
    },
    [clearNodeLongPress, isMobileMode],
  );

  const openNodeMenuAtScreen = useCallback(
    (nodeId: string, screen: ScreenPoint) => {
      const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
      if (selectedNodes.length > 1 && selectedNodes.some((item) => item.id === nodeId)) {
        setFloatingPanel({
          type: 'selection',
          nodeIds: selectedNodes.map((item) => item.id),
          screen,
        });
        return;
      }
      setSelectedNode(nodeId);
      setFloatingPanel({
        type: 'node',
        nodeId,
        screen,
      });
    },
    [reactFlow, setSelectedNode]
  );


  const handleNodeDragStart = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!isMobileMode) {
        clearNodeLongPress();
        return;
      }
      scheduleNodeLongPress(node.id, { x: event.clientX, y: event.clientY });
    },
    [clearNodeLongPress, isMobileMode, scheduleNodeLongPress],
  );

  const finalizeNodeLongPress = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!isMobileMode) {
        clearNodeLongPress();
        return;
      }
      const state = nodeLongPressRef.current;
      if (!state || state.nodeId !== node.id) {
        clearNodeLongPress();
        return;
      }
      const screen = { x: event.clientX, y: event.clientY };
      const shouldOpen = state.triggered;
      clearNodeLongPress();
      if (shouldOpen) {
        skipGlobalClickCloseRef.current = true;
        openNodeMenuAtScreen(node.id, screen);
      }
    },
    [clearNodeLongPress, isMobileMode, openNodeMenuAtScreen, skipGlobalClickCloseRef],
  );

  const handleNodeDragMove = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!isMobileMode) return;
      const state = nodeLongPressRef.current;
      if (state && state.nodeId === node.id) {
        state.screen = { x: event.clientX, y: event.clientY };
      }
    },
    [isMobileMode],
  );

  const handleNodeDragStop = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (!isMobileMode) {
        clearNodeLongPress();
        return;
      }
      finalizeNodeLongPress(event, node);
    },
    [clearNodeLongPress, finalizeNodeLongPress, isMobileMode],
  );

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent, node: Node) => {
      if (commentMode === 'selecting') {
        setSelectedNode(node.id);
        setHasPartialSelection(false);
        const commentId = addComment(node.id);
        setSelectedComment(commentId);
        collapseUnpinnedComments(node.id);
        return;
      }

      const previouslySelected = previousSelectedIdsRef.current;
      const alreadySelected = previouslySelected.includes(node.id);
      const otherSelected = previouslySelected.filter((id) => id !== node.id);
      const isToggleModifier = event.ctrlKey || event.metaKey;
      const isAddModifier = event.shiftKey;
      const multiSelect = isToggleModifier || isAddModifier;
      const shouldSelect = multiSelect ? (isToggleModifier ? !alreadySelected : true) : true;

      reactFlow.setNodes((nodes) =>
        nodes.map((item) => {
          if (item.id === node.id) {
            if (item.selected === shouldSelect) return item;
            return { ...item, selected: shouldSelect };
          }
          if (!multiSelect && item.selected) {
            return { ...item, selected: false };
          }
          return item;
        })
      );

      const nextSelectedIds = shouldSelect
        ? Array.from(new Set([...otherSelected, node.id]))
        : otherSelected;
      previousSelectedIdsRef.current = nextSelectedIds;

      if (shouldSelect) {
        setSelectedNode(node.id);
      } else if (nextSelectedIds.length) {
        setSelectedNode(nextSelectedIds[nextSelectedIds.length - 1]);
      } else {
        setSelectedNode(undefined);
      }

      setHasPartialSelection(false);
      const anchorId = shouldSelect
        ? node.id
        : nextSelectedIds[nextSelectedIds.length - 1];
      collapseUnpinnedComments(anchorId);
    },
    [
      addComment,
      collapseUnpinnedComments,
      commentMode,
      previousSelectedIdsRef,
      reactFlow,
      setHasPartialSelection,
      setSelectedComment,
      setSelectedNode,
    ]
  );

  const performClickSelection = useCallback(
    (startPoint: ScreenPoint, endPoint: ScreenPoint, additive: boolean) => {
      setIsClickSelectionActive(false);
      setClickSelectionPreview(null);
      const deltaX = endPoint.x - startPoint.x;
      const deltaY = endPoint.y - startPoint.y;
      const travelDistance = Math.hypot(deltaX, deltaY);

      requestAnimationFrame(() => {
        if (travelDistance < MIN_SELECTION_DISTANCE) {
          const flowPoint = reactFlow.screenToFlowPosition(startPoint);
          const nodes = reactFlow.getNodes();
          let targetNodeId: string | null = null;
          for (const node of nodes) {
            const width = node.width ?? 0;
            const height = node.height ?? 0;
            const position = node.positionAbsolute ?? node.position;
            if (
              flowPoint.x >= position.x &&
              flowPoint.x <= position.x + width &&
              flowPoint.y >= position.y &&
              flowPoint.y <= position.y + height
            ) {
              targetNodeId = node.id;
              break;
            }
          }
        if (targetNodeId) {
          reactFlow.setNodes((prev) =>
            prev.map((node) => {
              const shouldSelect = additive
                ? node.selected || node.id === targetNodeId
                : node.id === targetNodeId;
              return node.selected === shouldSelect ? node : { ...node, selected: shouldSelect };
            }),
          );
          const finalIds = additive
            ? Array.from(new Set([...previousSelectedIdsRef.current, targetNodeId]))
            : [targetNodeId];
          applyManualSelection(finalIds);
        }
        setHasPartialSelection(false);
        return;
      }

        const nextMode = determineSelectionMode(deltaX);
        const isPartial = nextMode === SelectionMode.Partial;
        selectionModeRef.current = nextMode;
        crossSelectionRef.current = isPartial;
        setCurrentSelectionMode(nextMode);
        setIsCrossSelection(isPartial);
        const selectionScreenRect: ScreenRect = {
          left: Math.min(startPoint.x, endPoint.x),
          right: Math.max(startPoint.x, endPoint.x),
          top: Math.min(startPoint.y, endPoint.y),
          bottom: Math.max(startPoint.y, endPoint.y),
        };
        const startFlow = reactFlow.screenToFlowPosition(startPoint);
        const endFlow = reactFlow.screenToFlowPosition(endPoint);
        const selectionRect = buildFlowRect(startFlow, endFlow);
        const selectedNodeIds = new Set<string>();
        reactFlow.getNodes().forEach((node) => {
          const width = node.width ?? 0;
          const height = node.height ?? 0;
          const position = node.positionAbsolute ?? node.position;
          const nodeRect: FlowRect = {
            minX: position.x,
            minY: position.y,
            maxX: position.x + width,
            maxY: position.y + height,
          };
          const intersects =
            nodeRect.minX <= selectionRect.maxX &&
            nodeRect.maxX >= selectionRect.minX &&
            nodeRect.minY <= selectionRect.maxY &&
            nodeRect.maxY >= selectionRect.minY;
          const contains =
            selectionRect.minX <= nodeRect.minX &&
            selectionRect.maxX >= nodeRect.maxX &&
            selectionRect.minY <= nodeRect.minY &&
            selectionRect.maxY >= nodeRect.maxY;
          const shouldSelect = isPartial ? intersects : contains;
          if (shouldSelect) {
            selectedNodeIds.add(node.id);
          }
        });
        reactFlow.setNodes((prev) =>
          prev.map((node) => {
            const baseSelected = additive ? node.selected : false;
            const shouldSelect = baseSelected || selectedNodeIds.has(node.id);
            return node.selected === shouldSelect ? node : { ...node, selected: shouldSelect };
          }),
        );
        const edges = reactFlow.getEdges();
        const finalSelectedEdges = new Set<string>(
          additive ? edges.filter((edge) => edge.selected).map((edge) => edge.id) : [],
        );
        if (isPartial) {
          edges.forEach((edge) => {
            const positioned = edge as PositionedEdge;
            const { sourceX, sourceY, targetX, targetY } = positioned;
            if (sourceX == null || sourceY == null || targetX == null || targetY == null) {
              return;
            }
            const edgeStart = { x: sourceX, y: sourceY };
            const edgeEnd = { x: targetX, y: targetY };
            if (lineIntersectsRect(edgeStart, edgeEnd, selectionRect)) {
              finalSelectedEdges.add(edge.id);
            }
          });
        }
        reactFlow.setEdges((prev) =>
          prev.map((edge) => {
            const shouldSelect = finalSelectedEdges.has(edge.id);
            return edge.selected === shouldSelect ? edge : { ...edge, selected: shouldSelect };
          }),
        );
        const finalIds = additive
          ? Array.from(new Set([...previousSelectedIdsRef.current, ...selectedNodeIds]))
          : Array.from(selectedNodeIds);
        applyManualSelection(finalIds);
        setHasPartialSelection(isPartial && (finalIds.length > 0 || finalSelectedEdges.size > 0));
        const bubbleElements = document.querySelectorAll<HTMLDivElement>(
          '.graph-comment-bubble[data-comment-id][data-floating="true"]',
        );
        let selectedFloatingCommentId: string | undefined;
        bubbleElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const bubbleRect: ScreenRect = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          if (!selectedFloatingCommentId && rectanglesIntersect(selectionScreenRect, bubbleRect)) {
            selectedFloatingCommentId = element.dataset.commentId ?? undefined;
          }
        });
        const state = useGraphStore.getState();
        const currentCommentId = state.selectedCommentId;
        const currentComment = currentCommentId
          ? state.comments.find((comment) => comment.id === currentCommentId)
          : undefined;
        const currentIsFloating = currentComment ? !currentComment.nodeId : false;
        if (selectedFloatingCommentId) {
          if (selectedFloatingCommentId !== currentCommentId) {
            setSelectedComment(selectedFloatingCommentId);
          }
        } else if (currentIsFloating && currentCommentId) {
          setSelectedComment(undefined);
        }
      });
    }, [applyManualSelection, determineSelectionMode, reactFlow, setClickSelectionPreview, setHasPartialSelection, setIsClickSelectionActive, setSelectedComment]);

  const handlePaneClick = useCallback(
    (event?: ReactMouseEvent<Element>) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (commentMode === 'selecting') {
        if (event) {
          const flowPoint = reactFlow.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          const commentId = addFloatingComment(flowPoint);
          setSelectedComment(commentId);
        }
        setCommentMode('inactive');
        collapseUnpinnedComments(undefined);
        return;
      }
      if (clickSelectionEnabled && event && event.button === 0) {
        const point = { x: event.clientX, y: event.clientY };
        if (!clickSelectionStartRef.current) {
          if (!event.shiftKey) {
            clearSelectionState();
          }
          setSelectedComment(undefined);
          collapseUnpinnedComments(undefined);
          clickSelectionStartRef.current = point;
          updateClickSelectionPreview(point, point);
          setIsClickSelectionActive(true);
          return;
        }
        const startPoint = clickSelectionStartRef.current;
        clickSelectionStartRef.current = null;
        setClickSelectionPreview(null);
        setIsClickSelectionActive(false);
        if (startPoint) {
          performClickSelection(startPoint, point, event.shiftKey);
        }
        return;
      }
      if (event) {
        const point = { x: event.clientX, y: event.clientY };
        if (isPointInsideSelection(point)) {
          return;
        }
      }
      setSelectedComment(undefined);
      collapseUnpinnedComments(undefined);
      clearSelectionState();
    },
    [
      addFloatingComment,
      clearSelectionState,
      clickSelectionEnabled,
      collapseUnpinnedComments,
      commentMode,
      isPointInsideSelection,
      performClickSelection,
      reactFlow,
      setCommentMode,
      setSelectedComment,
      setIsClickSelectionActive,
      updateClickSelectionPreview,
    ],
  );

  const handlePaneClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!clickSelectionEnabled) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const paneElement = target.closest('.react-flow__pane');
      if (!paneElement) return;
      handlePaneClick(event);
    },
    [clickSelectionEnabled, handlePaneClick],
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/x-node-type');
      if (!type) return;
      const definition = nodeDefinitionsById[type];
      if (!definition) return;
      if (!isNodeAllowedInEnvironment(definition.id, environment)) return;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      useGraphStore.getState().addNode({
        type: definition.id,
        position,
        data: {},
      });
    },
    [environment, reactFlow]
  );

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSelectionStart = useCallback((event: ReactMouseEvent<Element>) => {
    const start = { x: event.clientX, y: event.clientY };
    setIsSelectionActive(true);
    selectionActiveRef.current = true;
    selectionStartRef.current = start;
    selectionBoxRef.current = { start, current: start };
    selectionModeRef.current = SelectionMode.Full;
    crossSelectionRef.current = false;
    setCurrentSelectionMode(SelectionMode.Full);
    setIsCrossSelection(false);
    setHasPartialSelection(false);
  }, []);

  const handleSelectionEnd = useCallback(
    (event: ReactMouseEvent<Element>) => {
      const activeBox = selectionBoxRef.current;
      const startPoint = activeBox?.start ?? selectionStartRef.current;
      const lastPoint = activeBox?.current ?? startPoint;
      const eventPoint = { x: event.clientX, y: event.clientY };

      setIsSelectionActive(false);
      selectionActiveRef.current = false;
      selectionStartRef.current = null;
      selectionBoxRef.current = null;
      selectionModeRef.current = SelectionMode.Full;
      setCurrentSelectionMode(SelectionMode.Full);

      crossSelectionRef.current = false;
      setIsCrossSelection(false);

      if (!startPoint || !lastPoint) {
        setHasPartialSelection(false);
        return;
      }

      const finalPoint =
        Math.hypot(eventPoint.x - lastPoint.x, eventPoint.y - lastPoint.y) <= 1
          ? lastPoint
          : eventPoint;

      const deltaX = finalPoint.x - startPoint.x;
      const deltaY = finalPoint.y - startPoint.y;
      if (Math.hypot(deltaX, deltaY) < MIN_SELECTION_DISTANCE) {
        setHasPartialSelection(false);
        return;
      }

      const nextMode = determineSelectionMode(deltaX);
      const isPartialSelection = nextMode === SelectionMode.Partial;
      selectionModeRef.current = nextMode;
      crossSelectionRef.current = isPartialSelection;
      setCurrentSelectionMode(nextMode);
      setIsCrossSelection(isPartialSelection);

      const selectionScreenRect: ScreenRect = {
        left: Math.min(startPoint.x, finalPoint.x),
        right: Math.max(startPoint.x, finalPoint.x),
        top: Math.min(startPoint.y, finalPoint.y),
        bottom: Math.max(startPoint.y, finalPoint.y),
      };

      const startFlow = reactFlow.screenToFlowPosition(startPoint);
      const endFlow = reactFlow.screenToFlowPosition(finalPoint);
      const selectionRect = buildFlowRect(startFlow, endFlow);

      requestAnimationFrame(() => {
        const allNodes = reactFlow.getNodes();
        const allEdges = reactFlow.getEdges();
        const initiallySelectedEdges = new Set(
          allEdges.filter((edge) => edge.selected).map((edge) => edge.id)
        );
        const finalSelectedEdges = new Set(initiallySelectedEdges);

        if (isPartialSelection) {
          allEdges.forEach((edge) => {
            const positioned = edge as PositionedEdge;
            const { sourceX, sourceY, targetX, targetY } = positioned;
            if (
              sourceX == null ||
              sourceY == null ||
              targetX == null ||
              targetY == null
            ) {
              return;
            }
            const edgeStart = { x: sourceX, y: sourceY };
            const edgeEnd = { x: targetX, y: targetY };
            if (lineIntersectsRect(edgeStart, edgeEnd, selectionRect)) {
              finalSelectedEdges.add(edge.id);
            }
          });
        }

        const shouldUpdateEdges = allEdges.some(
          (edge) => edge.selected !== finalSelectedEdges.has(edge.id)
        );

        if (shouldUpdateEdges) {
          reactFlow.setEdges((prev) =>
            prev.map((edge) => ({
              ...edge,
              selected: finalSelectedEdges.has(edge.id),
            }))
          );
        }

        const anySelected =
          allNodes.some((node) => node.selected) ||
          allEdges.some((edge) => edge.selected);
        setHasPartialSelection(isPartialSelection && anySelected);

        const bubbleElements = document.querySelectorAll<HTMLDivElement>(
          '.graph-comment-bubble[data-comment-id][data-floating="true"]'
        );
        let selectedFloatingCommentId: string | undefined;
        bubbleElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const bubbleRect: ScreenRect = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
          if (!selectedFloatingCommentId && rectanglesIntersect(selectionScreenRect, bubbleRect)) {
            selectedFloatingCommentId = element.dataset.commentId ?? undefined;
          }
        });

        const state = useGraphStore.getState();
        const currentCommentId = state.selectedCommentId;
        const currentComment = currentCommentId
          ? state.comments.find((comment) => comment.id === currentCommentId)
          : undefined;
        const currentIsFloating = currentComment ? !currentComment.nodeId : false;

        if (selectedFloatingCommentId) {
          if (selectedFloatingCommentId !== currentCommentId) {
            setSelectedComment(selectedFloatingCommentId);
          }
        } else if (currentIsFloating && currentCommentId) {
          setSelectedComment(undefined);
        }
      });
    },
    [determineSelectionMode, reactFlow, setHasPartialSelection, setSelectedComment]
  );

  const openNodeMenu = useCallback(
    (event: ReactMouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      openNodeMenuAtScreen(nodeId, { x: event.clientX, y: event.clientY });
    },
    [openNodeMenuAtScreen]
  );

  const openEdgeMenu = useCallback((event: ReactMouseEvent, edgeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFloatingPanel({
      type: 'edge',
      edgeId,
      screen: { x: event.clientX, y: event.clientY },
    });
  }, []);

  const openCanvasMenuAtScreen = useCallback(
    (screen: ScreenPoint) => {
      const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
      const selectedEdges = reactFlow.getEdges().filter((edge) => edge.selected);
      const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
      const insideSelection = hasSelection && isPointInsideSelection(screen);
      if (insideSelection) {
        if (selectedNodes.length > 1) {
          setFloatingPanel({
            type: 'selection',
            nodeIds: selectedNodes.map((node) => node.id),
            screen,
          });
          return;
        }
        if (selectedNodes.length === 1) {
          const nodeId = selectedNodes[0].id;
          setSelectedNode(nodeId);
          setFloatingPanel({
            type: 'node',
            nodeId,
            screen,
          });
          return;
        }
        if (selectedEdges.length) {
          setFloatingPanel({
            type: 'selection',
            nodeIds: selectedNodes.map((node) => node.id),
            screen,
          });
          return;
        }
      }
      if (hasSelection) {
        clearSelectionState();
      } else {
        setFloatingPanel(null);
      }
      setFloatingPanel({
        type: 'canvas',
        screen,
        flowPosition: reactFlow.screenToFlowPosition(screen),
      });
    },
    [clearSelectionState, isPointInsideSelection, reactFlow, setSelectedNode]
  );

  const openCanvasMenu = useCallback(
    (event: ReactMouseEvent<Element> | MouseEvent) => {
      event.preventDefault();
      if (panButtonStateRef.current.moved) {
        panButtonStateRef.current.moved = false;
        panButtonStateRef.current.active = false;
        return;
      }
      const clientX = 'clientX' in event ? event.clientX : 0;
      const clientY = 'clientY' in event ? event.clientY : 0;
      openCanvasMenuAtScreen({ x: clientX, y: clientY });
    },
    [openCanvasMenuAtScreen]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (protectedNodeIds.has(nodeId)) {
        setFloatingPanel(null);
        setHasPartialSelection(false);
        return;
      }
      removeNode(nodeId);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [protectedNodeIds, removeNode, setFloatingPanel, setHasPartialSelection]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (protectedNodeIds.has(nodeId)) {
        setFloatingPanel(null);
        setHasPartialSelection(false);
        return;
      }
      duplicateNode(nodeId);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [duplicateNode, protectedNodeIds, setFloatingPanel, setHasPartialSelection]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      removeEdge(edgeId);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [removeEdge]
  );

  const handleCreateNode = useCallback(
    (definitionId: string, position: ScreenPoint) => {
      const definition = nodeDefinitionsById[definitionId];
      if (!definition) return;
      if (!isNodeAllowedInEnvironment(definition.id, environment)) return;
      const id = useGraphStore.getState().addNode({
        type: definition.id,
        position,
        data: {},
      });
      setSelectedNode(id);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [environment, setFloatingPanel, setHasPartialSelection, setSelectedNode]
  );

  const handleInsertNodeForConnection = useCallback(
    (definitionId: string, panel: Extract<FloatingPanelState, { type: 'connection' }>) => {
      const definition = nodeDefinitionsById[definitionId];
      if (!definition) return;
      if (!isNodeAllowedInEnvironment(definition.id, environment)) return;
      const store = useGraphStore.getState();
      const newNodeId = store.addNode({
        type: definition.id,
        position: panel.flowPosition,
        data: {},
      });

      const connection = panel.connection;
      const sourcePortCandidates = definition.ports.filter((port) => {
        if (connection.handleType === 'source') {
          return canConnectPorts(connection.port, port);
        }
        return canConnectPorts(port, connection.port);
      });

      if (!sourcePortCandidates.length) {
        setFloatingPanel(null);
        setSelectedNode(newNodeId);
        return;
      }

      let chosenPort = sourcePortCandidates[0];
      if (connectionValueTypeFilter !== 'all') {
        const preferred = sourcePortCandidates.find((port) =>
          isDataPort(port) && port.valueType === connectionValueTypeFilter
        );
        if (preferred) {
          chosenPort = preferred;
        }
      }

      if (connection.handleType === 'source') {
        store.upsertEdge({
          source: { nodeId: connection.nodeId, portId: connection.port.id },
          target: { nodeId: newNodeId, portId: chosenPort.id },
        });
      } else {
        store.upsertEdge({
          source: { nodeId: newNodeId, portId: chosenPort.id },
          target: { nodeId: connection.nodeId, portId: connection.port.id },
        });
      }

      setSelectedNode(newNodeId);
      setFloatingPanel(null);
    },
    [connectionValueTypeFilter, environment, setFloatingPanel, setSelectedNode]
  );

  const canvasAnchor =
    floatingPanel &&
    (floatingPanel.type === 'canvas' || floatingPanel.type === 'connection')
      ? floatingPanel.screen
      : null;

  const nodeEdgeAnchor =
    floatingPanel &&
    (floatingPanel.type === 'node' || floatingPanel.type === 'edge')
      ? floatingPanel.screen
      : null;

  const selectionAnchor =
    floatingPanel && floatingPanel.type === 'selection'
      ? floatingPanel.screen
      : null;

  const connectionFilter = useMemo(() => {
    if (floatingPanel?.type !== 'connection') return undefined;
    const connection = floatingPanel.connection;

    return (definition: (typeof nodeDefinitions)[number]) => {
      const matches = definition.ports.some((port) => {
        const compatible =
          connection.handleType === 'source'
            ? canConnectPorts(connection.port, port)
            : canConnectPorts(port, connection.port);
        if (!compatible) return false;
        if (connectionValueTypeFilter === 'all') return true;

        if (isDataPort(connection.port)) {
          if (connection.handleType === 'source') {
            if (!isDataPort(port) || port.kind !== 'data-in') return false;
            return port.valueType === connectionValueTypeFilter || port.valueType === 'any';
          }
          if (!isDataPort(port) || port.kind !== 'data-out') return false;
          return port.valueType === connectionValueTypeFilter || port.valueType === 'any';
        }

        if (isDataPort(port)) {
          return (
            port.valueType === connectionValueTypeFilter ||
            port.valueType === 'any'
          );
        }
        return true;
      });
      return matches;
    };
  }, [floatingPanel, connectionValueTypeFilter]);

  const connectionSubtitle = useMemo(() => {
    if (floatingPanel?.type !== 'connection') return undefined;
    const { connection } = floatingPanel;
    const targetLabel = connection.port.label ?? connection.port.id;
    return connection.handleType === 'source'
      ? `筛选 · 可连接从「${targetLabel}」输出的节点`
      : `筛选 · 可输入到「${targetLabel}」的节点`;
  }, [floatingPanel]);

  const handleWrapperMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isMobileMode && event.button === panMouseButton) {
      panButtonStateRef.current = {
        active: true,
        moved: false,
        origin: { x: event.clientX, y: event.clientY },
      };
      setIsMousePanning(true);
    }
  }, [isMobileMode, panMouseButton]);

  const handleWrapperMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const state = panButtonStateRef.current;
      if (state.active && !state.moved) {
        const dx = event.clientX - state.origin.x;
        const dy = event.clientY - state.origin.y;
        if (Math.hypot(dx, dy) > 4) {
          state.moved = true;
        }
      }

      if (activeConnection) {
        const handleElement = (event.target as HTMLElement | null)?.closest('.react-flow__handle');
        if (!handleElement) {
          if (connectionCursor !== 'invalid') {
            setConnectionCursor('invalid');
          }
        } else {
          const dataset = (handleElement as HTMLElement).dataset;
          const nodeId = dataset.nodeid ?? handleElement.getAttribute('data-nodeid');
          const handleId =
            dataset.handleid ?? handleElement.getAttribute('data-handleid');
          if (!nodeId || !handleId) {
            if (connectionCursor !== 'invalid') {
              setConnectionCursor('invalid');
            }
          } else {
            const connection: Connection =
              activeConnection.handleType === 'source'
                ? {
                    source: activeConnection.nodeId,
                    sourceHandle: activeConnection.port.id,
                    target: nodeId,
                    targetHandle: handleId,
                  }
                : {
                    source: nodeId,
                    sourceHandle: handleId,
                    target: activeConnection.nodeId,
                    targetHandle: activeConnection.port.id,
                  };
            const isValid = validateConnection(connection);
            const next = isValid ? 'valid' : 'invalid';
            if (connectionCursor !== next) {
              setConnectionCursor(next);
            }
          }
        }
      }
    },
    [activeConnection, connectionCursor, validateConnection]
  );

  const handleWrapperMouseUp = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isMobileMode && event.button === panMouseButton) {
      const state = panButtonStateRef.current;
      if (!state.moved) {
        const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
        const selectedEdges = reactFlow.getEdges().filter((edge) => edge.selected);
        const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
        const screen = { x: event.clientX, y: event.clientY };
        const insideSelection = hasSelection && isPointInsideSelection(screen);
        if (insideSelection) {
          if (selectedNodes.length > 1) {
            setFloatingPanel({
              type: 'selection',
              nodeIds: selectedNodes.map((node) => node.id),
              screen,
            });
          } else if (selectedNodes.length === 1) {
            const nodeId = selectedNodes[0].id;
            setSelectedNode(nodeId);
            setFloatingPanel({
              type: 'node',
              nodeId,
              screen,
            });
          }
        } else if (hasSelection) {
          clearSelectionState();
        }
      }
      panButtonStateRef.current.active = false;
      panButtonStateRef.current.moved = false;
      setIsMousePanning(false);
    }
  }, [clearSelectionState, isMobileMode, isPointInsideSelection, panMouseButton, reactFlow, setSelectedNode]);

  const handleWrapperMouseLeave = useCallback(() => {
    panButtonStateRef.current.active = false;
    panButtonStateRef.current.moved = false;
    setIsMousePanning(false);
    if (connectionCursor !== null) {
      setConnectionCursor(null);
    }
  }, [connectionCursor]);

  const handleWrapperTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
      if (!isMobileMode) return;
      if (event.touches.length !== 1) {
        clearNodeLongPress();
      }
      if (event.touches.length === 2) {
        const touches = Array.from(event.touches).map((touch) => ({
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
        }));
        mobileContextTapRef.current = {
          active: true,
          startTouches: touches,
          lastTouches: touches,
          startTime: performance.now(),
        };
      } else {
        mobileContextTapRef.current = null;
      }
    },
    [clearNodeLongPress, isMobileMode]
  );

  const handleWrapperTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
      const context = mobileContextTapRef.current;
      if (!context || !context.active) return;
      if (event.touches.length !== 2) {
        context.active = false;
        return;
      }
      const touches = Array.from(event.touches).map((touch) => ({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
      }));
      context.lastTouches = touches;
      const movedTooFar = touches.some((touch) => {
        const start = context.startTouches.find((item) => item.id === touch.id);
        return (
          !!start &&
          Math.hypot(touch.x - start.x, touch.y - start.y) > TWO_FINGER_TAP_DISTANCE
        );
      });
      if (movedTooFar) {
        context.active = false;
      }
    },
    []
  );

  const handleWrapperTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const context = mobileContextTapRef.current;
      if (!context) return;
      if (!context.active) {
        mobileContextTapRef.current = null;
        return;
      }
      if (event.touches.length > 0) {
        return;
      }
      const duration = performance.now() - context.startTime;
      if (duration > TWO_FINGER_TAP_DURATION || context.lastTouches.length === 0) {
        mobileContextTapRef.current = null;
        return;
      }
      event.preventDefault();
      const avgX =
        context.lastTouches.reduce((sum, touch) => sum + touch.x, 0) /
        context.lastTouches.length;
      const avgY =
        context.lastTouches.reduce((sum, touch) => sum + touch.y, 0) /
        context.lastTouches.length;
      openCanvasMenuAtScreen({ x: avgX, y: avgY });
      mobileContextTapRef.current = null;
    },
    [openCanvasMenuAtScreen]
  );

  const handleWrapperTouchCancel = useCallback(() => {
    mobileContextTapRef.current = null;
    clearNodeLongPress();
  }, [clearNodeLongPress]);

  const duplicateSelection = useCallback(
    (explicitIds?: string[]) => {
      const ids = explicitIds && explicitIds.length
        ? explicitIds
        : reactFlow
            .getNodes()
            .filter((node) => node.selected)
            .map((node) => node.id);
      if (!ids.length) return;
      const allowedIds = ids.filter((id) => !protectedNodeIds.has(id));
      if (!allowedIds.length) return;
      const createdIds = duplicateNodesBatch(allowedIds);
      if (!createdIds.length) return;
      requestAnimationFrame(() => {
        const createdSet = new Set(createdIds);
        reactFlow.setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: createdSet.has(node.id),
          }))
        );
      });
    },
    [duplicateNodesBatch, protectedNodeIds, reactFlow]
  );

  const handleDuplicateSelection = useCallback(
    (nodeIds: string[]) => {
      duplicateSelection(nodeIds);
      setFloatingPanel(null);
    },
    [duplicateSelection]
  );

  const handleDeleteSelection = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      const allowedIds = nodeIds.filter((id) => !protectedNodeIds.has(id));
      if (!allowedIds.length) {
        setFloatingPanel(null);
        setHasPartialSelection(false);
        return;
      }
      skipEdgeHistoryRef.current = true;
      removeNodesBatch(allowedIds);
      skipEdgeHistoryRef.current = false;
      setFloatingPanel(null);
      setHasPartialSelection(false);
      requestAnimationFrame(() => {
        const removedSet = new Set(allowedIds);
        reactFlow.setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: removedSet.has(node.id) ? false : node.selected,
          }))
        );
      });
    },
    [protectedNodeIds, reactFlow, removeNodesBatch, setFloatingPanel, setHasPartialSelection]
  );

  const handleDisconnectNodes = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return;
      const nodeSet = new Set(nodeIds);
      const edgeIds = edges
        .filter((edge) => nodeSet.has(edge.source.nodeId) || nodeSet.has(edge.target.nodeId))
        .map((edge) => edge.id);
      if (!edgeIds.length) {
        setFloatingPanel(null);
        return;
      }
      removeEdgesBatch(edgeIds);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [edges, removeEdgesBatch, setFloatingPanel, setHasPartialSelection]
  );

  const handleAddCommentForNodes = useCallback(
    (nodeIds: string[], screen: ScreenPoint) => {
      if (!nodeIds.length) return;
      const eligibleNodeIds = nodeIds.filter((nodeId) => !commentByNodeId.has(nodeId));
      if (!eligibleNodeIds.length) {
        setFloatingPanel(null);
        return;
      }
      let targetId = eligibleNodeIds[0];
      if (eligibleNodeIds.length > 1) {
        const flowPoint = reactFlow.screenToFlowPosition(screen);
        const liveNodes = reactFlow.getNodes();
        let bestDistance = Number.POSITIVE_INFINITY;
        eligibleNodeIds.forEach((nodeId) => {
          const rfNode = liveNodes.find((node) => node.id === nodeId);
          if (!rfNode) return;
          const base = rfNode.positionAbsolute ?? rfNode.position;
          const centerX = base.x + (rfNode.width ?? 0) / 2;
          const centerY = base.y + (rfNode.height ?? 0) / 2;
          const distance = Math.hypot(centerX - flowPoint.x, centerY - flowPoint.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            targetId = nodeId;
          }
        });
      }
      const commentId = addComment(targetId);
      setSelectedComment(commentId);
      collapseUnpinnedComments(targetId);
      setFloatingPanel(null);
    },
    [addComment, collapseUnpinnedComments, commentByNodeId, reactFlow, setFloatingPanel, setSelectedComment]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'c') {
        const selected = reactFlow.getNodes().filter((node) => node.selected);
        if (selected.length) {
          event.preventDefault();
          duplicateSelection(selected.map((node) => node.id));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duplicateSelection, reactFlow]);

  return (
    <div
      ref={wrapperRef}
      className={classNames('graph-canvas-wrapper', {
        'graph-canvas-wrapper--cross-select': isCrossSelection,
        'graph-canvas-wrapper--partial-active': hasPartialSelection,
        'graph-canvas-wrapper--comment-mode': commentMode === 'selecting',
        'graph-canvas-wrapper--panning': isMousePanning,
        'graph-canvas-wrapper--connecting': connectionCursor !== null,
        'graph-canvas-wrapper--connection-valid': connectionCursor === 'valid',
        'graph-canvas-wrapper--connection-invalid': connectionCursor === 'invalid',
      })}
      onMouseDown={handleWrapperMouseDown}
      onMouseMove={handleWrapperMouseMove}
      onMouseUp={handleWrapperMouseUp}
      onMouseLeave={handleWrapperMouseLeave}
      onClickCapture={handlePaneClickCapture}
      onContextMenu={(event) => event.preventDefault()}
      onTouchStart={isMobileMode ? handleWrapperTouchStart : undefined}
      onTouchMove={isMobileMode ? handleWrapperTouchMove : undefined}
      onTouchEnd={isMobileMode ? handleWrapperTouchEnd : undefined}
      onTouchCancel={isMobileMode ? handleWrapperTouchCancel : undefined}
    >
      <div className="graph-canvas-grid" aria-hidden="true" />
      <div className="graph-canvas-watermark" aria-hidden="true">
        {watermarkText}
      </div>
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={rfNodes}
        edges={rfEdges}
        minZoom={0.25}
        maxZoom={1.5}
        selectionOnDrag={dragSelectionEnabled}
        selectionMode={currentSelectionMode}
        panOnDrag={isMobileMode ? [1, 2] : [panMouseButton]}
        zoomOnScroll={zoomWithWheel}
        zoomOnPinch={zoomWithWheel}
        zoomOnDoubleClick={!isMobileMode}
        deleteKeyCode={['Delete']}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeDragStart={handleNodeDragStart}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={(event, node) => openNodeMenu(event, node.id)}
        onNodeDrag={handleNodeDragMove}
        onNodeDragStop={handleNodeDragStop}
        onEdgeContextMenu={(event, edge) => openEdgeMenu(event, edge.id)}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={openCanvasMenu}
        nodeTypes={memoizedNodeTypes}
        proOptions={{ hideAttribution: true }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMoveEnd={(_, viewport) => setZoomLevel(viewport.zoom)}
        fitView
      />
      {clickSelectionPreview && (
        <div
          className={classNames('graph-click-selection', {
            'graph-click-selection--partial':
              clickSelectionPreview.mode === SelectionMode.Partial,
          })}
          style={{
            left: clickSelectionPreview.left,
            top: clickSelectionPreview.top,
            width: clickSelectionPreview.width,
            height: clickSelectionPreview.height,
          }}
        />
      )}
      <GraphCommentsOverlay selectionLocked={isSelectionActive} />

      {(floatingPanel?.type === 'canvas' || floatingPanel?.type === 'connection') && (
        <FloatingPanel
          anchor={canvasAnchor}
          className="graph-node-browser"
          deps={[floatingPanel, connectionValueTypeFilter]}
        >
          <NodeLibrary
            title="节点库"
            subtitle={connectionSubtitle}
            definitions={availableDefinitions}
            filter={connectionFilter}
            variant="floating"
            isTouchEnvironment={isMobileMode}
            autoFocusSearch={settings.enterInputOnNodeInsert}
            onSelect={(definition) => {
              if (floatingPanel.type === 'canvas') {
                handleCreateNode(definition.id, floatingPanel.flowPosition);
              } else {
                handleInsertNodeForConnection(definition.id, floatingPanel);
              }
            }}
            valueTypeFilter={
              floatingPanel.type === 'connection' &&
              isDataPort(floatingPanel.connection.port)
                ? {
                    value: connectionValueTypeFilter,
                    onChange: setConnectionValueTypeFilter,
                    requiredType: floatingPanel.connection.port.valueType,
                  }
                : undefined
            }
          />
        </FloatingPanel>
      )}

      {floatingPanel?.type === 'selection' && (
        <FloatingPanel anchor={selectionAnchor} className="graph-context-menu" deps={[floatingPanel]}>
          <div className="graph-context-menu__section">
            <button
              type="button"
              className={classNames('graph-context-menu__item', 'is-danger')}
              disabled={selectionHasProtectedNode}
              onClick={() => handleDeleteSelection(floatingPanel.nodeIds)}
            >
              <span className="graph-context-menu__label">删除</span>
              <span className="graph-context-menu__shortcut">Delete</span>
            </button>
            <button
              type="button"
              className="graph-context-menu__item"
              disabled={selectionHasProtectedNode}
              onClick={() => handleDuplicateSelection(floatingPanel.nodeIds)}
            >
              <span className="graph-context-menu__label">复制</span>
              <span className="graph-context-menu__shortcut">Ctrl+C</span>
            </button>
            <button
              type="button"
              className="graph-context-menu__item"
              onClick={() => handleDisconnectNodes(floatingPanel.nodeIds)}
            >
              <span className="graph-context-menu__label">断开节点连线</span>
            </button>
            <div className="graph-context-menu__divider" />
            <button
              type="button"
              className="graph-context-menu__item"
              disabled={!floatingPanel.nodeIds.some((nodeId) => !commentByNodeId.has(nodeId))}
              onClick={() => handleAddCommentForNodes(floatingPanel.nodeIds, floatingPanel.screen)}
            >
              <span className="graph-context-menu__label">注释</span>
            </button>
          </div>
        </FloatingPanel>
      )}

      {(floatingPanel?.type === 'node' || floatingPanel?.type === 'edge') && (
        <FloatingPanel anchor={nodeEdgeAnchor} className="graph-context-menu" deps={[floatingPanel]}>
          {floatingPanel.type === 'node' && (
            <div className="graph-context-menu__section">
              <button
                type="button"
                className={classNames('graph-context-menu__item', 'is-danger')}
                disabled={singleNodeIsProtected}
              onClick={() => handleDeleteNode(floatingPanel.nodeId)}
              >
                <span className="graph-context-menu__label">删除</span>
                <span className="graph-context-menu__shortcut">Delete</span>
              </button>
              <button
                type="button"
                className="graph-context-menu__item"
                disabled={singleNodeIsProtected}
              onClick={() => handleDuplicateNode(floatingPanel.nodeId)}
              >
                <span className="graph-context-menu__label">复制</span>
                <span className="graph-context-menu__shortcut">Ctrl+C</span>
              </button>
              <button
                type="button"
                className="graph-context-menu__item"
                onClick={() => handleDisconnectNodes([floatingPanel.nodeId])}
              >
                <span className="graph-context-menu__label">断开节点连线</span>
              </button>
              <div className="graph-context-menu__divider" />
              <button
                type="button"
                className="graph-context-menu__item"
                disabled={commentByNodeId.has(floatingPanel.nodeId)}
                onClick={() => handleAddCommentForNodes([floatingPanel.nodeId], floatingPanel.screen)}
              >
                <span className="graph-context-menu__label">注释</span>
              </button>
            </div>
          )}
          {floatingPanel.type === 'edge' && (
            <div className="graph-context-menu__section">
              <button
                type="button"
                className="is-danger"
                onClick={() => handleDeleteEdge(floatingPanel.edgeId)}
              >
                删除连线
              </button>
            </div>
          )}
        </FloatingPanel>
      )}
    </div>
  );
};

const GraphCanvas = ({ isMobileMode = false, settings }: GraphCanvasProps) => (
  <ReactFlowProvider>
    <GraphCanvasInner isMobileMode={isMobileMode} settings={settings} />
  </ReactFlowProvider>
);

export default GraphCanvas;













