
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "./RequiredTasksGenerator";
import { toast } from "sonner";
import { EditableTheme } from "@/components/calendar/EditableTheme";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface NewCampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  onCampaignUpdate?: () => void;
}

export const NewCampaignCard = ({ campaign, onTaskUpdate, onCampaignUpdate }: NewCampaignCardProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateContent = async () => {
    console.log('=== CONTENT GENERATION DEBUG START ===');
    console.log('Generate content button clicked for campaign:', campaign.id);
    console.log('Campaign object:', campaign);
    console.log('User object:', user);
    console.log('onTaskUpdate function:', typeof onTaskUpdate);
    
    if (!user) {
      console.error('No user found when trying to generate content');
      toast.error("Please log in to generate content");
      return;
    }

    console.log('Starting content generation for user:', user.id);
    setIsGenerating(true);
    
    try {
      console.log('About to call generateRequiredTasks with parameters:', {
        campaignId: campaign.id,
        campaigns: [campaign],
        userId: user.id,
        onTaskUpdateType: typeof onTaskUpdate
      });
      
      console.log('Calling generateRequiredTasks function...');
      const result = await generateRequiredTasks(campaign.id, [campaign], user.id, onTaskUpdate);
      console.log('generateRequiredTasks returned:', result);
      
      console.log('Content generation completed successfully');
      toast.success("Content generated successfully! Check your tasks to review and approve the new content.");
      
      if (onCampaignUpdate) {
        console.log('Calling onCampaignUpdate callback');
        onCampaignUpdate();
      }
    } catch (error) {
      console.error('=== ERROR IN CONTENT GENERATION ===');
      console.error('Error object:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast.error(`Unable to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('Setting isGenerating to false');
      setIsGenerating(false);
      console.log('=== CONTENT GENERATION DEBUG END ===');
    }
  };

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-foreground">{campaign.title}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              New Campaign
            </Badge>
            <Badge variant="outline" className="border-blue-300 text-blue-600">
              <Calendar className="w-3 h-3 mr-1" />
              Week {campaign.week_number}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {campaign.theme && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-blue-200">
            <EditableTheme
              campaignId={campaign.id}
              currentTheme={campaign.theme}
              currentDescription={campaign.description || undefined}
              onThemeUpdate={handleThemeUpdate}
            />
          </div>
        )}
        
        {!campaign.theme && campaign.description && (
          <p className="text-blue-600 mb-4">{campaign.description}</p>
        )}
        
        <div className="mt-6">
          <Button 
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content for This Campaign
              </>
            )}
          </Button>
          <p className="text-xs text-blue-600 mt-2 text-center">
            Creates social media posts, video scripts, newsletter, and email content
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
