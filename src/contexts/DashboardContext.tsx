
import React, { createContext, useContext, useCallback, useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SmartTimeRibbon } from '@/components/new-dashboard/SmartTimeRibbon';
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

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
}

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  const { data, isLoading: loading, error, refetch } = useDashboardData();
  const [isDragging, setIsDragging] = useState(false);

  const startDragging = useCallback(() => {
    console.log('🎯 Dashboard: Starting drag');
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    console.log('🎯 Dashboard: Stopping drag');
    setIsDragging(false);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    console.log('🎯 Dashboard drag ended:', result);
    // The SmartTimeRibbon component handles the actual scheduling logic
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

  return (
    <DashboardContext.Provider value={contextValue}>
      <DragDropContext onDragEnd={handleDragEnd}>
        {children}
        <SmartTimeRibbon
          scheduledByDate={data?.scheduledByDate}
          socialConnections={data?.socialConnections}
          onScheduleUpdate={refetch}
          onDragEnd={handleDragEnd}
        />
      </DragDropContext.Provider>
    </DashboardContext.Provider>
  );
};
