
import { useState } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Sparkles, Eye, Leaf, Droplets, Sun, Snowflake } from "lucide-react";
import { ContentViewer } from "@/components/content/ContentViewer";
import { EditableTheme } from "@/components/calendar/EditableTheme";
import type { Campaign, SeasonalContent } from "@/types";

interface EnhancedCampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  onCampaignUpdate?: () => void;
  seasonalContent?: SeasonalContent;
  hasContent?: boolean;
  isLoading?: boolean;
  staggerDelay?: number;
}

export const EnhancedCampaignCard = ({ 
  campaign, 
  onTaskUpdate, 
  onCampaignUpdate, 
  seasonalContent,
  hasContent = false,
  isLoading = false,
  staggerDelay = 0
}: EnhancedCampaignCardProps) => {
  const [showContentViewer, setShowContentViewer] = useState(false);

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

  const seasonalInfo = getSeasonalIcon();
  const SeasonIcon = seasonalInfo.icon;

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      surface="primary" 
      className="border-l-4 border-l-primary overflow-hidden"
      hoverEffect="medium"
      animated={true}
      staggerDelay={staggerDelay}
    >
      <AppleCardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl apple-hover-subtle">
            <SeasonIcon className={`w-5 h-5 ${seasonalInfo.color} transition-transform duration-200 hover:scale-110`} />
          </div>
          <div className="flex-1">
            <HeadlineMedium className="text-text-primary apple-text-glow">
              {seasonalInfo.season} Theme: {campaign.title}
            </HeadlineMedium>
            <CaptionMedium className="text-text-secondary mt-1 apple-color-transition">
              Professional content for your garden center
            </CaptionMedium>
          </div>
        </div>
      </AppleCardHeader>
      
      <AppleCardContent className="space-y-6">
        {campaign.theme && (
          <div className="p-4 bg-surface-secondary rounded-lg border border-border apple-hover-subtle">
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
          <div className="p-4 bg-surface-secondary rounded-lg border border-border apple-hover-subtle">
            <BodyMedium className="text-text-secondary leading-relaxed">
              {campaign.description}
            </BodyMedium>
          </div>
        )}
        
        {seasonalContent && (
          <div className="space-y-2 apple-slide-up">
            <CaptionMedium className="font-medium text-text-primary">Seasonal Focus:</CaptionMedium>
            <BodyMedium className="text-text-secondary">{seasonalContent.theme}</BodyMedium>
          </div>
        )}
        
        <div className="space-y-3">
          <EnhancedAppleButton 
            variant={hasContent ? "secondary" : "primary"}
            onClick={() => setShowContentViewer(true)}
            className="w-full"
            loading={isLoading}
            iconAnimation="bounce"
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
          </EnhancedAppleButton>
          
          <CaptionMedium className="text-text-tertiary text-center apple-color-transition">
            {hasContent 
              ? "Review your generated content and publish when ready"
              : "Creates social media posts, video scripts, newsletter, and email content"
            }
          </CaptionMedium>
        </div>

        <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20 apple-hover-subtle">
          <CaptionMedium className="text-primary apple-color-transition">
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
    </EnhancedAppleCard>
  );
};
