import React, { useState, useEffect } from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { FocusCarousel } from '@/components/focus/FocusCarousel';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { ImageGallery } from '@/components/new-dashboard/ImageGallery';
import { SmartTimeRibbon } from '@/components/new-dashboard/SmartTimeRibbon';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DashboardData {
  currentCampaign: any;
  tasks: any[];
  socialConnections: any[];
}

interface TimeSelectionModal {
  isOpen: boolean;
  draftId: string | null;
  targetDate: Date | null;
}

const NewDashboard = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  const [timeSelectionModal, setTimeSelectionModal] = useState<TimeSelectionModal>({
    isOpen: false,
    draftId: null,
    targetDate: null
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, tenant]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch current campaign
      const campaignQuery = supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (tenant?.id) {
        campaignQuery.eq('tenant_id', tenant.id);
      } else {
        campaignQuery.eq('user_id', user?.id);
      }

      const { data: campaigns } = await campaignQuery;
      const currentCampaign = campaigns?.[0] || null;

      // Fetch tasks - including all content types
      const taskQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('status', ['draft', 'generated', 'approved', 'review'])
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery.eq('user_id', user?.id);
      }

      const { data: tasks } = await taskQuery;

      // Fetch social connections
      const { data: connections } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true);

      setDashboardData({
        currentCampaign,
        tasks: tasks || [],
        socialConnections: connections || []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = () => {
    fetchDashboardData();
  };

  const mapPlatformToEnum = (platform: string): string => {
    const platformMap: { [key: string]: string } = {
      'facebook': 'FB',
      'instagram': 'IG_FEED',
      'instagram_story': 'IG_STORY',
      'instagram_reel': 'IG_REEL',
      'linkedin': 'LINKEDIN',
      'twitter': 'TWITTER'
    };
    return platformMap[platform] || 'FB'; // Default to Facebook
  };

  const getOptimalTime = (date: Date, platform: string = 'facebook'): Date => {
    const optimalTimes = {
      facebook: [9, 15, 18], // 9 AM, 3 PM, 6 PM
      instagram: [11, 14, 17], // 11 AM, 2 PM, 5 PM
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
      // Get the draft content
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

      // Map platform to correct enum value
      const platformEnum = mapPlatformToEnum(platform);

      // Create scheduled post with proper platform enum
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

      // Update the draft status to approved
      await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', draftId);

      // Refresh data
      await fetchDashboardData();

      return generatedContent.id;
    } catch (error) {
      console.error('Error scheduling draft:', error);
      throw error;
    }
  };

  const handleApproved = (draftId: string) => {
    setJustApprovedId(draftId);
    // Clear the hint after showing it
    setTimeout(() => setJustApprovedId(null), 100);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Handle drag from draft tray to calendar day
    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId.startsWith('day-')
    ) {
      try {
        const dateStr = destination.droppableId.replace('day-', '');
        const targetDate = new Date(dateStr);
        
        // Show time selection modal instead of immediate scheduling
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

      // Schedule the draft
      await scheduleDraft(timeSelectionModal.draftId, scheduledDate, 'facebook');
      
      // Show success toast with undo option
      const toastId = toast.success(`Scheduled for ${format(scheduledDate, 'MMM d, yyyy')} at ${format(scheduledDate, 'h:mm a')}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            // TODO: Implement undo functionality
            toast.success('Scheduling undone');
          }
        }
      });
      
      // Close modal
      setTimeSelectionModal({ isOpen: false, draftId: null, targetDate: null });
      
    } catch (error) {
      console.error('Error scheduling draft:', error);
      toast.error(`Failed to schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
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
        {/* Main content with bottom padding to account for fixed ribbon */}
        <div className="min-h-screen bg-[#F9FAFB] p-6 pb-60">
          <div className="max-w-full mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">BloomSuite Dashboard</h1>
              <p className="text-gray-600">Your content creation command center</p>
            </div>

            {/* Main Dashboard Grid - Updated layout: 4 cols left, 8 cols right */}
            <div className="grid grid-cols-12 gap-6 mb-6">
              {/* Left Column - Today's Focus + Draft Tray stacked */}
              <div className="col-span-4 space-y-6">
                {/* Today's Focus Carousel */}
                <div className="h-[480px]">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>

                {/* Draft Tray */}
                <div className="flex-1">
                  <DraftTray 
                    tasks={dashboardData?.tasks || []}
                    selectedDraft={selectedDraft}
                    onSelectDraft={setSelectedDraft}
                    justApprovedId={justApprovedId}
                  />
                </div>
              </div>

              {/* Right Column - Composer Panel + Image Gallery stacked */}
              <div className="col-span-8 space-y-6">
                {/* Composer Panel (reduced height) */}
                <div className="h-[480px]">
                  <ComposerPanel 
                    selectedDraft={selectedDraft}
                    socialConnections={dashboardData?.socialConnections || []}
                    onTaskUpdate={handleTaskUpdate}
                    onApproved={handleApproved}
                  />
                </div>

                {/* Image Gallery */}
                <div className="h-[240px]">
                  <ImageGallery selectedDraft={selectedDraft} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Smart-Time Ribbon at bottom */}
        <SmartTimeRibbon 
          tasks={dashboardData?.tasks || []}
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
