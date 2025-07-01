
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
  
  // Dashboard-social specific properties
  currentCampaign: any;
  drafts: any[];
  activeDraft: any;
  setActiveDraft: (draft: any) => void;
  updateDraftContent: (draftId: string, content: string) => Promise<void>;
  composerMode: 'draft' | 'scheduled';
  setComposerMode: (mode: 'draft' | 'scheduled') => void;
  scheduleDraft: (draftId: string, dateStr: string) => Promise<void>;
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
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  
  // Dashboard-social specific state
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [composerMode, setComposerMode] = useState<'draft' | 'scheduled'>('draft');

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

  // Dashboard-social specific methods
  const updateDraftContent = useCallback(async (draftId: string, content: string) => {
    console.log('Updating draft content:', draftId, content);
    // TODO: Implement actual update logic with API call
    // This would typically update the task in the database
  }, []);

  const scheduleDraft = useCallback(async (draftId: string, dateStr: string) => {
    console.log('Scheduling draft:', draftId, 'for date:', dateStr);
    // TODO: Implement actual scheduling logic with API call
    // This would typically move the task to scheduled status
  }, []);

  // Initialize draft order when data loads - but only if order is empty or we have new tasks
  useEffect(() => {
    if (data?.tasks) {
      const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED, TASK_STATUS.SCHEDULED];
      const availableDrafts = data.tasks
        .filter((task: any) => visibleStatuses.includes(task.status as TaskStatus))
        .sort((a: any, b: any) => {
          if (a.status === TASK_STATUS.APPROVED && b.status !== TASK_STATUS.APPROVED) return -1;
          if (b.status === TASK_STATUS.APPROVED && a.status !== TASK_STATUS.APPROVED) return 1;
          return 0;
        });
      
      const currentIds = availableDrafts.map((task: any) => task.id);
      
      // Only initialize order if we have no existing order
      if (draftOrder.length === 0) {
        console.log('🎯 Initializing draft order for first time:', currentIds);
        setDraftOrder(currentIds);
      } else {
        // Check for new tasks that need to be added to existing order
        const newTasks = currentIds.filter(id => !draftOrder.includes(id));
        const removedTasks = draftOrder.filter(id => !currentIds.includes(id));
        
        if (newTasks.length > 0 || removedTasks.length > 0) {
          console.log('🎯 Adding new tasks to existing order:', { newTasks, removedTasks });
          
          // Remove tasks that no longer exist and add new tasks at the end
          const updatedOrder = draftOrder
            .filter(id => currentIds.includes(id)) // Remove deleted tasks
            .concat(newTasks); // Add new tasks at the end
          
          setDraftOrder(updatedOrder);
        }
      }
    }
  }, [data?.tasks]);

  // Get ordered drafts based on current order
  const getOrderedDrafts = useCallback(() => {
    if (!data?.tasks) {
      return [];
    }
    
    const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED, TASK_STATUS.SCHEDULED];
    const availableTasks = data.tasks
      .filter((task: any) => visibleStatuses.includes(task.status as TaskStatus));
    
    // If we don't have a draft order yet (initializing), return tasks in their natural order
    // This prevents the flash while the order is being set up
    if (draftOrder.length === 0) {
      return availableTasks.sort((a: any, b: any) => {
        if (a.status === TASK_STATUS.APPROVED && b.status !== TASK_STATUS.APPROVED) return -1;
        if (b.status === TASK_STATUS.APPROVED && a.status !== TASK_STATUS.APPROVED) return 1;
        return 0;
      });
    }
    
    const taskMap = new Map();
    
    // Create a map of all available tasks
    availableTasks.forEach((task: any) => {
      taskMap.set(task.id, task);
    });
    
    // Return tasks in the specified order
    return draftOrder
      .map(id => taskMap.get(id))
      .filter(Boolean); // Remove any undefined entries
  }, [data?.tasks, draftOrder]);

  // Filter tasks to show approved, generated, and scheduled content
  const visibleStatuses: TaskStatus[] = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED, TASK_STATUS.SCHEDULED];
  
  // Create filtered data with proper structure
  const filteredData = data ? {
    ...data,
    drafts: data.tasks?.filter((task: any) => visibleStatuses.includes(task.status as TaskStatus)) || []
  } : {
    drafts: []
  };

  // Dashboard-social compatibility properties
  const currentCampaign = data?.currentCampaign || null;
  const drafts = filteredData.drafts || [];

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
    getOrderedDrafts,
    
    // Dashboard-social specific values
    currentCampaign,
    drafts,
    activeDraft,
    setActiveDraft,
    updateDraftContent,
    composerMode,
    setComposerMode,
    scheduleDraft
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};
