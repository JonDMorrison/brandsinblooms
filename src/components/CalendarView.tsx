import React, { useState, useEffect } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, Calendar, CalendarDays } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ContentViewerDialog } from './content/ContentViewerDialog';
import { CampaignDetailsModal } from './calendar/CampaignDetailsModal';

export const CalendarView = ({ campaigns, tasks, onDataUpdate }: {
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
  const { user } = useAuth();
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Use the drag and drop hook with proper handlers
  const { isDragging, draggedTask, handleDragStart, handleDragEnd, handleDrop } = useDragAndDrop(onDataUpdate);

  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

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
        description: "Failed to complete selected tasks. Please try again.",
      })
      console.error("Error completing tasks:", error);
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
        description: "Failed to delete selected tasks. Please try again.",
      })
      console.error("Error deleting tasks:", error);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleTaskClick = (task: any) => {
    console.log('Task clicked for modal:', task);
    setSelectedTaskForModal(task);
    setContentModalOpen(true);
  };

  const handleTaskLongPress = (task: any) => {
    console.log('Task long pressed for drag:', task);
    handleDragStart(task);
  };

  const handleCampaignClick = (campaign: any) => {
    console.log('Campaign clicked for modal:', campaign);
    setSelectedCampaignForModal(campaign);
    setCampaignModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    // TODO: Implement date modal
    console.log('Date clicked:', date);
  };

  const isTaskSelected = (task: any) => {
    return selectedTasks.includes(task.id);
  };

  const getDisplayTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    } else {
      return format(currentDate, "'Week of' MMM d, yyyy");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Calendar</h2>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-sm font-medium min-w-[180px] text-center">
              {getDisplayTitle()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="h-7 px-2"
            >
              <Calendar className="w-3 h-3 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="h-7 px-2"
            >
              <CalendarDays className="w-3 h-3 mr-1" />
              Week
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {selectedTasks.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkComplete}
                disabled={bulkCompleteLoading}
                className="text-green-600 hover:bg-green-50"
              >
                {bulkCompleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Complete ({selectedTasks.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="text-red-600 hover:bg-red-50"
              >
                {bulkDeleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Delete ({selectedTasks.length})
              </Button>
            </>
          )}
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>
      
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
};
