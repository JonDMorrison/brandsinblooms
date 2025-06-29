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

const NewDashboard = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);

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

  const scheduleDraft = async (draftId: string, publishAt: string, platform: string = 'facebook') => {
    if (!user) throw new Error('User not authenticated');

    try {
      // First, create generated content from the draft
      const draft = dashboardData?.tasks.find(t => t.id === draftId);
      if (!draft) throw new Error('Draft not found');

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

      // Then schedule the post
      const { error: scheduleError } = await supabase
        .from('scheduled_posts')
        .insert({
          content_id: generatedContent.id,
          user_id: user.id,
          platform: platform as any,
          publish_at: publishAt,
          status: 'QUEUED'
        });

      if (scheduleError) throw scheduleError;

      // Update the draft status
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
        const publishAt = new Date(dateStr + 'T12:00:00').toISOString();
        
        // Schedule the draft immediately
        const contentId = await scheduleDraft(draggableId, publishAt);
        
        // Show success toast with undo option
        const toastId = toast.success(`Scheduled for ${format(new Date(publishAt), 'MMM d, yyyy')}`, {
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                // Delete the scheduled post
                await supabase
                  .from('scheduled_posts')
                  .delete()
                  .eq('content_id', contentId);

                // Delete the generated content
                await supabase
                  .from('generated_content')
                  .delete()
                  .eq('id', contentId);

                // Reset draft status
                await supabase
                  .from('content_tasks')
                  .update({ status: 'generated' })
                  .eq('id', draggableId);

                // Refresh data
                await fetchDashboardData();
                
                toast.success('Scheduling undone');
              } catch (error) {
                console.error('Error undoing schedule:', error);
                toast.error('Failed to undo scheduling');
              }
            }
          }
        });
        
      } catch (error) {
        console.error('Error scheduling draft:', error);
        toast.error('Failed to schedule draft');
      }
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
              {/* Left Column - Today's Focus + Draft Tray stacked with flex layout */}
              <div className="col-span-4 flex flex-col gap-6" style={{ height: 'calc(100vh - 240px - 8rem)' }}>
                {/* Today's Focus Carousel - Fixed height */}
                <div className="h-[480px] flex-shrink-0">
                  <FocusCarousel onTaskUpdate={handleTaskUpdate} />
                </div>

                {/* Draft Tray - Flexible height to fill remaining space */}
                <div className="flex-1 min-h-[200px]">
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
    </FullWidthLayout>
  );
};

export default NewDashboard;
