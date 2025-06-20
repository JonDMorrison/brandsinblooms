
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignContent } from "./CampaignContent";
import { WeeklyContentUpdater } from "./WeeklyContentUpdater";
import { ManualContentGenerator } from "@/components/content/ManualContentGenerator";
import { useCurrentCampaignSection } from "./useCurrentCampaignSection";

interface CurrentCampaignSectionProps {
  activeCampaign: any;
  tasks: any[];
  onTaskUpdate: () => void;
  onTaskClick?: (task: any) => void;
}

export const CurrentCampaignSection = ({ 
  activeCampaign, 
  tasks, 
  onTaskUpdate,
  onTaskClick 
}: CurrentCampaignSectionProps) => {
  const { 
    tasksCount, 
    loading, 
    selectedTask, 
    showContentViewer, 
    isDevelopment, 
    usesTenantModel,
    handleTaskClick,
    handleContentViewerClose
  } = useCurrentCampaignSection(activeCampaign, tasks);

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
    <>
      <WeeklyContentUpdater />
      
      <Card>
        <CardHeader>
          <CardTitle>Your Weekly Content</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each week we create five pieces of content. This week we are talking about{' '}
            <span className="font-medium">{activeCampaign.theme || activeCampaign.title}</span>.
          </p>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-garden-green">{tasksCount}/5</span> content pieces ready for review
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Campaign: {activeCampaign.title} (ID: {activeCampaign.id.substring(0, 8)}...)
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {tasksCount === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium">Generating your marketing content...</span>
                </div>
                <p className="text-gray-600 text-sm">
                  This usually takes 30-60 seconds. We're creating 5 pieces of content for you to review.
                </p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Content generation taking too long?</h4>
                <ManualContentGenerator 
                  campaign={activeCampaign}
                  onContentGenerated={onTaskUpdate}
                />
              </div>
            </div>
          ) : (
            <CampaignContent 
              activeCampaign={activeCampaign}
              tasks={tasks}
              onTaskUpdate={onTaskUpdate}
              onTaskClick={onTaskClick || handleTaskClick}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
};
