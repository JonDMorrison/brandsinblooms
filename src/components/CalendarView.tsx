
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { CalendarHeader } from './calendar/CalendarHeader';
import { NewsletterSchedulingModal } from './calendar/NewsletterSchedulingModal';
import { NewsletterEditDrawer } from './calendar/NewsletterEditDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewsletterCalendar } from '@/hooks/useNewsletterCalendar';
import { supabase } from '@/integrations/supabase/client';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ContentViewerDialog } from './content/ContentViewerDialog';
import { CampaignDetailsModal } from './calendar/CampaignDetailsModal';
import { useRouteState } from '@/hooks/useRouteState';
import { Mail, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const CalendarView = React.memo(({ campaigns, tasks, onDataUpdate }: {
  campaigns: any[];
  tasks: any[];
  onDataUpdate: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Newsletter management
  const {
    newsletters,
    loading: newslettersLoading,
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    duplicateNewsletter,
    getNewslettersForDate
  } = useNewsletterCalendar();

  // Route state management for persistence between page navigations
  const { saveState, getState, updateState } = useRouteState({
    selectedTasks: [],
    viewMode: 'month',
    currentDate: new Date().toISOString(),
    showNewsletters: true,
    newsletterFilters: []
  }, { disableScrollTracking: true });

  // Initialize state from saved route state
  const savedState = getState();
  const [selectedTasks, setSelectedTasks] = useState<string[]>(savedState.selectedTasks || []);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>(savedState.viewMode || 'month');
  const [currentDate, setCurrentDate] = useState<Date>(
    savedState.currentDate ? new Date(savedState.currentDate) : new Date()
  );
  
  // Newsletter-specific state
  const [showNewsletters, setShowNewsletters] = useState<boolean>(savedState.showNewsletters ?? true);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  
  // Newsletter modals
  const [newsletterModalOpen, setNewsletterModalOpen] = useState(false);
  const [newsletterDrawerOpen, setNewsletterDrawerOpen] = useState(false);
  const [selectedNewsletter, setSelectedNewsletter] = useState<any>(null);
  const [selectedDateForNewsletter, setSelectedDateForNewsletter] = useState<Date | null>(null);
  const [newsletterMode, setNewsletterMode] = useState<'create' | 'edit'>('create');

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

  // Save newsletter visibility state
  const toggleNewsletterVisibility = useCallback(() => {
    const newValue = !showNewsletters;
    setShowNewsletters(newValue);
    updateState('showNewsletters', newValue);
  }, [showNewsletters, updateState]);

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
      toast({
        title: "Error",
        description: "Failed to complete tasks. Please try again.",
        variant: "destructive"
      });
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
      toast({
        title: "Error",
        description: "Failed to delete tasks. Please try again.",
        variant: "destructive"
      });
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

  const handleNewsletterClick = (newsletter: any) => {
    setSelectedNewsletter(newsletter);
    setNewsletterDrawerOpen(true);
  };

  const handleDateClick = (date: Date) => {
    // Open newsletter creation modal for selected date
    setSelectedDateForNewsletter(date);
    setNewsletterMode('create');
    setNewsletterModalOpen(true);
  };

  // Newsletter action handlers
  const handleCreateNewsletter = () => {
    setSelectedDateForNewsletter(new Date());
    setNewsletterMode('create');
    setNewsletterModalOpen(true);
  };

  const handleEditNewsletter = (newsletter: any) => {
    setSelectedNewsletter(newsletter);
    setNewsletterMode('edit');
    setNewsletterModalOpen(true);
  };

  const handleDuplicateNewsletter = async (newsletter: any) => {
    try {
      await duplicateNewsletter(newsletter);
      onDataUpdate(); // Refresh the parent data
    } catch (error) {
      console.error('Error duplicating newsletter:', error);
    }
  };

  const handleDeleteNewsletter = async (newsletter: any) => {
    try {
      await deleteNewsletter(newsletter.id);
      onDataUpdate(); // Refresh the parent data
    } catch (error) {
      console.error('Error deleting newsletter:', error);
    }
  };

  const handleViewNewsletterInCRM = (newsletter: any) => {
    navigate(`/crm/campaigns/${newsletter.id}`);
  };

  const handleNewsletterSuccess = () => {
    onDataUpdate(); // Refresh the parent data
  };

  const isTaskSelected = useCallback((task: any) => {
    return selectedTasks.includes(task.id);
  }, [selectedTasks]);

  return (
    <div className="h-full flex flex-col space-y-4">

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
          newsletters={showNewsletters ? newsletters : []}
          currentDate={currentDate}
          viewMode={viewMode}
          onTaskClick={handleTaskClick}
          onTaskLongPress={handleTaskLongPress}
          onCampaignClick={handleCampaignClick}
          onNewsletterClick={handleNewsletterClick}
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

      {/* Newsletter Modals */}
      <NewsletterSchedulingModal
        isOpen={newsletterModalOpen}
        onClose={() => {
          setNewsletterModalOpen(false);
          setSelectedNewsletter(null);
          setSelectedDateForNewsletter(null);
        }}
        onSuccess={handleNewsletterSuccess}
        selectedDate={selectedDateForNewsletter || undefined}
        existingNewsletter={newsletterMode === 'edit' ? selectedNewsletter : undefined}
        mode={newsletterMode}
      />

      <NewsletterEditDrawer
        newsletter={selectedNewsletter}
        isOpen={newsletterDrawerOpen}
        onClose={() => {
          setNewsletterDrawerOpen(false);
          setSelectedNewsletter(null);
        }}
        onEdit={handleEditNewsletter}
        onDuplicate={handleDuplicateNewsletter}
        onDelete={handleDeleteNewsletter}
        onViewInCRM={handleViewNewsletterInCRM}
      />

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
