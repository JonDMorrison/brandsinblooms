
import { useAuth } from "@/contexts/AuthContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useCurrentCampaignSection } from "./current-campaign/useCurrentCampaignSection";
import { NoUserState } from "./current-campaign/NoUserState";
import { NoCampaignStateCard } from "./current-campaign/NoCampaignStateCard";
import { CampaignLoadingState } from "./current-campaign/CampaignLoadingState";
import { CampaignContent } from "./current-campaign/CampaignContent";

interface CurrentCampaignSectionProps {
  activeCampaign: any;
  onTaskUpdate: () => void;
  onCreateCampaign: () => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const CurrentCampaignSection = ({
  activeCampaign,
  onTaskUpdate,
  onCreateCampaign,
  onCampaignCreated,
  onTaskClick
}: CurrentCampaignSectionProps) => {
  const { user } = useAuth();
  const {
    tasks,
    loading,
    selectedTask,
    showContentViewer,
    handleTaskClick,
    handleContentViewerClose
  } = useCurrentCampaignSection(activeCampaign);

  console.log('🔍 CurrentCampaignSection: Rendering with:', {
    hasUser: !!user,
    hasActiveCampaign: !!activeCampaign,
    activeCampaignTitle: activeCampaign?.title,
    activeCampaignId: activeCampaign?.id,
    tasksCount: tasks.length,
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
        tasks={tasks}
        onTaskClick={handleTaskClickInternal}
        onTaskUpdate={onTaskUpdate}
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
