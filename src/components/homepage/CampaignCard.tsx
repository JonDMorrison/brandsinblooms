
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sparkles, Eye, Leaf, Droplets, Sun, Snowflake, Crown } from "lucide-react";
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

  const getSeasonalIcon = () => {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      return { icon: Leaf, color: "text-green-600", season: "Spring" };
    } else if (month >= 6 && month <= 8) {
      return { icon: Sun, color: "text-yellow-600", season: "Summer" };
    } else if (month >= 9 && month <= 11) {
      return { icon: Droplets, color: "text-orange-600", season: "Fall" };
    } else {
      return { icon: Snowflake, color: "text-blue-600", season: "Winter" };
    }
  };

  const getSourceIcon = () => {
    switch (campaign.source) {
      case 'master_templates':
        return { icon: Crown, label: "Curated Theme", color: "text-purple-600" };
      case 'seasonal_garden_themes':
        return { icon: Leaf, label: "Seasonal Focus", color: "text-green-600" };
      default:
        return { icon: Leaf, label: "Garden Theme", color: "text-gray-600" };
    }
  };

  const seasonalInfo = getSeasonalIcon();
  const sourceInfo = getSourceIcon();
  const SeasonIcon = seasonalInfo.icon;
  const SourceIcon = sourceInfo.icon;

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
    <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-primary/10 border-gray-200">
      <CardHeader className="bg-white/80 backdrop-blur-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            <SeasonIcon className={`w-5 h-5 ${seasonalInfo.color}`} />
            <CardTitle className="text-foreground text-xl">
              {seasonalInfo.season} Theme: {campaign.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <SourceIcon className={`w-3 h-3 mr-1 ${sourceInfo.color}`} />
              {sourceInfo.label}
            </Badge>
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
              Week {campaign.week_number}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-white/80 backdrop-blur-sm">
        {campaign.theme && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-primary/20">
            <EditableTheme
              campaignId={campaign.id}
              currentTheme={campaign.theme}
              currentDescription={campaign.description || undefined}
              onThemeUpdate={handleThemeUpdate}
              hideLabel={true}
            />
          </div>
        )}
        
        {!campaign.theme && campaign.description && (
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20 mb-4">
            <p className="text-sm leading-relaxed text-gray-700">
              {campaign.description}
            </p>
          </div>
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

        <div className="text-xs text-gray-600 bg-white/60 p-2 rounded border border-gray-200 mt-4">
          🌱 Professional garden center content designed for {seasonalInfo.season.toLowerCase()} season
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
