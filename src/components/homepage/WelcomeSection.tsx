
import { getSeasonalGreeting } from './SeasonalContent';

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
    </div>
  );
};
