
import React, { createContext, useContext, useCallback, useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useDashboardData } from '@/hooks/useDashboardData';
import { TASK_STATUS, type TaskStatus } from '@/constants/taskStatus';

interface DashboardContextType {
  data: any;
  loading: boolean;
  error: any;
  refetch: () => void;
  isDragging: boolean;
  startDragging: () => void;
  stopDragging: () => void;
}

interface DashboardUIContextType {
  isDockOpen: boolean;
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);
const DashboardUIContext = createContext<DashboardUIContextType | undefined>(undefined);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};

export const useDashboard = () => {
  const context = useContext(DashboardUIContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  const { data, isLoading: loading, error, refetch } = useDashboardData();
  const [isDragging, setIsDragging] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(false);

  const startDragging = useCallback(() => {
    console.log('🎯 Dashboard: Starting drag');
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    console.log('🎯 Dashboard: Stopping drag');
    setIsDragging(false);
  }, []);

  const openDock = useCallback(() => {
    setIsDockOpen(true);
  }, []);

  const closeDock = useCallback(() => {
    setIsDockOpen(false);
  }, []);

  const toggleDock = useCallback(() => {
    setIsDockOpen(prev => !prev);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    console.log('🎯 Dashboard drag ended:', result);
    // The SmartTimeDock component handles the actual scheduling logic
  }, []);

  // Filter tasks to show only approved and generated content in drafts
  const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED];
  const filteredData = data ? {
    ...data,
    drafts: data.tasks?.filter((task: any) => visibleStatuses.includes(task.status as TaskStatus)) || []
  } : {};

  const contextValue = {
    data: filteredData,
    loading,
    error,
    refetch,
    isDragging,
    startDragging,
    stopDragging
  };

  const uiContextValue = {
    isDockOpen,
    openDock,
    closeDock,
    toggleDock
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <DashboardUIContext.Provider value={uiContextValue}>
        <DragDropContext onDragEnd={handleDragEnd}>
          {children}
        </DragDropContext>
      </DashboardUIContext.Provider>
    </DashboardContext.Provider>
  );
};
