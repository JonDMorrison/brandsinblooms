
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { CalendarHeader } from './calendar/CalendarHeader';

import { supabase } from '@/integrations/supabase/client';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ContentViewerDialog } from './content/ContentViewerDialog';
import { CampaignDetailsModal } from './calendar/CampaignDetailsModal';
import { useRouteState } from '@/hooks/useRouteState';

export const CalendarView = React.memo(({ campaigns, tasks, onDataUpdate }: {
  campaigns: any[];
  tasks: any[];
  onDataUpdate: () => void;
}) => {
  // Route state management for persistence between page navigations
  const { saveState, getState, updateState } = useRouteState({
    selectedTasks: [],
    viewMode: 'month',
    currentDate: new Date().toISOString()
  });

  // Initialize state from saved route state
  const savedState = getState();
  const [selectedTasks, setSelectedTasks] = useState<string[]>(savedState.selectedTasks || []);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>(savedState.viewMode || 'month');
  const [currentDate, setCurrentDate] = useState<Date>(
    savedState.currentDate ? new Date(savedState.currentDate) : new Date()
  );
  
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Use the drag and drop hook with proper handlers
  const { isDragging, draggedTask, handleDragStart, handleDragEnd, handleDrop } = useDragAndDrop(onDataUpdate);

  // Navigation functions - memoized for performance with state persistence
  const goToPrevious = useCallback(() => {
    const newDate = viewMode === 'month' 
      ? subMonths(currentDate, 1)
      : subWeeks(currentDate, 1);
    
    setCurrentDate(newDate);
    updateState('currentDate', newDate.toISOString());
  }, [viewMode, currentDate, updateState]);

  const goToNext = useCallback(() => {
    const newDate = viewMode === 'month' 
      ? addMonths(currentDate, 1)
      : addWeeks(currentDate, 1);
    
    setCurrentDate(newDate);
    updateState('currentDate', newDate.toISOString());
  }, [viewMode, currentDate, updateState]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    updateState('currentDate', today.toISOString());
  }, [updateState]);

  // Save view mode changes to route state
  const handleViewModeChange = useCallback((newViewMode: 'month' | 'week') => {
    setViewMode(newViewMode);
    updateState('viewMode', newViewMode);
  }, [updateState]);

  // Task selection and bulk operations with state persistence
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const newSelection = prev.includes(taskId) 
        ? prev.filter((id) => id !== taskId) 
        : [...prev, taskId];
      
      updateState('selectedTasks', newSelection);
      return newSelection;
    });
  }, [updateState]);

  const handleBulkComplete = async () => {
    if (selectedTasks.length === 0) {
      return;
    }

    setBulkCompleteLoading(true);
    try {
      await Promise.all(selectedTasks.map(async (taskId) => {
        const { error } = await supabase
          .from('content_tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
        
        if (error) throw error;
      }));

      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
    } finally {
      setBulkCompleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      await Promise.all(selectedTasks.map(async (taskId) => {
        const { error } = await supabase
          .from('content_tasks')
          .delete()
          .eq('id', taskId);
        
        if (error) throw error;
      }));

      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleTaskClick = (task: any) => {
    setSelectedTaskForModal(task);
    setContentModalOpen(true);
  };

  const handleTaskLongPress = (task: any) => {
    handleDragStart(task);
  };

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaignForModal(campaign);
    setCampaignModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    // Date modal functionality to be implemented
  };

  const isTaskSelected = useCallback((task: any) => {
    return selectedTasks.includes(task.id);
  }, [selectedTasks]);


  return (
    <div className="h-full flex flex-col">
      <CalendarHeader
        viewMode={viewMode}
        currentDate={currentDate}
        selectedTasksCount={selectedTasks.length}
        bulkCompleteLoading={bulkCompleteLoading}
        bulkDeleteLoading={bulkDeleteLoading}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        onViewModeChange={handleViewModeChange}
        onBulkComplete={handleBulkComplete}
        onBulkDelete={handleBulkDelete}
      />
      
      <div className="flex-1 overflow-hidden">
        <CalendarGrid
          campaigns={campaigns}
          tasks={tasks}
          currentDate={currentDate}
          viewMode={viewMode}
          onTaskClick={handleTaskClick}
          onTaskLongPress={handleTaskLongPress}
          onCampaignClick={handleCampaignClick}
          onDateClick={handleDateClick}
          selectedTasks={selectedTasks}
          onDrop={handleDrop}
          isTaskSelected={isTaskSelected}
          isDragging={isDragging}
          draggedTask={draggedTask}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </div>

      {/* Content Modal */}
      {selectedTaskForModal && (
        <ContentViewerDialog
          isOpen={contentModalOpen}
          onClose={() => {
            setContentModalOpen(false);
            setSelectedTaskForModal(null);
          }}
          campaignTitle={selectedTaskForModal.campaigns?.title || 'Content'}
          loading={false}
          tasks={[selectedTaskForModal]}
          onTaskUpdate={onDataUpdate}
        />
      )}

      {/* Campaign Modal */}
      {selectedCampaignForModal && (
        <CampaignDetailsModal
          campaign={selectedCampaignForModal}
          isOpen={campaignModalOpen}
          onClose={() => {
            setCampaignModalOpen(false);
            setSelectedCampaignForModal(null);
          }}
          onUpdate={(updatedCampaign) => {
            setSelectedCampaignForModal(updatedCampaign);
            onDataUpdate();
          }}
        />
      )}
    </div>
  );
});
