
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { TaskItem } from "./TaskItem";
import { ManualContentGenerator } from "@/components/content/ManualContentGenerator";

interface CampaignContentProps {
  activeCampaign: any;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTaskUpdate: () => void;
  onRefreshContent: () => void;
  isRefreshing: boolean;
}

export const CampaignContent = ({
  activeCampaign,
  tasks,
  onTaskClick,
  onTaskUpdate,
  onRefreshContent,
  isRefreshing
}: CampaignContentProps) => {
  // Filter tasks for the current campaign
  const campaignTasks = tasks.filter(task => task.campaign_id === activeCampaign?.id);
  
  // Count tasks with actual content (not generating or empty)
  const tasksWithContent = campaignTasks.filter(task => 
    task.ai_output && 
    task.ai_output.trim() !== '' && 
    task.status !== 'generating'
  );

  // Check if any tasks are actually generating (not stuck)
  const isActuallyGenerating = campaignTasks.some(task => 
    task.status === 'generating' && 
    task.created_at && 
    (new Date().getTime() - new Date(task.created_at).getTime()) < 120000 // Less than 2 minutes old
  );

  const isEmpty = tasksWithContent.length === 0 && !isActuallyGenerating;

  return (
    <Card className={`weekly-card ${isEmpty ? 'weekly-card--empty' : ''}`}>
      <CardHeader className="relative">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Your Weekly Content</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              This week we are talking about{' '}
              <span className="font-medium">{activeCampaign.theme || activeCampaign.title}</span>
            </p>
            <div className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-garden-green">{tasksWithContent.length}/5</span> content pieces ready for review
            </div>
          </div>
          
          <Button
            onClick={onRefreshContent}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="weekly-card__refresh shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh All'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {isActuallyGenerating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm font-medium">Generating your marketing content...</span>
            </div>
            <p className="text-blue-600 text-sm mt-1">
              This usually takes 30-60 seconds. We're creating content for you to review.
            </p>
          </div>
        )}

        {tasksWithContent.length === 0 && !isActuallyGenerating ? (
          <div className="empty-state space-y-4">
            <div className="text-center py-4">
              <div className="text-gray-600 mb-4">
                <p className="mb-2">No content generated yet for this campaign.</p>
                <p className="text-sm text-gray-500">
                  Generate content to start reviewing and approving your marketing materials.
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Generate Content
                </h4>
                <Button
                  size="sm"
                  variant="secondary"
                  className="generate-manual-btn"
                  onClick={() => {
                    // This will be handled by ManualContentGenerator
                  }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Generate Manually
                </Button>
              </div>
              <ManualContentGenerator 
                campaign={activeCampaign}
                onContentGenerated={onTaskUpdate}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {tasksWithContent.length > 0 && (
              <div className="space-y-3">
                {campaignTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onTaskUpdate={onTaskUpdate}
                  />
                ))}
              </div>
            )}
            
            {tasksWithContent.length > 0 && tasksWithContent.length < 5 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Need more content?</h4>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="generate-manual-btn"
                    onClick={() => {
                      // This will be handled by ManualContentGenerator
                    }}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Generate Manually
                  </Button>
                </div>
                <ManualContentGenerator 
                  campaign={activeCampaign}
                  onContentGenerated={onTaskUpdate}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
