
import { EnhancedAppleCard } from "@/components/ui-legacy/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui-legacy/apple-card";
import { LoadingSpinner } from "@/components/ui-legacy/loading-spinner";

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
        <LoadingSpinner 
          size="lg" 
          color="primary"
          text="Loading campaign content..."
        />
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
