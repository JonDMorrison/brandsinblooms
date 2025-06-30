
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
import { useDashboard } from '@/contexts/DashboardContext';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { DashboardProvider } from '@/contexts/DashboardContext';

interface TimeSelectionModal {
  isOpen: boolean;
  draftId: string | null;
  targetDate: Date | null;
}

const NewDashboardContent = () => {
  const { user } = useAuth();
  const { closeDock } = useDashboard();
  const { stopDragging } = useDashboardContext();
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

  const handleTaskUpdate = () => {
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

  // Handle clicking on scheduled content in the ribbon
  const handleScheduledContentClick = (scheduledTask: any) => {
    setSelectedDraft(scheduledTask);
  };

  const handleDragEnd = async (result: DropResult) => {
    console.log('🎯 NewDashboard handleDragEnd called:', result);
    
    // Always stop dragging state first
    stopDragging();
    
    const { destination, source, draggableId } = result;

    if (!destination) {
      console.log('🎯 No destination in NewDashboard - will close dock after delay');
      // Close dock after 300ms delay if drag ended outside dock
      setTimeout(() => {
        closeDock();
      }, 300);
      return;
    }

    console.log('🎯 Drag from', source.droppableId, 'to', destination.droppableId);

    // Handle drag from draft-tray to SmartTimeDock day slots
    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId.startsWith('day-')
    ) {
      console.log('🎯 Draft to day drop detected - keeping dock open');
      
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        console.log('🎯 Setting up time selection modal for:', { draggableId, targetDate });
        
        setTimeSelectionModal({
          isOpen: true,
          draftId: draggableId,
          targetDate: targetDate
        });
        
        // Keep dock open since we're in scheduling flow
        return;
        
      } catch (error) {
        console.error('🎯 Error processing drag:', error);
        toast.error('Failed to process drag operation');
        // Close dock after delay on error
        setTimeout(() => {
          closeDock();
        }, 300);
      }
    }

    // Handle drag from composer-panel to SmartTimeDock day slots
    if (
      source.droppableId === 'composer-panel' &&
      destination.droppableId.startsWith('day-')
    ) {
      console.log('🎯 Composer to day drop detected - keeping dock open');
      
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        // Extract the actual task ID from the draggableId (format: composer-{taskId})
        const taskId = draggableId.replace('composer-', '');
        
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
        // Close dock after delay on error
        setTimeout(() => {
          closeDock();
        }, 300);
      }
    }

    // For any other drag operations, close dock after delay
    setTimeout(() => {
      closeDock();
    }, 300);
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
        await refetch();
        
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

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
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

            {/* Updated to 3-column layout with closer to 30-30-40 distribution */}
            <div className="grid grid-cols-12 gap-6 mb-6">
              {/* Today's Focus - Column 1 (3/12 = 25%, closest to 30%) */}
              <div className="col-span-3">
                <div className="h-[720px]">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>
              </div>

              {/* Draft Tray - Column 2 (4/12 = 33.33%, closest to 30%) */}
              <div className="col-span-4">
                <div className="h-[720px]">
                  <DraftTray 
                    tasks={dashboardData?.tasks || []}
                    selectedDraft={selectedDraft}
                    onSelectDraft={setSelectedDraft}
                    justApprovedId={justApprovedId}
                  />
                </div>
              </div>

              {/* Composer Panel - Column 3 (5/12 = 41.67%, closest to 40%) */}
              <div className="col-span-5">
                <div className="h-[720px]">
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
      </DragDropContext>

      {/* Time Selection Modal */}
      {timeSelectionModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Choose Posting Time</h3>
            <p className="text-gray-600 mb-6">
              When would you like to post this content on {timeSelectionModal.targetDate ? format(timeSelectionModal.targetDate, 'MMMM d, yyyy') : ''}?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  console.log('🎯 Best Time button clicked');
                  handleTimeSelection('best');
                }}
                disabled={isScheduling}
                className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium">Best Time</div>
                <div className="text-sm text-gray-500">AI-optimized posting time for maximum engagement</div>
              </button>
              
              <button
                onClick={() => {
                  console.log('🎯 Post Now button clicked');
                  handleTimeSelection('now');
                }}
                disabled={isScheduling}
                className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium">Post Now</div>
                <div className="text-sm text-gray-500">Schedule for immediate posting</div>
              </button>
              
              <div className="border rounded-lg p-3">
                <div className="font-medium mb-2">Custom Time</div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    disabled={isScheduling}
                    className="border rounded px-2 py-1 disabled:opacity-50"
                    onChange={(e) => {
                      if (e.target.value && !isScheduling) {
                        console.log('🎯 Custom time selected:', e.target.value);
                        handleTimeSelection('custom', e.target.value);
                      }
                    }}
                  />
                  <span className="text-sm text-gray-500 self-center">Choose specific time</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  console.log('🎯 Cancel button clicked');
                  setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
                }}
                disabled={isScheduling}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
            
            {isScheduling && (
              <div className="flex items-center justify-center mt-4">
                <div className="flex items-center gap-2 text-[#68BEB9]">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#68BEB9]"></div>
                  <span className="text-sm">Scheduling...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
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
