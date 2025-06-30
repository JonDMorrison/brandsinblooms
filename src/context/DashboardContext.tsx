
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
  // Dashboard-social specific properties
  currentCampaign: any;
  drafts: any[];
  activeDraft: any;
  setActiveDraft: (draft: any) => void;
  updateDraftContent: (id: string, content: string) => Promise<void>;
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
  const [activeDraft, setActiveDraft] = useState<any>(null);
  const [composerMode, setComposerMode] = useState<'draft' | 'scheduled'>('draft');

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

  // Mock implementations for dashboard-social specific functions
  const updateDraftContent = useCallback(async (id: string, content: string) => {
    console.log('Updating draft content:', { id, content });
    // TODO: Implement actual update logic
  }, []);

  const scheduleDraft = useCallback(async (draftId: string, dateStr: string) => {
    console.log('Scheduling draft:', { draftId, dateStr });
    // TODO: Implement actual scheduling logic
  }, []);

  const contextValue = {
    data: filteredData,
    loading,
    error,
    refetch,
    // Dashboard-social specific values
    currentCampaign: filteredData.currentCampaign || null,
    drafts: filteredData.drafts || [],
    activeDraft,
    setActiveDraft,
    updateDraftContent,
    composerMode,
    setComposerMode,
    scheduleDraft
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
      </DragDropContext>
    </DashboardContext.Provider>
  );
};
