import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "./TaskManagementUtils";
import { toast } from "sonner";
import { EditableTheme } from "@/components/calendar/EditableTheme";
import { supabase } from "@/integrations/supabase/client";
import { ContentViewer } from "@/components/content/ContentViewer";

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
  onCampaignUpdate?: () => void;
  seasonalContent?: SeasonalContent;
}

export const CampaignCard = ({ campaign, onTaskUpdate, onCampaignUpdate, seasonalContent }: CampaignCardProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);

  useEffect(() => {
    const checkForContent = async () => {
      if (!campaign.id) return;
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select('id')
        .eq('campaign_id', campaign.id)
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasContent(true);
      } else {
        setHasContent(false);
      }
    };

    checkForContent();
  }, [campaign.id]);

  const handleGenerateContent = async () => {
    if (!user) {
      toast.error("Please log in to generate content");
      return;
    }

    setIsGenerating(true);
    try {
      await generateRequiredTasks(campaign.id, [campaign], user.id, onTaskUpdate);
      toast.success("Content generated successfully! Check your tasks to review and approve the new content.");
      setHasContent(true);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewContent = () => {
    setShowContentViewer(true);
  };

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    // Trigger a refresh of the campaign data
    if (onCampaignUpdate) {
      onCampaignUpdate();
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
        {campaign.theme && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <EditableTheme
              campaignId={campaign.id}
              currentTheme={campaign.theme}
              currentDescription={campaign.description || undefined}
              onThemeUpdate={handleThemeUpdate}
            />
          </div>
        )}
        
        {!campaign.theme && campaign.description && (
          <p className="text-garden-green mb-4">{campaign.description}</p>
        )}
        
        {seasonalContent && (
          <div className="mb-4">
            <h4 className="font-semibold text-garden-green-dark mb-2">Seasonal Focus:</h4>
            <p className="text-garden-green">{seasonalContent.theme}</p>
          </div>
        )}
        
        <div className="mt-6">
          <Button 
            onClick={hasContent ? handleViewContent : handleGenerateContent}
            disabled={isGenerating}
            className="w-full bg-garden-green hover:bg-garden-green-dark text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Content...
              </>
            ) : hasContent ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                View This Week's Content
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {hasContent 
              ? "Review your generated content in the tasks section"
              : "Creates social media posts, video scripts, newsletter, and email content"
            }
          </p>
        </div>
      </CardContent>

      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </Card>
  );
};
