
import React, { useState, useMemo, useCallback } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { CalendarHeader } from './calendar/CalendarHeader';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ContentViewerDialog } from './content/ContentViewerDialog';
import { CampaignDetailsModal } from './calendar/CampaignDetailsModal';

export const CalendarView = React.memo(({ campaigns, tasks, onDataUpdate }: {
  campaigns: any[];
  tasks: any[];
  onDataUpdate: () => void;
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Use the drag and drop hook with proper handlers
  const { isDragging, draggedTask, handleDragStart, handleDragEnd, handleDrop } = useDragAndDrop(onDataUpdate);

  // Navigation functions - memoized for performance
  const goToPrevious = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Task selection and bulk operations
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkComplete = async () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected.",
        description: "Please select tasks to complete.",
      })
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

      toast({
        title: "Tasks completed.",
        description: `${selectedTasks.length} tasks have been marked as complete.`,
      })
      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error completing tasks.",
        description: "Failed to complete selected tasks.  Please try again.",
      })
    } finally {
      setBulkCompleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected.",
        description: "Please select tasks to delete.",
      })
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

      toast({
        title: "Tasks deleted.",
        description: `${selectedTasks.length} tasks have been deleted.`,
      })
      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting tasks.",
        description: "Failed to delete selected tasks.  Please try again.",
      })
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
        onViewModeChange={setViewMode}
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
