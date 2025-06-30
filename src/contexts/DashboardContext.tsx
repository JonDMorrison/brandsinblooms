
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
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
  isDockOpen: boolean;
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
  draftOrder: string[];
  setDraftOrder: (order: string[]) => void;
  getOrderedDrafts: () => any[];
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
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
  const [draftOrder, setDraftOrder] = useState<string[]>([]);

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

  // Initialize draft order when data loads
  useEffect(() => {
    if (data?.tasks) {
      const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED];
      const availableDrafts = data.tasks
        .filter((task: any) => 
          visibleStatuses.includes(task.status as TaskStatus) &&
          task.status !== TASK_STATUS.SCHEDULED
        )
        .sort((a: any, b: any) => {
          if (a.status === TASK_STATUS.APPROVED && b.status !== TASK_STATUS.APPROVED) return -1;
          if (b.status === TASK_STATUS.APPROVED && a.status !== TASK_STATUS.APPROVED) return 1;
          return 0;
        });
      
      const currentIds = availableDrafts.map((task: any) => task.id);
      
      // Only update order if it's different from current
      if (JSON.stringify(currentIds) !== JSON.stringify(draftOrder)) {
        setDraftOrder(currentIds);
      }
    }
  }, [data?.tasks, draftOrder]);

  // Get ordered drafts based on current order
  const getOrderedDrafts = useCallback(() => {
    if (!data?.tasks || draftOrder.length === 0) {
      return [];
    }
    
    const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED];
    const taskMap = new Map();
    
    // Create a map of all available tasks
    data.tasks
      .filter((task: any) => 
        visibleStatuses.includes(task.status as TaskStatus) &&
        task.status !== TASK_STATUS.SCHEDULED
      )
      .forEach((task: any) => {
        taskMap.set(task.id, task);
      });
    
    // Return tasks in the specified order
    return draftOrder
      .map(id => taskMap.get(id))
      .filter(Boolean); // Remove any undefined entries
  }, [data?.tasks, draftOrder]);

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
    stopDragging,
    isDockOpen,
    openDock,
    closeDock,
    toggleDock,
    draftOrder,
    setDraftOrder,
    getOrderedDrafts
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};
