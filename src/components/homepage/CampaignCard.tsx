
import { AppleCard, AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { AppleButton } from "@/components/ui/apple-button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
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
    <AppleCard variant="elevated" surface="primary" className="border-l-4 border-l-primary">
      <AppleCardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl">
            <SeasonIcon className={`w-5 h-5 ${seasonalInfo.color}`} />
          </div>
          <div className="flex-1">
            <HeadlineMedium className="text-text-primary">
              {seasonalInfo.season} Theme: {campaign.title}
            </HeadlineMedium>
            <CaptionMedium className="text-text-secondary mt-1">
              Professional content for your garden center
            </CaptionMedium>
          </div>
        </div>
      </AppleCardHeader>
      
      <AppleCardContent className="space-y-6">
        {campaign.theme && (
          <div className="p-4 bg-surface-secondary rounded-lg border border-border">
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
          <div className="p-4 bg-surface-secondary rounded-lg border border-border">
            <BodyMedium className="text-text-secondary leading-relaxed">
              {campaign.description}
            </BodyMedium>
          </div>
        )}
        
        {seasonalContent && (
          <div className="space-y-2">
            <CaptionMedium className="font-medium text-text-primary">Seasonal Focus:</CaptionMedium>
            <BodyMedium className="text-text-secondary">{seasonalContent.theme}</BodyMedium>
          </div>
        )}
        
        <div className="space-y-3">
          {isCheckingContent ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
              <CaptionMedium className="text-text-secondary ml-3">
                Checking content status...
              </CaptionMedium>
            </div>
          ) : (
            <>
              <AppleButton 
                variant={hasContent ? "secondary" : "primary"}
                onClick={handleViewOrGenerateContent}
                className="w-full"
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
              </AppleButton>
              
              <CaptionMedium className="text-text-tertiary text-center">
                {hasContent 
                  ? "Review your generated content and publish when ready"
                  : "Creates social media posts, video scripts, newsletter, and email content"
                }
              </CaptionMedium>
            </>
          )}
        </div>

        <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
          <CaptionMedium className="text-primary">
            🌱 Professional garden center content designed for {seasonalInfo.season.toLowerCase()} season
          </CaptionMedium>
        </div>
      </AppleCardContent>

      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </AppleCard>
  );
};
