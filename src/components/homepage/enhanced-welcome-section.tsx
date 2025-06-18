
import * as React from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { SeasonalIndicator } from "@/components/ui/premium-icons";
import { CelebrationEffect } from "@/components/ui/celebration-effect";
import { cn } from "@/lib/utils";

interface EnhancedWelcomeSectionProps {
  onboardingData: any;
  onBusinessNameChange: (name: string) => void;
  showCelebration?: boolean;
  className?: string;
}

export const EnhancedWelcomeSection = ({
  onboardingData,
  onBusinessNameChange,
  showCelebration = false,
  className
}: EnhancedWelcomeSectionProps) => {
  const [celebrationVisible, setCelebrationVisible] = React.useState(showCelebration);

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      surface="primary"
      className={cn('apple-warm-neutral', className)}
      hoverEffect="none"
      animated={true}
    >
      <AppleCardContent className="apple-section-spacing">
        <div className="flex items-center gap-4 mb-6">
          <SeasonalIndicator />
          <div>
            <HeadlineLarge className="apple-headline-large">
              Welcome to BloomSuite
            </HeadlineLarge>
            <BodyMedium className="apple-body-enhanced mt-2">
              Your AI-powered garden center marketing assistant
            </BodyMedium>
          </div>
        </div>

        {celebrationVisible && (
          <CelebrationEffect
            isVisible={celebrationVisible}
            onComplete={() => setCelebrationVisible(false)}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="apple-hover-premium rounded-lg p-4 bg-white border border-gray-100">
            <BodyMedium className="apple-body-enhanced font-medium mb-2">
              🌱 Smart Content Generation
            </BodyMedium>
            <BodyMedium className="apple-caption-enhanced">
              AI creates professional marketing content tailored to your garden center
            </BodyMedium>
          </div>

          <div className="apple-hover-premium rounded-lg p-4 bg-white border border-gray-100">
            <BodyMedium className="apple-body-enhanced font-medium mb-2">
              📅 Seasonal Planning
            </BodyMedium>
            <BodyMedium className="apple-caption-enhanced">
              Year-round campaigns aligned with gardening seasons and trends
            </BodyMedium>
          </div>

          <div className="apple-hover-premium rounded-lg p-4 bg-white border border-gray-100 sm:col-span-2 lg:col-span-1">
            <BodyMedium className="apple-body-enhanced font-medium mb-2">
              🚀 Multi-Platform Ready
            </BodyMedium>
            <BodyMedium className="apple-caption-enhanced">
              Content optimized for social media, email, and newsletters
            </BodyMedium>
          </div>
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
