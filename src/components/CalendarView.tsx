
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarPlanningPanel } from './calendar/CalendarPlanningPanel';
import { CalendarListView } from './calendar/CalendarListView';
import { QuickAddSheet } from './calendar/QuickAddSheet';
import { DayEventsModal } from './calendar/DayEventsModal';
import { NewsletterSchedulingModal } from './calendar/NewsletterSchedulingModal';
import { NewsletterEditDrawer } from './calendar/NewsletterEditDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUnifiedCalendarData } from '@/hooks/useUnifiedCalendarData';
import { useNewsletterCalendar } from '@/hooks/useNewsletterCalendar';
import { useSeasonalHolidays } from '@/hooks/useSeasonalHolidays';
import { supabase } from '@/integrations/supabase/client';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { format, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { ContentViewerDialog } from './content/ContentViewerDialog';
import { CampaignDetailsModal } from './calendar/CampaignDetailsModal';
import { useRouteState } from '@/hooks/useRouteState';
import { Mail, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const CalendarView = React.memo(({ onDataUpdate }: {
  onDataUpdate: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Unified calendar data
  const {
    events,
    eventsByDate,
    getEventsForDate,
    filters,
    updateFilters,
    filterOptions,
    loading,
    refetch,
    rawData
  } = useUnifiedCalendarData();

  // Individual hooks for specific actions
  const {
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    duplicateNewsletter,
  } = useNewsletterCalendar();

  const { generateHolidayContent } = useSeasonalHolidays();

  // Route state management for persistence between page navigations
  const { saveState, getState, updateState } = useRouteState({
    selectedTasks: [],
    viewMode: 'month',
    currentDate: new Date().toISOString(),
    showPlanningPanel: false
  }, { disableScrollTracking: true });

  // Initialize state from saved route state
  const savedState = getState();
  const [selectedTasks, setSelectedTasks] = useState<string[]>(savedState.selectedTasks || []);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>(savedState.viewMode || 'month');
  const [currentDate, setCurrentDate] = useState<Date>(
    savedState.currentDate ? new Date(savedState.currentDate) : new Date()
  );
  const [showPlanningPanel, setShowPlanningPanel] = useState<boolean>(savedState.showPlanningPanel ?? false);
  // Modal state
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  
  // Quick add and newsletter modals
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedDateForQuickAdd, setSelectedDateForQuickAdd] = useState<Date | null>(null);
  const [newsletterModalOpen, setNewsletterModalOpen] = useState(false);
  const [newsletterDrawerOpen, setNewsletterDrawerOpen] = useState(false);
  const [selectedNewsletter, setSelectedNewsletter] = useState<any>(null);
  const [selectedDateForNewsletter, setSelectedDateForNewsletter] = useState<Date | null>(null);
  const [newsletterMode, setNewsletterMode] = useState<'create' | 'edit'>('create');
  
  // Day events modal state
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false);
  const [selectedDateForEvents, setSelectedDateForEvents] = useState<Date | null>(null);

  // Use the drag and drop hook with proper handlers
  const { isDragging, draggedTask, handleDragStart, handleDragEnd, handleDrop } = useDragAndDrop(() => {
    refetch();
    onDataUpdate();
  });

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
  const handleViewModeChange = useCallback((newViewMode: 'month' | 'week' | 'list') => {
    setViewMode(newViewMode);
    updateState('viewMode', newViewMode);
  }, [updateState]);

  // Toggle planning panel
  const togglePlanningPanel = useCallback(() => {
    const newValue = !showPlanningPanel;
    setShowPlanningPanel(newValue);
    updateState('showPlanningPanel', newValue);
  }, [showPlanningPanel, updateState]);

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

  // Event click handler for unified events
  const handleEventClick = (event: any) => {
    switch (event.type) {
      case 'task':
        setSelectedTaskForModal(event.meta);
        setContentModalOpen(true);
        break;
      case 'event':
        setSelectedCampaignForModal(event.meta);
        setCampaignModalOpen(true);
        break;
      case 'newsletter':
        setSelectedNewsletter(event.meta);
        setNewsletterDrawerOpen(true);
        break;
      case 'scheduled_post':
        // Handle scheduled post view/edit
        toast({
          title: "Scheduled Post",
          description: `${event.platform} post scheduled for ${event.time}`,
        });
        break;
      case 'holiday':
        // Handle holiday content generation
        handleHolidayGenerate(event.meta);
        break;
    }
  };

  // Holiday content generation
  const handleHolidayGenerate = async (holiday: any) => {
    try {
      await generateHolidayContent(holiday.id);
      toast({
        title: "Content Generated",
        description: `Holiday content created for ${holiday.holiday_name}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate holiday content",
        variant: "destructive"
      });
    }
  };

  // Quick add action handlers
  const handleCreateSocialPost = async (date: Date) => {
    try {
      const { error } = await supabase
        .from('content_tasks')
        .insert({
          scheduled_date: format(date, 'yyyy-MM-dd'),
          status: 'planned',
          user_id: rawData.campaigns[0]?.user_id, // Get from existing data
          tenant_id: rawData.campaigns[0]?.tenant_id
        });

      if (error) throw error;
      
      toast({
        title: "Social Post Created",
        description: `Content task scheduled for ${format(date, 'MMMM d, yyyy')}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create social post",
        variant: "destructive"
      });
    }
  };

  const handleCreateEvent = (date: Date) => {
    // Navigate to event creation with pre-filled date
    navigate('/calendar?create=event&date=' + format(date, 'yyyy-MM-dd'));
  };

  const handleCreateTask = async (date: Date) => {
    try {
      const { error } = await supabase
        .from('content_tasks')
        .insert({
          scheduled_date: format(date, 'yyyy-MM-dd'),
          status: 'planned',
          user_id: rawData.campaigns[0]?.user_id, // Get from existing data
          tenant_id: rawData.campaigns[0]?.tenant_id
        });

      if (error) throw error;
      
      toast({
        title: "Task Created",
        description: `Task scheduled for ${format(date, 'MMMM d, yyyy')}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to create task",
        variant: "destructive"
      });
    }
  };

  const handleDateClick = (date: Date) => {
    // Open day events modal to show all events for this date
    setSelectedDateForEvents(date);
    setDayEventsModalOpen(true);
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
        showPlanningPanel={showPlanningPanel}
        filters={filters}
        filterOptions={filterOptions}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        onViewModeChange={handleViewModeChange}
        onBulkComplete={handleBulkComplete}
        onBulkDelete={handleBulkDelete}
        onFiltersChange={updateFilters}
        onCreateEvent={() => handleCreateEvent(new Date())}
        onCreateCampaign={() => navigate('/campaigns/new')}
        onTogglePlanningPanel={togglePlanningPanel}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          {viewMode === 'list' ? (
            <CalendarListView 
              events={events}
              onEventClick={handleEventClick}
            />
          ) : (
            <CalendarGrid
              campaigns={rawData.campaigns}
              tasks={rawData.tasks}
              newsletters={rawData.newsletters}
              scheduledPosts={rawData.scheduledPosts}
              holidays={rawData.holidays}
              unifiedEvents={events}
              eventsByDate={eventsByDate}
              currentDate={currentDate}
              viewMode={viewMode}
              onTaskClick={handleTaskClick}
              onTaskLongPress={handleTaskLongPress}
              onCampaignClick={handleCampaignClick}
              onNewsletterClick={handleNewsletterClick}
              onEventClick={handleEventClick}
              onDateClick={handleDateClick}
              selectedTasks={selectedTasks}
              onDrop={handleDrop}
              isTaskSelected={isTaskSelected}
              isDragging={isDragging}
              draggedTask={draggedTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          )}
        </div>
        {showPlanningPanel && (
          <CalendarPlanningPanel
            filters={filters}
            onFiltersChange={updateFilters}
            filterOptions={filterOptions}
            onThemeSchedule={() => {}}
            onHolidayAction={handleHolidayGenerate}
          />
        )}
      </div>

      <QuickAddSheet
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        selectedDate={selectedDateForQuickAdd}
        onCreateSocialPost={handleCreateSocialPost}
        onCreateNewsletter={(date) => {
          setSelectedDateForNewsletter(date);
          setNewsletterMode('create');
          setNewsletterModalOpen(true);
        }}
        onCreateEvent={handleCreateEvent}
        onCreateTask={handleCreateTask}
      />

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

      {/* Day Events Modal */}
      <DayEventsModal
        isOpen={dayEventsModalOpen}
        onClose={() => {
          setDayEventsModalOpen(false);
          setSelectedDateForEvents(null);
        }}
        date={selectedDateForEvents}
        events={events}
        onEventClick={handleEventClick}
      />
    </div>
  );
});
