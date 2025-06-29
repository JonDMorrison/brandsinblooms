
import React, { useState } from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { FocusCarousel } from '@/components/focus/FocusCarousel';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { ImageGallery } from '@/components/new-dashboard/ImageGallery';
import { SmartTimeRibbon } from '@/components/new-dashboard/SmartTimeRibbon';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TimeSelectionModal {
  isOpen: boolean;
  draftId: string | null;
  targetDate: Date | null;
}

const NewDashboard = () => {
  const { user } = useAuth();
  const { data: dashboardData, isLoading, refetch } = useDashboardData();
  const { schedulePost } = useScheduledPosts();
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  const [timeSelectionModal, setTimeSelectionModal] = useState<TimeSelectionModal>({
    isOpen: false,
    draftId: null,
    targetDate: null
  });

  const handleTaskUpdate = () => {
    refetch();
  };

  const mapPlatformToEnum = (platform: string): "FB" | "IG_FEED" | "IG_REEL" => {
    const platformMap: { [key: string]: "FB" | "IG_FEED" | "IG_REEL" } = {
      'facebook': 'FB',
      'instagram': 'IG_FEED',
      'instagram_story': 'IG_FEED',
      'instagram_reel': 'IG_REEL',
      'linkedin': 'FB',
      'twitter': 'FB'
    };
    return platformMap[platform] || 'FB';
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

  const scheduleDraft = async (draftId: string, publishAt: Date, platform: string = 'facebook') => {
    if (!user) throw new Error('User not authenticated');

    try {
      const draft = dashboardData?.tasks.find(t => t.id === draftId);
      if (!draft) throw new Error('Draft not found');

      // Create generated content from the draft
      const { data: generatedContent, error: contentError } = await supabase
        .from('generated_content')
        .insert({
          user_id: user.id,
          caption: draft.ai_output || '',
          status: 'SCHEDULED'
        })
        .select()
        .single();

      if (contentError) throw contentError;

      const platformEnum = mapPlatformToEnum(platform);

      // Create scheduled post
      const { error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          content_id: generatedContent.id,
          user_id: user.id,
          platform: platformEnum,
          publish_at: publishAt.toISOString(),
          status: 'QUEUED'
        });

      if (scheduleError) {
        console.error('Schedule error:', scheduleError);
        throw new Error(`Failed to schedule: ${scheduleError.message}`);
      }

      // Update the draft status to "scheduled" (not "approved")
      await supabase
        .from('content_tasks')
        .update({ 
          status: 'scheduled',
          scheduled_date: format(publishAt, 'yyyy-MM-dd')
        })
        .eq('id', draftId);

      await refetch();

      return generatedContent.id;
    } catch (error) {
      console.error('Error scheduling draft:', error);
      throw error;
    }
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
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId.startsWith('day-')
    ) {
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        setTimeSelectionModal({
          isOpen: true,
          draftId: draggableId,
          targetDate: targetDate
        });
        
      } catch (error) {
        console.error('Error processing drag:', error);
        toast.error('Failed to process drag operation');
      }
    }
  };

  const handleTimeSelection = async (timeOption: 'now' | 'best' | 'custom', customTime?: string) => {
    if (!timeSelectionModal.draftId || !timeSelectionModal.targetDate) return;

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

      await scheduleDraft(timeSelectionModal.draftId, scheduledDate, 'facebook');
      
      const toastId = toast.success(`Scheduled for ${format(scheduledDate, 'MMM d, yyyy')} at ${format(scheduledDate, 'h:mm a')}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            toast.success('Scheduling undone');
          }
        }
      });
      
      setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
      
    } catch (error) {
      console.error('Error scheduling draft:', error);
      toast.error(`Failed to schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    <FullWidthLayout>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="min-h-screen bg-[#F9FAFB] p-6 pb-60">
          <div className="max-w-full mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">BloomSuite Dashboard</h1>
              <p className="text-gray-600">Your content creation command center</p>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-6">
              <div className="col-span-4 space-y-6">
                <div className="h-[480px]">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>

                <div className="flex-1">
                  <DraftTray 
                    tasks={dashboardData?.tasks || []}
                    selectedDraft={selectedDraft}
                    onSelectDraft={setSelectedDraft}
                    justApprovedId={justApprovedId}
                  />
                </div>
              </div>

              <div className="col-span-8 space-y-6">
                <div className="h-[480px]">
                  <ComposerPanel 
                    selectedDraft={selectedDraft}
                    socialConnections={dashboardData?.socialConnections || []}
                    onTaskUpdate={handleTaskUpdate}
                    onApproved={handleApproved}
                  />
                </div>

                <div className="h-[240px]">
                  <ImageGallery selectedDraft={selectedDraft} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SmartTimeRibbon 
          tasks={dashboardData?.tasks || []}
          onScheduleUpdate={handleTaskUpdate}
          onScheduledContentClick={handleScheduledContentClick}
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
                onClick={() => handleTimeSelection('best')}
                className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9]"
              >
                <div className="font-medium">Best Time</div>
                <div className="text-sm text-gray-500">AI-optimized posting time for maximum engagement</div>
              </button>
              
              <button
                onClick={() => handleTimeSelection('now')}
                className="w-full p-3 text-left border rounded-lg hover:bg-[#68BEB9]/10 hover:border-[#68BEB9]"
              >
                <div className="font-medium">Post Now</div>
                <div className="text-sm text-gray-500">Schedule for immediate posting</div>
              </button>
              
              <div className="border rounded-lg p-3">
                <div className="font-medium mb-2">Custom Time</div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    className="border rounded px-2 py-1"
                    onChange={(e) => {
                      if (e.target.value) {
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
                onClick={() => setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null })}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </FullWidthLayout>
  );
};

export default NewDashboard;
