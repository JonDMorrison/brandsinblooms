import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignContent } from "./current-campaign/CampaignContent";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
import { WeeklyContentExplanation } from "./current-campaign/WeeklyContentExplanation";
import { ManualContentGenerator } from "@/components/content/ManualContentGenerator";
import { useCurrentCampaignSection } from "./current-campaign/useCurrentCampaignSection";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement
import { useState } from "react";
import { WeeklyContentBanner } from "./current-campaign/WeeklyContentBanner";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { ContentViewer } from "@/components/content/ContentViewer";

interface CurrentCampaignSectionProps {
  activeCampaign: any;
  tasks: any[];
  onTaskUpdate: () => void;
  onCreateCampaign: () => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const CurrentCampaignSection = ({
  activeCampaign,
  tasks,
  onTaskUpdate,
  onCreateCampaign,
  onCampaignCreated,
  onTaskClick
}: CurrentCampaignSectionProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [refreshing, setRefreshing] = useState(false);
  
  const { 
    tasks: hookTasks,
    tasksCount, 
    loading, 
    selectedTask, 
    showContentViewer, 
    isDevelopment, 
    usesTenantModel,
    handleTaskClick,
    handleContentViewerClose
  } = useCurrentCampaignSection(activeCampaign, tasks);

  // AI image generation disabled - images are now manual-only via sidebar
  // useAutoImageGeneration(tasks);

  const showWeeklyBanner = activeCampaign && (
    sessionStorage.getItem('oauth_just_completed') === 'true' || 
    tasks.some(task => task.status === 'review')
  );

  const handleReviewApprove = () => {
    // Scroll to review section or open review modal
    const firstReviewTask = tasks.find(task => task.status === 'review');
    if (firstReviewTask && onTaskClick) {
      onTaskClick(firstReviewTask);
    }
  };

  const handleRefreshContent = async () => {
    if (!activeCampaign || !user) {
      toast.error('Unable to refresh content at this time');
      return;
    }

    setRefreshing(true);
    
    try {
      // Delete existing tasks for this campaign
      const { error: deleteError } = await supabase
        .from('content_tasks')
        .delete()
        .eq('campaign_id', activeCampaign.id);

      if (deleteError) {
        console.error('Error deleting existing tasks:', deleteError);
        toast.error('Failed to clear existing content');
        return;
      }

      toast.loading('Generating fresh content...');

      // Generate new content
      const result = await generateCampaignContent(
        activeCampaign.id,
        activeCampaign.theme || activeCampaign.title,
        activeCampaign.description || '',
        user.id,
        activeCampaign.week_number,
        tenant?.id
      );

      if (result.success) {
        toast.success(`Generated ${result.tasks?.length || 0} fresh content pieces!`);
        onTaskUpdate(); // Refresh the task list
      } else {
        toast.error(`Failed to refresh content: ${result.message}`);
      }
    } catch (error) {
      console.error('Error refreshing content:', error);
      toast.error('Failed to refresh content');
    } finally {
      setRefreshing(false);
    }
  };

  const handleTaskClickInternal = (task: any) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      handleTaskClick(task);
    }
  };

  const handleContentViewerCloseInternal = () => {
    handleContentViewerClose();
    if (onTaskUpdate) {
      onTaskUpdate();
    }
  };

  console.log('🔍 CurrentCampaignSection: Rendering with:', {
    hasUser: !!activeCampaign,
    hasActiveCampaign: !!activeCampaign,
    activeCampaignTitle: activeCampaign?.title,
    activeCampaignId: activeCampaign?.id,
    tasksCount,
    loading
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Weekly Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-garden-green border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your campaign content...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeCampaign) {
    console.log('🔍 CurrentCampaignSection: No active campaign available');
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Weekly Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No active campaign found for this week.</p>
            <p className="text-sm text-gray-500">
              Create a new campaign to start generating content.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  console.log('🔍 CurrentCampaignSection: Showing CampaignContent with campaign:', activeCampaign.title);

  return (
    <div data-section="weekly-content-section">
      <WeeklyContentUpdater />
      
      {/* Weekly Content Banner */}
      {showWeeklyBanner && activeCampaign && (
        <WeeklyContentBanner
          currentTheme={activeCampaign.theme || activeCampaign.title || 'Seasonal Content'}
          weekNumber={activeCampaign.week_number || getCurrentWeekNumber()}
          onReviewApprove={handleReviewApprove}
          showCallout={sessionStorage.getItem('oauth_just_completed') === 'true'}
        />
      )}
      
      <CampaignContent
        activeCampaign={activeCampaign}
        tasks={hookTasks}
        onTaskClick={handleTaskClickInternal}
        onTaskUpdate={onTaskUpdate}
        onRefreshContent={handleRefreshContent}
        isRefreshing={refreshing}
      />

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id}
          campaignTitle={activeCampaign?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerCloseInternal}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </div>
  );
};
