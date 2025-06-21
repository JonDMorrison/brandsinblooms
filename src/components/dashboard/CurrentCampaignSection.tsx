import { useAuth } from "@/contexts/AuthContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useCurrentCampaignSection } from "./current-campaign/useCurrentCampaignSection";
import { NoUserState } from "./current-campaign/NoUserState";
import { NoCampaignStateCard } from "./current-campaign/NoCampaignStateCard";
import { CampaignLoadingState } from "./current-campaign/CampaignLoadingState";
import { CampaignContent } from "./current-campaign/CampaignContent";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

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

      toast.loading('Generating fresh content...', { id: 'refresh-content' });

      // Use the comprehensive content generation function
      const result = await generateCampaignContent(
        activeCampaign.id,
        activeCampaign.theme || activeCampaign.title,
        activeCampaign.description || '',
        user.id,
        activeCampaign.week_number,
        tenant?.id
      );

      if (result.success && result.tasks && result.tasks.length > 0) {
        toast.success(`Generated ${result.tasks.length} fresh content pieces!`, { id: 'refresh-content' });
        onTaskUpdate(); // Refresh the task list
      } else {
        toast.error(`Failed to generate content: ${result.message || 'Unknown error'}`, { id: 'refresh-content' });
      }
    } catch (error) {
      console.error('Error refreshing content:', error);
      toast.error('Failed to refresh content', { id: 'refresh-content' });
    } finally {
      setRefreshing(false);
    }
  };

  console.log('🔍 CurrentCampaignSection: Rendering with:', {
    hasUser: !!user,
    hasActiveCampaign: !!activeCampaign,
    activeCampaignTitle: activeCampaign?.title,
    activeCampaignId: activeCampaign?.id,
    tasksCount,
    loading
  });

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

  // Early return if no authenticated user
  if (!user) {
    console.log('🔍 CurrentCampaignSection: No user, showing NoUserState');
    return <NoUserState />;
  }

  // Check for active campaign more carefully
  if (!activeCampaign || !activeCampaign.id) {
    console.log('🔍 CurrentCampaignSection: No active campaign, showing NoCampaignStateCard');
    return <NoCampaignStateCard onCreateCampaign={onCreateCampaign} />;
  }

  if (loading) {
    console.log('🔍 CurrentCampaignSection: Loading tasks, showing CampaignLoadingState');
    return <CampaignLoadingState />;
  }

  console.log('🔍 CurrentCampaignSection: Showing CampaignContent with campaign:', activeCampaign.title);

  return (
    <>
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
    </>
  );
};
