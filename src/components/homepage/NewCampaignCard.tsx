
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "./TaskManagementUtils";
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
    if (!user) {
      toast.error("Please log in to generate content");
      return;
    }

    setIsGenerating(true);
    try {
      await generateRequiredTasks(campaign.id, [campaign], user.id, onTaskUpdate);
      toast.success("Content generated successfully! Check your tasks to review and approve the new content.");
      if (onCampaignUpdate) {
        onCampaignUpdate();
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error("Unable to generate content at this time.");
    } finally {
      setIsGenerating(false);
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
