
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "./TaskManagementUtils";
import { toast } from "sonner";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface SeasonalContent {
  theme: string;
  posts: {
    type: string;
    content: string;
    hashtags: string;
    imageIdea: string;
  }[];
}

interface CampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  seasonalContent?: SeasonalContent;
}

export const CampaignCard = ({ campaign, onTaskUpdate, seasonalContent }: CampaignCardProps) => {
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
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-garden-green-light">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-garden-green-dark">{campaign.title}</CardTitle>
          <Badge variant="secondary" className="bg-garden-green-light text-garden-green-dark">
            Week {campaign.week_number}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {campaign.description && (
          <p className="text-garden-green mb-4">{campaign.description}</p>
        )}
        {campaign.theme && (
          <div className="mb-4">
            <h4 className="font-semibold text-garden-green-dark mb-2">Theme:</h4>
            <p className="text-garden-green">{campaign.theme}</p>
          </div>
        )}
        {seasonalContent && (
          <div className="mb-4">
            <h4 className="font-semibold text-garden-green-dark mb-2">Seasonal Focus:</h4>
            <p className="text-garden-green">{seasonalContent.theme}</p>
          </div>
        )}
        
        <div className="mt-6">
          <Button 
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="w-full bg-garden-green hover:bg-garden-green-dark text-white"
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
          <p className="text-xs text-gray-500 mt-2 text-center">
            Creates social media posts, video scripts, newsletter, and email content
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
