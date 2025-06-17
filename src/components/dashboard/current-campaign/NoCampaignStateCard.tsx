
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, BodyMedium } from "@/components/ui/typography";
import { PlusCircle } from "lucide-react";

interface NoCampaignStateCardProps {
  onCreateCampaign: () => void;
}

export const NoCampaignStateCard = ({ onCreateCampaign }: NoCampaignStateCardProps) => {
  return (
    <EnhancedAppleCard 
      variant="default" 
      surface="secondary" 
      className="border-dashed border-2"
      hoverEffect="none"
      animated={true}
      data-campaign-section="true"
    >
      <AppleCardContent className="text-center py-12">
        <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4 apple-hover-subtle">
          <PlusCircle className="w-8 h-8 text-primary apple-icon-bounce" />
        </div>
        <HeadlineMedium className="text-text-primary mb-2 apple-text-glow">
          No Active Campaign
        </HeadlineMedium>
        <BodyMedium className="text-text-secondary max-w-md mx-auto apple-color-transition">
          Start a new campaign to generate content for this week
        </BodyMedium>
        <EnhancedAppleButton 
          variant="primary" 
          className="mt-6"
          iconAnimation="bounce"
          onClick={onCreateCampaign}
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Campaign
        </EnhancedAppleButton>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
