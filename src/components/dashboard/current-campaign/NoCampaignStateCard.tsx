
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoCampaignStateCardProps {
  onCreateCampaign: () => void;
}

export const NoCampaignStateCard = ({ onCreateCampaign }: NoCampaignStateCardProps) => {
  console.log('🚨 NoCampaignStateCard: Rendering - this should not show if we have an active campaign');
  
  return (
    <EnhancedAppleCard 
      variant="default" 
      surface="primary"
      className="mx-auto max-w-2xl"
      animated={true}
    >
      <AppleCardContent className="text-center py-12">
        <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-6">
          <Calendar className="w-8 h-8 text-primary" />
        </div>
        
        <HeadlineLarge className="text-text-primary mb-3">
          No Active Campaign
        </HeadlineLarge>
        
        <BodyMedium className="text-text-secondary mb-6 max-w-md mx-auto">
          Start a new campaign to generate content for this week
        </BodyMedium>
        
        <Button 
          onClick={onCreateCampaign}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
