
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Calendar, CheckCircle } from "lucide-react";
import { generateRequiredTasks } from "@/components/homepage/TaskManagementUtils";
import { toast } from "sonner";

interface ContentGenerationControlProps {
  campaigns: any[];
  tasks: any[];
  userId?: string;
  onTaskUpdate: () => void;
}

export const ContentGenerationControl = ({ 
  campaigns, 
  tasks, 
  userId, 
  onTaskUpdate 
}: ContentGenerationControlProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const currentWeekNumber = Math.ceil(
    ((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );
  
  const currentCampaign = campaigns.find(c => c.week_number === currentWeekNumber) || campaigns[0];
  const campaignTasks = tasks.filter(task => task.campaign_id === currentCampaign?.id);
  
  const hasContent = campaignTasks.length > 0;

  const handleGenerateContent = async () => {
    if (!currentCampaign) {
      toast.error("No campaign found. Please create a campaign first.");
      return;
    }

    setIsGenerating(true);
    try {
      await generateRequiredTasks(currentCampaign.id, campaigns, userId, onTaskUpdate);
      toast.success("Content generated successfully! Review your new posts in the tasks section.");
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentCampaign) {
    return (
      <Card className="border-orange-200">
        <CardContent className="p-6 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-orange-500" />
          <h3 className="text-lg font-semibold mb-2">No Campaigns Yet</h3>
          <p className="text-gray-600 mb-4">Create your first campaign to start generating content.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasContent ? "border-green-200" : "border-blue-200"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasContent ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <Sparkles className="w-5 h-5 text-blue-600" />
          )}
          Content Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4">
          <h4 className="font-medium mb-2">Current Campaign:</h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentCampaign.title}</Badge>
            <span className="text-sm text-gray-500">Week {currentCampaign.week_number}</span>
          </div>
        </div>

        {hasContent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Content Ready</span>
            </div>
            <p className="text-sm text-gray-600">
              You have {campaignTasks.length} content pieces ready for this campaign.
            </p>
            <Button 
              onClick={handleGenerateContent}
              disabled={isGenerating}
              variant="outline"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Regenerate Content
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate personalized content for your current campaign including social posts, newsletters, and more.
            </p>
            <Button 
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Content...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
