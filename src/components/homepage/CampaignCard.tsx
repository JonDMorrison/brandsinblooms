
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sparkles, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EditableTheme } from "@/components/calendar/EditableTheme";
import { supabase } from "@/integrations/supabase/client";
import { ContentViewer } from "@/components/content/ContentViewer";
import type { Campaign, SeasonalContent } from "@/types";

interface CampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  onCampaignUpdate?: () => void;
  seasonalContent?: SeasonalContent;
}

export const CampaignCard = ({ campaign, onTaskUpdate, onCampaignUpdate, seasonalContent }: CampaignCardProps) => {
  const { user } = useAuth();
  const [hasContent, setHasContent] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [isCheckingContent, setIsCheckingContent] = useState(true);

  useEffect(() => {
    const checkForContent = async () => {
      if (!campaign.id) return;
      
      setIsCheckingContent(true);
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('campaign_id', campaign.id)
          .limit(1);

        if (error) {
          console.error('Error checking for content:', error);
          toast.error('Failed to check content status');
          return;
        }

        setHasContent(data && data.length > 0);
      } catch (error) {
        console.error('Error in checkForContent:', error);
        toast.error('Failed to check content status');
      } finally {
        setIsCheckingContent(false);
      }
    };

    checkForContent();
  }, [campaign.id]);

  const handleViewOrGenerateContent = () => {
    setShowContentViewer(true);
  };

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  return (
    <Card className="border-primary/20 bg-white">
      <CardHeader className="bg-white">
        <div className="flex justify-between items-start">
          <CardTitle className="text-foreground">{campaign.title}</CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Week {campaign.week_number}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="bg-white">
        {campaign.theme && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <EditableTheme
              campaignId={campaign.id}
              currentTheme={campaign.theme}
              currentDescription={campaign.description || undefined}
              onThemeUpdate={handleThemeUpdate}
            />
          </div>
        )}
        
        {!campaign.theme && campaign.description && (
          <p className="text-muted-foreground mb-4">{campaign.description}</p>
        )}
        
        {seasonalContent && (
          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-2">Seasonal Focus:</h4>
            <p className="text-muted-foreground">{seasonalContent.theme}</p>
          </div>
        )}
        
        <div className="mt-6">
          {isCheckingContent ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" text="Checking content status..." />
            </div>
          ) : (
            <Button 
              onClick={handleViewOrGenerateContent}
              className="max-w-xs"
              aria-label={hasContent ? "View generated content" : "Generate new content"}
            >
              {hasContent ? (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  View This Week's Content
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Content For This Campaign
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
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
