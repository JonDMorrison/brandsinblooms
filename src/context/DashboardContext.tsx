
import React, { createContext, useContext, useCallback } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SmartTimeRibbon } from '@/components/new-dashboard/SmartTimeRibbon';

interface DashboardContextType {
  data: any;
  loading: boolean;
  error: any;
  refetch: () => void;
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

  const handleDragEnd = useCallback((result: DropResult) => {
    console.log('🎯 Dashboard drag ended:', result);
    // The SmartTimeRibbon component handles the actual scheduling logic
  }, []);

  const contextValue = {
    data: data || {},
    loading,
    error,
    refetch
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
