import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import classNames from 'classnames';
import ReactFlow, {
  Controls,
  Panel,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from 'reactflow';
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
import type { ConnectionPreview } from '../types/node';
import NodeLibrary from './NodeLibrary';
import {
  canConnectPorts,
  isDataPort,
} from '../utils/graph';
import './GraphCanvas.css';

const nodeTypes = { miliastra: MiliastraNode } as const;
const ICON_INFO = new URL('../assets/icons/info.png', import.meta.url).href;

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

type PositionedEdge = Edge & {
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
};

const MIN_SELECTION_DISTANCE = 4;
const INTERSECTION_EPSILON = 1e-4;

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
  deps: unknown[]
) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<ScreenPoint | null>(anchor);

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
  }, [anchor, ...deps]);

  return { ref, position } as const;
};

const FloatingPanel: React.FC<{
  anchor: ScreenPoint | null;
  className?: string;
  deps?: unknown[];
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

const GraphCanvasInner = () => {
  const reactFlow = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
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

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [floatingPanel, setFloatingPanel] = useState<FloatingPanelState>(null);
  const [activeConnection, setActiveConnection] =
    useState<ConnectionPreview | null>(null);
  const [connectionValueTypeFilter, setConnectionValueTypeFilter] =
    useState<string>('all');
  const connectionSuccessRef = useRef(false);
  const [tipsVisible, setTipsVisible] = useState(true);
  const [tipsDismissed, setTipsDismissed] = useState(false);
  const [currentSelectionMode, setCurrentSelectionMode] = useState<SelectionMode>(SelectionMode.Full);
  const [isCrossSelection, setIsCrossSelection] = useState(false);
  const [hasPartialSelection, setHasPartialSelection] = useState(false);
  const selectionStartRef = useRef<ScreenPoint | null>(null);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const selectionActiveRef = useRef(false);
  const selectionModeRef = useRef<SelectionMode>(SelectionMode.Full);
  const crossSelectionRef = useRef(false);
  const skipEdgeHistoryRef = useRef(false);
  const rightButtonStateRef = useRef({
    active: false,
    moved: false,
    origin: { x: 0, y: 0 },
  });

  useEffect(() => {
    const handleGlobalClick = () => setFloatingPanel(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFloatingPanel(null);
        setActiveConnection(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (tipsDismissed) return;
    const timer = window.setTimeout(() => {
      setTipsVisible(false);
      setTipsDismissed(true);
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [tipsDismissed]);

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
    selectionActiveRef.current = false;
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    selectionModeRef.current = SelectionMode.Full;
    setCurrentSelectionMode(SelectionMode.Full);
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
      if ((event.buttons & 1) === 0) return;
      const start = selectionStartRef.current;
      const current = { x: event.clientX, y: event.clientY };
      selectionBoxRef.current = { start, current };
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance < MIN_SELECTION_DISTANCE) return;
      const usePartialMode = dx < 0;
      if (usePartialMode !== crossSelectionRef.current) {
        setIsCrossSelection(usePartialMode);
      }
      const nextMode = usePartialMode ? SelectionMode.Partial : SelectionMode.Full;
      if (nextMode !== selectionModeRef.current) {
        setCurrentSelectionMode(nextMode);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

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

  const defaultEdgeOptions = useMemo(
    () => ({
      style: { strokeWidth: 2.5, stroke: '#8cc2ff' },
    }),
    []
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.source.nodeId,
        sourceHandle: edge.source.portId,
        target: edge.target.nodeId,
        targetHandle: edge.target.portId,
      })),
    [edges]
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
    },
    [clearOverride, upsertEdge, validateConnection]
  );

  const handleConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      connectionSuccessRef.current = false;
      setFloatingPanel(null);
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
        setFloatingPanel({
          type: 'connection',
          screen: targetPosition,
          flowPosition: reactFlow.screenToFlowPosition(targetPosition),
          connection: activeConnection,
        });
      }
      setActiveConnection(null);
      connectionSuccessRef.current = false;
    },
    [activeConnection, reactFlow]
  );

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      setSelectedNode(node.id);
      setHasPartialSelection(false);
    },
    [setSelectedNode, setHasPartialSelection]
  );

  const handlePaneClick = useCallback(
    (event?: ReactMouseEvent<Element>) => {
      if (event) {
        const point = { x: event.clientX, y: event.clientY };
        if (isPointInsideSelection(point)) {
          return;
        }
      }
      clearSelectionState();
    },
    [clearSelectionState, isPointInsideSelection]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/x-node-type');
      if (!type) return;
      const definition = nodeDefinitionsById[type];
      if (!definition) return;
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
    [reactFlow]
  );

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSelectionStart = useCallback((event: ReactMouseEvent<Element>) => {
    const start = { x: event.clientX, y: event.clientY };
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

      selectionActiveRef.current = false;
      selectionStartRef.current = null;
      selectionBoxRef.current = null;
      selectionModeRef.current = SelectionMode.Full;
      setCurrentSelectionMode(SelectionMode.Full);

      const wasCrossSelection = crossSelectionRef.current;
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

        if (wasCrossSelection) {
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
        setHasPartialSelection(wasCrossSelection && anySelected);
      });
    },
    [reactFlow, setHasPartialSelection]
  );

  const openNodeMenu = useCallback(
    (event: ReactMouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
      if (selectedNodes.length > 1 && selectedNodes.some((item) => item.id === nodeId)) {
        setFloatingPanel({
          type: 'selection',
          nodeIds: selectedNodes.map((item) => item.id),
          screen: { x: event.clientX, y: event.clientY },
        });
        return;
      }
      setSelectedNode(nodeId);
      setFloatingPanel({
        type: 'node',
        nodeId,
        screen: { x: event.clientX, y: event.clientY },
      });
    },
    [reactFlow, setSelectedNode]
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

  const openCanvasMenu = useCallback(
    (event: ReactMouseEvent<Element> | MouseEvent) => {
      event.preventDefault();
      if (rightButtonStateRef.current.moved) {
        rightButtonStateRef.current.moved = false;
        rightButtonStateRef.current.active = false;
        return;
      }
      const clientX = 'clientX' in event ? event.clientX : 0;
      const clientY = 'clientY' in event ? event.clientY : 0;
      const screen = { x: clientX, y: clientY };
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

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      removeNode(nodeId);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [removeNode]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      duplicateNode(nodeId);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [duplicateNode]
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
      const id = useGraphStore.getState().addNode({
        type: definition.id,
        position,
        data: {},
      });
      setSelectedNode(id);
      setFloatingPanel(null);
      setHasPartialSelection(false);
    },
    [setSelectedNode]
  );

  const toggleTips = useCallback(() => {
    setTipsVisible((visible) => !visible);
    setTipsDismissed(true);
  }, []);

  const closeTips = useCallback(() => {
    setTipsVisible(false);
    setTipsDismissed(true);
  }, []);

  const handleInsertNodeForConnection = useCallback(
    (definitionId: string, panel: Extract<FloatingPanelState, { type: 'connection' }>) => {
      const definition = nodeDefinitionsById[definitionId];
      if (!definition) return;
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
    [setSelectedNode]
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
      ? `筛选 - 可连接到「${targetLabel}」的节点`
      : `筛选 - 可驱动「${targetLabel}」的节点`;
  }, [floatingPanel]);

  const handleWrapperMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      rightButtonStateRef.current = {
        active: true,
        moved: false,
        origin: { x: event.clientX, y: event.clientY },
      };
    }
  }, []);

  const handleWrapperMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const state = rightButtonStateRef.current;
    if (!state.active || state.moved) return;
    const dx = event.clientX - state.origin.x;
    const dy = event.clientY - state.origin.y;
    if (Math.hypot(dx, dy) > 4) {
      state.moved = true;
    }
  }, []);

  const handleWrapperMouseUp = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      const state = rightButtonStateRef.current;
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
      rightButtonStateRef.current.active = false;
      rightButtonStateRef.current.moved = false;
    }
  }, [clearSelectionState, isPointInsideSelection, reactFlow, setSelectedNode]);

  const handleWrapperMouseLeave = useCallback(() => {
    rightButtonStateRef.current.active = false;
    rightButtonStateRef.current.moved = false;
  }, []);

  const duplicateSelection = useCallback(
    (explicitIds?: string[]) => {
      const ids = explicitIds && explicitIds.length
        ? explicitIds
        : reactFlow
            .getNodes()
            .filter((node) => node.selected)
            .map((node) => node.id);
      if (!ids.length) return;
      const createdIds = duplicateNodesBatch(ids);
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
    [duplicateNodesBatch, reactFlow]
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
      skipEdgeHistoryRef.current = true;
      removeNodesBatch(nodeIds);
      skipEdgeHistoryRef.current = false;
      setFloatingPanel(null);
      setHasPartialSelection(false);
      requestAnimationFrame(() => {
        const removedSet = new Set(nodeIds);
        reactFlow.setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: removedSet.has(node.id) ? false : node.selected,
          }))
        );
      });
    },
    [reactFlow, removeNodesBatch]
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
      })}
      onMouseDown={handleWrapperMouseDown}
      onMouseMove={handleWrapperMouseMove}
      onMouseUp={handleWrapperMouseUp}
      onMouseLeave={handleWrapperMouseLeave}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="graph-canvas-grid" aria-hidden="true" />
      <div className="graph-canvas-watermark" aria-hidden="true">
        服务器节点图编辑
      </div>
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={rfNodes}
        edges={rfEdges}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.25}
        maxZoom={0.75}
        selectionOnDrag
        selectionMode={currentSelectionMode}
        panOnDrag={[2]}
        deleteKeyCode={['Delete']}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onSelectionStart={handleSelectionStart}
        onSelectionEnd={handleSelectionEnd}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={(event, node) => openNodeMenu(event, node.id)}
        onEdgeContextMenu={(event, edge) => openEdgeMenu(event, edge.id)}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={openCanvasMenu}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        fitView
      >
        <Controls position="bottom-right" showInteractive={false} />
        <Panel
          position="top-left"
          className="graph-info-trigger"
          style={{ marginTop: 8, marginLeft: 8 }}
        >
          <button
            type="button"
            className={classNames('graph-info-trigger__button', {
              'is-active': tipsVisible,
            })}
            onClick={toggleTips}
            aria-label="显示/隐藏提示"
          >
            <img src={ICON_INFO} alt="" aria-hidden="true" className="graph-info-trigger__icon" />
          </button>
        </Panel>
        <Panel
          position="top-left"
          className={classNames('graph-panel', {
            'graph-panel--hidden': !tipsVisible,
            'graph-panel--visible': tipsVisible,
          })}
          style={{ marginTop: 8, marginLeft: 52 }}
        >
          <div className="graph-panel__content">
            <button
              type="button"
              className="graph-panel__close"
              onClick={closeTips}
              aria-label="关闭提示"
            >
              Ⓧ
            </button>
            <div className="graph-panel__text">
              右键拖拽以平移视图，鼠标滚轮缩放视图<br />
              左键可多选节点，向左移动为接触选择<br />
              向右移动为框选选择，Del键删除选中节点<br />
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {(floatingPanel?.type === 'canvas' || floatingPanel?.type === 'connection') && (
        <FloatingPanel
          anchor={canvasAnchor}
          className="graph-node-browser"
          deps={[floatingPanel, connectionValueTypeFilter]}
        >
          <NodeLibrary
            title="节点库"
            subtitle={connectionSubtitle}
            definitions={nodeDefinitions}
            filter={connectionFilter}
            variant="floating"
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
            <button type="button" onClick={() => handleDuplicateSelection(floatingPanel.nodeIds)}>
              复制节点
            </button>
            <div className="graph-context-menu__divider" />
            <button
              type="button"
              className="is-danger"
              onClick={() => handleDeleteSelection(floatingPanel.nodeIds)}
            >
              删除节点
            </button>
          </div>
        </FloatingPanel>
      )}

      {(floatingPanel?.type === 'node' || floatingPanel?.type === 'edge') && (
        <FloatingPanel anchor={nodeEdgeAnchor} className="graph-context-menu" deps={[floatingPanel]}>
          {floatingPanel.type === 'node' && (
            <div className="graph-context-menu__section">
              <button type="button" onClick={() => handleDuplicateNode(floatingPanel.nodeId)}>
                复制节点
              </button>
              <div className="graph-context-menu__divider" />
              <button
                type="button"
                className="is-danger"
                onClick={() => handleDeleteNode(floatingPanel.nodeId)}
              >
                删除节点
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

const GraphCanvas = () => (
  <ReactFlowProvider>
    <GraphCanvasInner />
  </ReactFlowProvider>
);

export default GraphCanvas;
