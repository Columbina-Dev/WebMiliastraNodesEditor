import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import classNames from 'classnames';
import { useOnViewportChange, useReactFlow, type Node } from 'reactflow';
import { useGraphStore } from '../state/graphStore';
import './GraphCommentsOverlay.css';

const MIN_TEXT_HEIGHT = 32;
const MAX_TEXT_HEIGHT = 180;
const NODE_ICON_OFFSET_X = 12;
const NODE_ICON_OFFSET_Y = 14;

const GraphCommentsOverlay = () => {
  const reactFlow = useReactFlow();
  const comments = useGraphStore((state) => state.comments);
  const selectedCommentId = useGraphStore((state) => state.selectedCommentId);
  const setSelectedComment = useGraphStore((state) => state.setSelectedComment);
  const updateCommentText = useGraphStore((state) => state.updateCommentText);
  const setCommentPinned = useGraphStore((state) => state.setCommentPinned);
  const setCommentCollapsed = useGraphStore((state) => state.setCommentCollapsed);
  const removeComment = useGraphStore((state) => state.removeComment);
  const setCommentPosition = useGraphStore((state) => state.setCommentPosition);
  const nodes = useGraphStore((state) => state.nodes);

  const [viewport, setViewport] = useState(() => reactFlow.getViewport());
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const textareaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const collapseTimers = useRef(new Map<string, number>());

  useOnViewportChange({
    onChange: setViewport,
  });

  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    const liveNodes = reactFlow.getNodes();

    liveNodes.forEach((node) => map.set(node.id, node));

    // Provide a fallback entry for nodes that may exist in state
    // but aren't yet mounted inside React Flow.
    nodes.forEach((graphNode) => {
      if (!map.has(graphNode.id)) {
        map.set(
          graphNode.id,
          {
            id: graphNode.id,
            type: graphNode.type as Node['type'],
            data: graphNode.data as Node['data'],
            position: graphNode.position,
            positionAbsolute: graphNode.position,
            dragging: false,
            selected: false,
          } as Node
        );
      }
    });

    return map;
  }, [reactFlow, nodes]);

  useEffect(() => {
    if (selectedCommentId) {
      const comment = comments.find((item) => item.id === selectedCommentId);
      if (!comment) {
        setSelectedComment(undefined);
      }
    }
  }, [comments, selectedCommentId, setSelectedComment]);

  useEffect(() => {
    comments.forEach((comment) => {
      if (comment.pinned && comment.collapsed) {
        setCommentCollapsed(comment.id, false);
      }
    });
  }, [comments, setCommentCollapsed]);

  useEffect(() => {
    if (!selectedCommentId || editingCommentId) return;
    const selected = comments.find((comment) => comment.id === selectedCommentId);
    if (selected && !selected.text.trim()) {
      setEditingCommentId(selected.id);
      setCommentCollapsed(selected.id, false);
    }
  }, [comments, editingCommentId, selectedCommentId, setCommentCollapsed]);

  useEffect(() => {
    if (editingCommentId && !comments.some((comment) => comment.id === editingCommentId)) {
      setEditingCommentId(null);
    }
  }, [comments, editingCommentId]);

  useEffect(
    () => () => {
      collapseTimers.current.forEach((timer) => window.clearTimeout(timer));
      collapseTimers.current.clear();
    },
    []
  );

  const clearCollapseTimer = useCallback((commentId: string) => {
    const handle = collapseTimers.current.get(commentId);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      collapseTimers.current.delete(commentId);
    }
  }, []);

  const scheduleCollapse = useCallback(
    (commentId: string) => {
      clearCollapseTimer(commentId);
      const handle = window.setTimeout(() => {
        collapseTimers.current.delete(commentId);
        setCommentCollapsed(commentId, true);
      }, 120);
      collapseTimers.current.set(commentId, handle);
    },
    [clearCollapseTimer, setCommentCollapsed]
  );

  useEffect(() => {
    const activeIds = new Set(comments.map((item) => item.id));
    collapseTimers.current.forEach((handle, key) => {
      if (!activeIds.has(key)) {
        window.clearTimeout(handle);
        collapseTimers.current.delete(key);
      }
    });
  }, [comments]);

  const resizeTextarea = useCallback((commentId: string) => {
    const textarea = textareaRefs.current.get(commentId);
    if (!textarea) return;
    textarea.style.height = 'auto';
    const next = Math.max(MIN_TEXT_HEIGHT, Math.min(MAX_TEXT_HEIGHT, textarea.scrollHeight));
    textarea.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    if (!editingCommentId) return;
    const textarea = textareaRefs.current.get(editingCommentId);
    if (!textarea) return;
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
      resizeTextarea(editingCommentId);
    });
  }, [editingCommentId, resizeTextarea]);

  const zoom = viewport.zoom || 1;

  const buildTransform = useCallback(
    (x: number, y: number) =>
      `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${zoom}) translate3d(${x}px, ${y}px, 0)`,
    [viewport.x, viewport.y, zoom]
  );

  if (!comments.length) {
    return null;
  }

  const beginDrag = (commentId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const handleMove = (moveEvent: MouseEvent) => {
      const flow = reactFlow.screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      setCommentPosition(commentId, flow);
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="graph-comments-overlay">
      {comments.map((comment) => {
        let anchor: { x: number; y: number } | null = null;
        const nodeId = comment.nodeId?.trim();
        if (comment.position) {
          anchor = comment.position;
        } else if (nodeId) {
          const node = nodeMap.get(nodeId);
          if (!node) return null;
          const base = node.positionAbsolute ?? node.position;
          anchor = {
            x: base.x + NODE_ICON_OFFSET_X,
            y: base.y + NODE_ICON_OFFSET_Y,
          };
        } else {
          return null;
        }

        const containerTransform = buildTransform(anchor.x, anchor.y);
        const containerStyle = {
          transform: containerTransform,
          transformOrigin: '0 0',
          willChange: 'transform',
        } as React.CSSProperties;

        const isHovered = hoveredCommentId === comment.id;
        const isSelected = selectedCommentId === comment.id;
        const isEditing = editingCommentId === comment.id;
        const isFloating = !nodeId;
        const showBubble =
          isFloating ||
          comment.pinned ||
          !comment.collapsed ||
          isHovered ||
          isSelected ||
          isEditing;
        const shouldAutoCollapse = !comment.pinned && !isFloating;

        const handleEnter = () => {
          clearCollapseTimer(comment.id);
          setHoveredCommentId(comment.id);
          if (comment.collapsed) {
            setCommentCollapsed(comment.id, false);
          }
        };

        const handleLeave = () => {
          setHoveredCommentId((current) => (current === comment.id ? null : current));
          if (shouldAutoCollapse && !isEditing && !isSelected) {
            scheduleCollapse(comment.id);
          }
        };

        const finishEditing = () => {
          clearCollapseTimer(comment.id);
          setEditingCommentId((current) => (current === comment.id ? null : current));
          if (shouldAutoCollapse && !isHovered && !isSelected) {
            scheduleCollapse(comment.id);
          }
        };

        const handleTextChange = (value: string) => {
          clearCollapseTimer(comment.id);
          updateCommentText(comment.id, value);
          resizeTextarea(comment.id);
        };

        return (
          <div
            key={comment.id}
            className={classNames('graph-comment-container', {
              'is-visible': showBubble,
              'is-pinned': comment.pinned,
              'is-selected': isSelected,
              'is-floating': isFloating,
              'has-icon': Boolean(nodeId),
            })}
            style={containerStyle}
          >
            <div
              className="graph-comment-cluster"
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              {nodeId && (
                <button
                  type="button"
                  className="graph-comment-icon"
                  onMouseEnter={handleEnter}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearCollapseTimer(comment.id);
                    setSelectedComment(comment.id);
                    setHoveredCommentId(comment.id);
                    if (!comment.pinned && comment.collapsed) {
                      setCommentCollapsed(comment.id, false);
                    }
                  }}
                  title="查看注释"
                >
                  <span className="graph-comment-icon__dots">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              )}

              <div
                className={classNames('graph-comment-bubble', {
                  'is-editing': isEditing,
                })}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setSelectedComment(comment.id);
                  if (isFloating && !isEditing) {
                    beginDrag(comment.id, event);
                  }
                }}
                onMouseEnter={handleEnter}
                onClick={(event) => event.stopPropagation()}
              >
                {isEditing ? (
                  <textarea
                    ref={(element) => {
                      if (element) {
                        textareaRefs.current.set(comment.id, element);
                      } else {
                        textareaRefs.current.delete(comment.id);
                      }
                    }}
                    className="graph-comment-bubble__textarea"
                    value={comment.text}
                    placeholder="输入注释..."
                    onChange={(event) => handleTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        finishEditing();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        finishEditing();
                      }
                    }}
                    onBlur={finishEditing}
                  />
                ) : (
                  <div
                    className={classNames('graph-comment-bubble__text', {
                      'is-empty': !comment.text.trim(),
                    })}
                  >
                    {comment.text.trim() || '暂无内容'}
                  </div>
                )}

                <div className="graph-comment-bubble__actions">
                  <button
                    type="button"
                    className={classNames('graph-comment-bubble__action', {
                      'is-active': isEditing,
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isEditing) {
                        finishEditing();
                      } else {
                        clearCollapseTimer(comment.id);
                        setEditingCommentId(comment.id);
                        setSelectedComment(comment.id);
                        setCommentCollapsed(comment.id, false);
                      }
                    }}
                    title={isEditing ? '完成编辑' : '编辑注释'}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3 11.5V13h1.5L11 6.5 9.5 5 3 11.5zM12.9 4.6a.8.8 0 000-1.1l-1.4-1.4a.8.8 0 00-1.1 0l-.9.9L12 5.5l.9-.9z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  {!isFloating && (
                    <button
                      type="button"
                      className={classNames('graph-comment-bubble__action', {
                        'is-active': comment.pinned,
                      })}
                      onClick={(event) => {
                        event.stopPropagation();
                        const nextPinned = !comment.pinned;
                        setCommentPinned(comment.id, nextPinned);
                        if (nextPinned) {
                          clearCollapseTimer(comment.id);
                          setCommentCollapsed(comment.id, false);
                          setSelectedComment(comment.id);
                        } else if (!isHovered && !isEditing) {
                          scheduleCollapse(comment.id);
                        }
                      }}
                      title={comment.pinned ? '取消固定' : '固定注释'}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M6 2.5a1 1 0 011-1h2a1 1 0 011 1V6l1.4 1.4a1 1 0 01-.7 1.7H8.5V14a.5.5 0 01-1 0V9.1H5.3a1 1 0 01-.7-1.7L6 6V2.5z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="graph-comment-bubble__action graph-comment-bubble__action--danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearCollapseTimer(comment.id);
                      setEditingCommentId((current) => (current === comment.id ? null : current));
                      setHoveredCommentId((current) => (current === comment.id ? null : current));
                      removeComment(comment.id);
                    }}
                    title="删除注释"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M6 2l.4-1h3.2l.4 1H13v1H3V2h3zM4 4h8l-.6 9.1a1 1 0 01-1 .9H5.6a1 1 0 01-1-.9L4 4z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GraphCommentsOverlay;
