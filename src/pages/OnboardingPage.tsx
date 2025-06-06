
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";

const OnboardingPage = () => {
  const handleOnboardingComplete = (data: any) => {
    console.log('Onboarding completed:', data);
    // You can add navigation logic here if needed
  };

  return (
    <div className="min-h-screen bg-garden-background">
      <WebsiteOnboardingFlow onComplete={handleOnboardingComplete} />
    </div>
  );
};

export default OnboardingPage;
