
import { getSeasonalGreeting } from './SeasonalContent';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

interface WelcomeSectionProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onGetStarted?: () => void;
}

export const WelcomeSection = ({ onboardingData, onBusinessNameChange, onGetStarted }: WelcomeSectionProps) => {
  const seasonal = getSeasonalGreeting();
  const businessName = onboardingData?.aboutBusiness?.split('.')[0] || "Your Garden Center";

  return (
    <div className="space-y-6">
      {/* Main Welcome */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="seasonal-emoji text-3xl">{seasonal.emoji}</span>
          <h1 className="text-4xl font-bold text-black">
            Welcome back, {businessName}!
          </h1>
        </div>
        <p className="text-lg text-gray-700 mb-6">
          Your AI-powered marketing assistant is ready to help you create engaging content that grows your business.
        </p>
      </div>

      {/* Quick Start Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-black mb-1">
                  Ready to create amazing content?
                </h3>
                <p className="text-gray-600">
                  Generate a week's worth of marketing materials in just a few clicks. Perfect for social media, newsletters, and more.
                </p>
              </div>
            </div>
            {onGetStarted && (
              <Button 
                onClick={onGetStarted}
                className="bg-primary hover:bg-primary-600 text-white px-6 py-3 text-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
