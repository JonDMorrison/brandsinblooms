
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";

const OnboardingPage = () => {
  const handleOnboardingComplete = (data: any) => {
    console.log('Onboarding completed:', data);
    // Store the onboarding data in localStorage for the main app to pick up
    const userId = localStorage.getItem('userId') || 'default';
    localStorage.setItem(`garden-center-onboarding-${userId}`, JSON.stringify(data));
  };

  return (
    <div className="min-h-screen bg-garden-background">
      <WebsiteOnboardingFlow onComplete={handleOnboardingComplete} />
    </div>
  );
};

export default OnboardingPage;
