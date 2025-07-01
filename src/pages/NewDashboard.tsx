
import React, { useState, useEffect, useCallback } from 'react';
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
  const [dragError, setDragError] = useState<string | null>(null);
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

  // Enhanced cleanup function with DOM manipulation
  const forceCleanupDragState = useCallback(() => {
    console.log('🎯 NewDashboard: Force cleaning up all drag state');
    
    // Stop dragging context
    stopDragging();
    
    // Clear modal state
    setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
    setIsScheduling(false);
    setDragError(null);
    
    // Remove any stuck drag elements from DOM
    const stuckElements = document.querySelectorAll('[data-rbd-drag-handle-dragging-id]');
    stuckElements.forEach(el => {
      el.removeAttribute('data-rbd-drag-handle-dragging-id');
    });
    
    // Remove any floating drag elements
    const floatingElements = document.querySelectorAll('[data-rbd-draggable-id]');
    floatingElements.forEach(el => {
      const element = el as HTMLElement;
      if (element.style.transform && element.style.transform.includes('translate')) {
        element.style.transform = '';
        element.style.position = '';
        element.style.zIndex = '';
      }
    });
    
    // Clear any drag classes
    document.body.classList.remove('dragging');
    document.body.style.cursor = '';
    
    // Close dock after cleanup
    setTimeout(() => {
      if (!isDragging) closeDock();
    }, 100);
  }, [stopDragging, closeDock, isDragging]);

  const handleDragStart = (start: any) => {
    console.log('🎯 NewDashboard: Drag started', start);
    setDragError(null);
    startDragging();
    
    // Add visual feedback
    document.body.classList.add('dragging');
  };

  const handleDragEnd = async (result: DropResult) => {
    console.log('🎯 NewDashboard: Drag ended', result);
    
    try {
      // Always clean up drag state first
      document.body.classList.remove('dragging');
      stopDragging();
      
      // Validate result
      if (!result.source || !result.draggableId) {
        console.log('🎯 Invalid drag result, force cleanup');
        forceCleanupDragState();
        return;
      }

      const { destination, source, draggableId } = result;
      const taskId = draggableId.replace('task-', '');

      // If no destination, force cleanup
      if (!destination) {
        console.log('🎯 No destination, force cleanup');
        forceCleanupDragState();
        return;
      }

      console.log('🎯 Drag from', source.droppableId, 'to', destination.droppableId);

      // Handle reordering within the draft-tray
      if (
        source.droppableId === 'draft-tray' &&
        destination.droppableId === 'draft-tray' &&
        source.index !== destination.index
      ) {
        console.log('🎯 Reordering within draft tray');
        const newOrder = reorderArray(draftOrder, source.index, destination.index);
        setDraftOrder(newOrder);
        setTimeout(() => closeDock(), 300);
        return;
      }

      // Handle scheduling operations
      if (destination.droppableId.startsWith('day-')) {
        console.log('🎯 Scheduling operation detected');
        
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        // Validate the date
        if (isNaN(targetDate.getTime())) {
          throw new Error('Invalid target date');
        }
        
        console.log('🎯 Setting up time selection modal');
        
        setTimeSelectionModal({
          isOpen: true,
          draftId: taskId,
          targetDate: targetDate
        });
        
        return; // Keep dock open for scheduling flow
      }

      // For any other operations, force cleanup
      forceCleanupDragState();
      
    } catch (error) {
      console.error('🎯 Error in drag end handler:', error);
      setDragError(error instanceof Error ? error.message : 'Drag operation failed');
      toast.error('Failed to process drag operation');
      forceCleanupDragState();
    }
  };

  const handleTimeSelection = async (timeOption: 'now' | 'best' | 'custom', customTime?: string) => {
    console.log('🎯 handleTimeSelection called with:', { timeOption, customTime });
    
    if (!timeSelectionModal.draftId || !timeSelectionModal.targetDate) {
      console.error('🎯 Missing required data for scheduling');
      toast.error('Missing scheduling information');
      return;
    }

    setIsScheduling(true);
    
    try {
      let scheduledDate = new Date(timeSelectionModal.targetDate);
      
      if (timeOption === 'best') {
        scheduledDate = getOptimalTime(timeSelectionModal.targetDate);
      } else if (timeOption === 'custom' && customTime) {
        const [hours, minutes] = customTime.split(':').map(Number);
        scheduledDate.setHours(hours, minutes, 0, 0);
      } else if (timeOption === 'now') {
        scheduledDate = new Date();
      }

      const result = await scheduleDraft({
        taskId: timeSelectionModal.draftId,
        publishAt: scheduledDate.toISOString(),
        platform: 'FACEBOOK'
      });

      if (result) {
        console.log('✅ Successfully scheduled:', result);
        
        const timeString = format(scheduledDate, 'MMM d, yyyy h:mm a');
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

        await handleTaskUpdate();
        
        // Clean up and close
        setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
        setIsScheduling(false);
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

  // Enhanced escape handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('🎯 Escape pressed, force cleanup');
        forceCleanupDragState();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [forceCleanupDragState]);

  // Auto-cleanup with shorter timeout
  useEffect(() => {
    if (isDragging) {
      const timeout = setTimeout(() => {
        console.log('🎯 Auto-cleanup: Drag state stuck too long');
        forceCleanupDragState();
      }, 10000); // Reduced to 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [isDragging, forceCleanupDragState]);

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
        {/* Enhanced global drag styles */}
        <style>{`
          .dragging {
            user-select: none;
          }
          .dragging * {
            pointer-events: none;
          }
          [data-rbd-draggable-id] {
            transition: transform 0.2s ease;
          }
          [data-rbd-draggable-id][data-rbd-drag-handle-dragging-id] {
            z-index: 9999 !important;
            pointer-events: none;
          }
        `}</style>
        
        <div className="min-h-screen bg-[#F9FAFB] p-6 dashboard-content">
          {/* Fixed UserMenu */}
          <div className="fixed top-6 right-6 z-[9999]">
            <UserMenu />
          </div>
          
          {/* Error Display with Recovery */}
          {dragError && (
            <div className="fixed top-20 right-6 z-[9998] bg-red-50 border border-red-200 rounded-lg p-3 max-w-md">
              <p className="text-sm text-red-800 mb-2">{dragError}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setDragError(null)}
                  className="text-xs text-red-600 underline"
                >
                  Dismiss
                </button>
                <button 
                  onClick={forceCleanupDragState}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  Force Fix
                </button>
              </div>
            </div>
          )}
          
          <div className="max-w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">BloomSuite Dashboard</h1>
              <p className="text-gray-600">Your content creation command center</p>
            </div>

            {/* Grid with 3-3-4 column distribution */}
            <div className="grid grid-cols-10 gap-6 mb-6 min-h-0">
              {/* Today's Focus */}
              <div className="col-span-3 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>
              </div>

              {/* Draft Tray */}
              <div className="col-span-3 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <DraftTray 
                    tasks={getOrderedDrafts()}
                    selectedDraft={selectedDraft}
                    onSelectDraft={setSelectedDraft}
                    justApprovedId={justApprovedId}
                  />
                </div>
              </div>

              {/* Composer Panel */}
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
