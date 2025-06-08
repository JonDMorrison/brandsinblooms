
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Calendar, CheckCircle, ArrowRight } from "lucide-react";
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
      toast.success("🎉 Amazing! Your content is ready to review and customize.", {
        duration: 4000
      });
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
          <h3 className="text-lg font-semibold mb-2">Ready to Start Creating?</h3>
          <p className="text-gray-600 mb-4">Create your first campaign to unlock AI-powered content generation.</p>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            Start with Quick Actions above
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasContent ? "border-green-200 bg-green-50/30" : "border-primary/30 bg-primary/5"}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasContent ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
            <span>AI Content Generation</span>
          </div>
          <Badge variant={hasContent ? "default" : "outline"} className={hasContent ? "bg-green-100 text-green-800" : ""}>
            {hasContent ? "Content Ready" : "Ready to Generate"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Current Campaign:</h4>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-white">{currentCampaign.title}</Badge>
            <span className="text-sm text-gray-500">Week {currentCampaign.week_number}</span>
          </div>
        </div>

        {hasContent ? (
          <div className="space-y-3">
            <div className="bg-white/60 backdrop-blur p-3 rounded-lg border">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">Content Generated Successfully!</span>
              </div>
              <p className="text-sm text-gray-700 mb-2">
                You have {campaignTasks.length} personalized content pieces ready for review.
              </p>
              <div className="text-xs text-gray-600">
                ✓ Instagram Posts ✓ Facebook Updates ✓ Email Content ✓ Video Scripts ✓ Newsletters
              </div>
            </div>
            <Button 
              onClick={handleGenerateContent}
              disabled={isGenerating}
              variant="outline"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Regenerating Fresh Content...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Fresh Content
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur p-4 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">What you'll get:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <div>✨ Instagram posts</div>
                <div>📧 Email newsletters</div>
                <div>📘 Facebook updates</div>
                <div>🎥 Video scripts</div>
                <div>📝 Blog content</div>
                <div>📱 Social media captions</div>
              </div>
              <p className="text-xs text-gray-600 mt-3 font-medium">
                All personalized to your garden center's brand and voice!
              </p>
            </div>
            <Button 
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="w-full bg-primary hover:bg-primary-600 text-white"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Your Content...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate My Content Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            {!isGenerating && (
              <p className="text-xs text-center text-gray-500">
                Takes about 30 seconds • Creates 5+ content pieces
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
