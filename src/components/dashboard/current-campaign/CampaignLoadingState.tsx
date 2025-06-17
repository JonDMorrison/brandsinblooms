
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { BodyMedium } from "@/components/ui/typography";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const CampaignLoadingState = () => {
  return (
    <EnhancedAppleCard 
      variant="default" 
      surface="primary" 
      className="mx-auto max-w-md"
      animated={true}
      data-campaign-section="true"
    >
      <AppleCardContent className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <BodyMedium className="text-text-secondary mt-4">
          Loading campaign content...
        </BodyMedium>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
