
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { PlusCircle } from "lucide-react";

export const NoUserState = () => {
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
        <HeadlineLarge className="text-text-primary mb-2 apple-text-glow">
          Please Log In
        </HeadlineLarge>
        <BodyMedium className="text-text-secondary max-w-md mx-auto apple-color-transition">
          Log in to access your campaigns and content
        </BodyMedium>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
