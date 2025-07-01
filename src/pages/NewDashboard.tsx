import React, { useState } from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { FocusCarousel } from '@/components/focus/FocusCarousel';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { SmartTimeDock } from '@/components/smart-time';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UserMenu } from '@/components/UserMenu';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleDraft } from '@/lib/dashboardAPI';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { reorderArray } from '@/utils/dragUtils';
import { TimePopoverModal } from '@/components/smart-time/TimePopoverModal';
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary';
import { useQueryClient } from '@tanstack/react-query';

interface TimeSelectionModal {
  isOpen: boolean;
  draftId: string | null;
  targetDate: Date | null;
}

const NewDashboardContent = () => {
  const { user } = useAuth();
  const { closeDock, isDragging, draftOrder, setDraftOrder, getOrderedDrafts, startDragging, stopDragging } = useDashboardContext();
  const { data: dashboardData, isLoading, refetch } = useDashboardData();
  const { schedulePost } = useScheduledPosts();
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  const [timeSelectionModal, setTimeSelectionModal] = useState<TimeSelectionModal>({
    isOpen: false,
    draftId: null,
    targetDate: null
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const queryClient = useQueryClient();

  const handleTaskUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    refetch();
  };

  const getOptimalTime = (date: Date, platform: string = 'facebook'): Date => {
    const optimalTimes = {
      facebook: [9, 15, 18],
      instagram: [11, 14, 17],
    };
    
    const times = optimalTimes[platform as keyof typeof optimalTimes] || optimalTimes.facebook;
    const randomHour = times[Math.floor(Math.random() * times.length)];
    
    const scheduledDate = new Date(date);
    scheduledDate.setHours(randomHour, 0, 0, 0);
    return scheduledDate;
  };

  const handleApproved = (draftId: string) => {
    setJustApprovedId(draftId);
    setTimeout(() => setJustApprovedId(null), 100);
  };

  const handleDragStart = (start: any) => {
    console.log('🎯 NewDashboard: Drag started', start);
    startDragging();
  };

  const handleDragEnd = async (result: DropResult) => {
    console.log('🎯 NewDashboard: Drag ended', result);
    
    // Always stop dragging first
    stopDragging();
    
    if (!result.source || !result.draggableId) {
      console.log('🎯 No source or draggableId, closing dock after delay');
      setTimeout(() => {
        if (!isDragging) closeDock();
      }, 400);
      return;
    }

    const { destination, source, draggableId } = result;
    const taskId = draggableId.replace('task-', ''); // Extract task ID from draggableId

    // If no destination, close dock after delay
    if (!destination) {
      console.log('🎯 No destination in NewDashboard');
      setTimeout(() => {
        if (!isDragging) closeDock();
      }, 400);
      return;
    }

    console.log('🎯 Drag from', source.droppableId, 'to', destination.droppableId);

    // Handle reordering within the draft-tray
    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId === 'draft-tray' &&
      source.index !== destination.index
    ) {
      console.log('🎯 Reordering within draft tray:', { from: source.index, to: destination.index });
      
      // Reorder the draft array
      const newOrder = reorderArray(draftOrder, source.index, destination.index);
      setDraftOrder(newOrder);
      
      console.log('🎯 New draft order:', newOrder);
      return;
    }

    // Dock collapse rule
    const landedInDock = destination.droppableId?.startsWith('day-');
    if (!landedInDock && destination) {
      // Reorder in tray; keep dock open
      return;
    }
    if (!landedInDock && !destination) {
      setTimeout(() => { 
        if (!isDragging) closeDock(); 
      }, 400);
      return;
    }

    // Handle drag from draft-tray to SmartTimeDock day slots
    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId.startsWith('day-')
    ) {
      console.log('🎯 Draft to day drop detected - showing time selection modal');
      
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        console.log('🎯 Setting up time selection modal for:', { taskId, targetDate });
        
        setTimeSelectionModal({
          isOpen: true,
          draftId: taskId,
          targetDate: targetDate
        });
        
        // Keep dock open since we're in scheduling flow
        return;
        
      } catch (error) {
        console.error('🎯 Error processing drag:', error);
        toast.error('Failed to process drag operation');
        setTimeout(() => {
          if (!isDragging) closeDock();
        }, 400);
      }
    }

    // Handle drag from composer-panel to SmartTimeDock day slots
    if (
      source.droppableId === 'composer-panel' &&
      destination.droppableId.startsWith('day-')
    ) {
      console.log('🎯 Composer to day drop detected - showing time selection modal');
      
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        console.log('🎯 Setting up time selection modal for composer drag:', { taskId, targetDate });
        
        setTimeSelectionModal({
          isOpen: true,
          draftId: taskId,
          targetDate: targetDate
        });
        
        // Keep dock open since we're in scheduling flow
        return;
        
      } catch (error) {
        console.error('🎯 Error processing composer drag:', error);
        toast.error('Failed to process drag operation');
        setTimeout(() => {
          if (!isDragging) closeDock();
        }, 400);
      }
    }
  };

  const handleTimeSelection = async (timeOption: 'now' | 'best' | 'custom', customTime?: string) => {
    console.log('🎯 handleTimeSelection called with:', { timeOption, customTime, timeSelectionModal });
    
    if (!timeSelectionModal.draftId || !timeSelectionModal.targetDate) {
      console.error('🎯 Missing required data for scheduling:', { draftId: timeSelectionModal.draftId, targetDate: timeSelectionModal.targetDate });
      toast.error('Missing scheduling information');
      return;
    }

    setIsScheduling(true);
    
    try {
      let scheduledDate = new Date(timeSelectionModal.targetDate);
      
      if (timeOption === 'best') {
        scheduledDate = getOptimalTime(timeSelectionModal.targetDate);
        console.log('🎯 Using optimal time:', scheduledDate);
      } else if (timeOption === 'custom' && customTime) {
        const [hours, minutes] = customTime.split(':').map(Number);
        scheduledDate.setHours(hours, minutes, 0, 0);
        console.log('🎯 Using custom time:', scheduledDate);
      } else if (timeOption === 'now') {
        scheduledDate = new Date();
        console.log('🎯 Using current time:', scheduledDate);
      }

      console.log('🎯 Scheduling draft with params:', {
        taskId: timeSelectionModal.draftId,
        publishAt: scheduledDate.toISOString(),
        platform: 'FACEBOOK'
      });

      const result = await scheduleDraft({
        taskId: timeSelectionModal.draftId,
        publishAt: scheduledDate.toISOString(),
        platform: 'FACEBOOK'
      });

      if (result) {
        console.log('✅ Successfully scheduled:', result);
        
        const timeString = format(scheduledDate, 'MMM d, yyyy h:mm a');
        
        // Check user's posting eligibility
        const hasConnections = dashboardData?.socialConnections && dashboardData.socialConnections.length > 0;
        const modeText = result.mode === 'MANUAL' || !hasConnections ? ' (manual - connect social accounts for auto-posting)' : '';
        
        toast.success(`Scheduled for ${timeString}${modeText}`, {
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: async () => {
              toast.success('Scheduling undone');
            }
          }
        });

        // Refresh the dashboard data to show updated state and remove from draft tray
        await handleTaskUpdate();
        
        // Close the modal
        setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
        
        // Close the dock
        closeDock();
      } else {
        throw new Error('Scheduling failed - no result returned');
      }
      
    } catch (error) {
      console.error('❌ Error scheduling draft:', error);
      toast.error(`Failed to schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScheduling(false);
    }
  };

  if (isLoading) {
    return (
      <FullWidthLayout>
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading BloomSuite Dashboard..." />
        </div>
      </FullWidthLayout>
    );
  }

  const hasConnections = dashboardData?.socialConnections && dashboardData.socialConnections.length > 0;

  return (
    <DashboardErrorBoundary>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="min-h-screen bg-[#F9FAFB] p-6 dashboard-content">
          {/* Fixed UserMenu - positioned above everything */}
          <div className="fixed top-6 right-6 z-[9999]">
            <UserMenu />
          </div>
          
          <div className="max-w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">BloomSuite Dashboard</h1>
              <p className="text-gray-600">Your content creation command center</p>
            </div>

            {/* Grid with 3-3-4 column distribution */}
            <div className="grid grid-cols-10 gap-6 mb-6 min-h-0">
              {/* Today's Focus - Column 1 - 3 out of 10 columns */}
              <div className="col-span-3 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>
              </div>

              {/* Draft Tray - Column 2 - 3 out of 10 columns */}
              <div className="col-span-3 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <DraftTray 
                    tasks={getOrderedDrafts()}
                    selectedDraft={selectedDraft}
                    onSelectDraft={setSelectedDraft}
                    justApprovedId={justApprovedId}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              </div>

              {/* Composer Panel - Column 3 - 4 out of 10 columns */}
              <div className="col-span-4 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <ComposerPanel 
                    selectedDraft={selectedDraft}
                    socialConnections={dashboardData?.socialConnections || []}
                    onTaskUpdate={handleTaskUpdate}
                    onApproved={handleApproved}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SmartTimeDock
          scheduledByDate={dashboardData?.scheduledByDate}
          socialConnections={dashboardData?.socialConnections || []}
          onScheduleUpdate={handleTaskUpdate}
        />

        {/* Time Selection Modal */}
        {timeSelectionModal.isOpen && (
          <TimePopoverModal
            targetDate={timeSelectionModal.targetDate}
            draftId={timeSelectionModal.draftId}
            onTimeSelection={handleTimeSelection}
            isScheduling={isScheduling}
          />
        )}
      </DragDropContext>
    </DashboardErrorBoundary>
  );
};

const NewDashboard = () => {
  return (
    <DashboardProvider>
      <NewDashboardContent />
    </DashboardProvider>
  );
};

export default NewDashboard;
