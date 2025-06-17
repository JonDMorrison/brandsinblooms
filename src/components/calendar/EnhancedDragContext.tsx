
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { format } from 'date-fns';

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

interface DragState {
  isDragging: boolean;
  draggedTasks: Task[];
  dragPreview: string;
  dragStartPosition: { x: number; y: number } | null;
  hoveredDropZone: string | null;
}

interface EnhancedDragContextType {
  dragState: DragState;
  updateDragState: (updates: Partial<DragState>) => void;
  startDrag: (tasks: Task[], position: { x: number; y: number }) => void;
  endDrag: () => void;
  setHoveredDropZone: (zoneId: string | null) => void;
}

const EnhancedDragContext = createContext<EnhancedDragContextType | null>(null);

export const useEnhancedDragContext = () => {
  const context = useContext(EnhancedDragContext);
  if (!context) {
    throw new Error('useEnhancedDragContext must be used within EnhancedDragProvider');
  }
  return context;
};

interface EnhancedDragProviderProps {
  children: ReactNode;
}

export const EnhancedDragProvider = ({ children }: EnhancedDragProviderProps) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedTasks: [],
    dragPreview: '',
    dragStartPosition: null,
    hoveredDropZone: null,
  });

  const updateDragState = (updates: Partial<DragState>) => {
    setDragState(prev => ({ ...prev, ...updates }));
  };

  const startDrag = (tasks: Task[], position: { x: number; y: number }) => {
    const preview = tasks.length === 1 
      ? `${tasks[0].post_type} content`
      : `${tasks.length} content items`;

    setDragState({
      isDragging: true,
      draggedTasks: tasks,
      dragPreview: preview,
      dragStartPosition: position,
      hoveredDropZone: null,
    });

    // Add global drag cursor
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('dragging');
  };

  const endDrag = () => {
    setDragState({
      isDragging: false,
      draggedTasks: [],
      dragPreview: '',
      dragStartPosition: null,
      hoveredDropZone: null,
    });

    // Remove global drag cursor
    document.body.style.cursor = '';
    document.body.classList.remove('dragging');
  };

  const setHoveredDropZone = (zoneId: string | null) => {
    updateDragState({ hoveredDropZone: zoneId });
  };

  return (
    <EnhancedDragContext.Provider value={{
      dragState,
      updateDragState,
      startDrag,
      endDrag,
      setHoveredDropZone,
    }}>
      {children}
    </EnhancedDragContext.Provider>
  );
};
