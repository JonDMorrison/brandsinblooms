
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play } from "lucide-react";
import { CampaignContent } from "./CampaignContent";
import { WeeklyContentUpdater } from "./WeeklyContentUpdater";
import { useCurrentCampaignSection } from "./useCurrentCampaignSection";
import { useContentGeneration } from "@/contexts/ContentGenerationContext";
import { useState } from "react";

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
  const { generateContent, isGeneratingForCampaign } = useContentGeneration();
  const [lastGenerationAttempt, setLastGenerationAttempt] = useState<string | null>(null);
  
  const { 
    tasksCount, 
    loading, 
    selectedTask, 
    showContentViewer, 
    handleTaskClick,
    handleContentViewerClose
  } = useCurrentCampaignSection(activeCampaign, tasks);

  const isCurrentlyGenerating = activeCampaign ? isGeneratingForCampaign(activeCampaign.id) : false;

  const handleGenerateContent = async () => {
    if (!activeCampaign) return;
    
    setLastGenerationAttempt(activeCampaign.id);
    const success = await generateContent(
      activeCampaign.id,
      activeCampaign.theme || activeCampaign.title,
      activeCampaign.description || '',
      activeCampaign.week_number
    );
    
    if (success) {
      setTimeout(onTaskUpdate, 1000); // Refresh after generation
    }
  };

  console.log('🔍 CurrentCampaignSection: Rendering with:', {
    hasActiveCampaign: !!activeCampaign,
    activeCampaignTitle: activeCampaign?.title,
    tasksCount,
    isCurrentlyGenerating,
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
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isCurrentlyGenerating ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-sm font-medium">Generating your marketing content...</span>
              </div>
              <p className="text-blue-600 text-sm">
                This usually takes 30-60 seconds. We're creating 5 pieces of content for you to review.
              </p>
            </div>
          ) : tasksCount === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-gray-600 mb-4">
                <p className="mb-2">Ready to generate your weekly content?</p>
                <p className="text-sm text-gray-500">
                  Click below to create 5 pieces of marketing content for your review.
                </p>
              </div>
              
              <Button 
                onClick={handleGenerateContent}
                disabled={isCurrentlyGenerating}
                className="bg-garden-green hover:bg-garden-green/90"
              >
                <Play className="w-4 h-4 mr-2" />
                Generate Content
              </Button>
            </div>
          ) : (
            <CampaignContent 
              activeCampaign={activeCampaign}
              tasks={tasks}
              onTaskUpdate={onTaskUpdate}
              onTaskClick={onTaskClick || handleTaskClick}
              onRefreshContent={handleGenerateContent}
              isRefreshing={isCurrentlyGenerating}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
};
