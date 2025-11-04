export const NODE_LIBRARY_TOUCH_DRAG_EVENT = 'node-library-touch-drag';

export type NodeLibraryTouchDragPhase = 'start' | 'move' | 'end' | 'cancel';

export interface NodeLibraryTouchDragDetail {
  phase: NodeLibraryTouchDragPhase;
  definitionId: string;
  clientX: number;
  clientY: number;
}

