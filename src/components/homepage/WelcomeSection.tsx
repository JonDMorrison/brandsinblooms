
import { getSeasonalGreeting } from './SeasonalContent';

interface WelcomeSectionProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onGetStarted?: () => void;
}

export const WelcomeSection = ({ onboardingData, onBusinessNameChange, onGetStarted }: WelcomeSectionProps) => {
  const seasonal = getSeasonalGreeting();
  
  // Extract business name from onboarding data with better fallback logic
  let businessName = "Your Garden Center";
  
  if (onboardingData?.aboutBusiness) {
    // Try to extract business name from the beginning of the aboutBusiness text
    const aboutText = onboardingData.aboutBusiness;
    const firstSentence = aboutText.split('.')[0];
    
    // Look for patterns like "Business Name has been serving" or "Business Name is a"
    const nameMatch = firstSentence.match(/^([^,]+?)(?:\s+(?:has been|is|provides|offers|specializes))/);
    if (nameMatch) {
      businessName = nameMatch[1].trim();
    } else if (firstSentence.length < 50) {
      // If it's a short sentence, use it as the business name
      businessName = firstSentence.trim();
    }
  }

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
