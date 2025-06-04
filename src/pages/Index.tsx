
import { useState, useEffect } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(true); // Temporarily set to true to bypass onboarding
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "Green Thumb Garden Center has been serving the Springfield community since 1985.",
    toneSamples: "Friendly, knowledgeable, community-focused gardening advice.",
    annualEvents: "Spring Sale (March), Mother's Day Plant Sale (May), Summer Herb Workshop Series (June-August)"
  });

  useEffect(() => {
    // Check if user has completed onboarding
    const savedData = localStorage.getItem('garden-center-onboarding');
    if (savedData) {
      setOnboardingData(JSON.parse(savedData));
      setIsOnboarded(true);
    }
  }, []);

  const handleOnboardingComplete = (data: any) => {
    localStorage.setItem('garden-center-onboarding', JSON.stringify(data));
    setOnboardingData(data);
    setIsOnboarded(true);
  };

  return (
    <div className="min-h-screen bg-garden-background">
      {!isOnboarded ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <Dashboard onboardingData={onboardingData} />
      )}
    </div>
  );
};

export default Index;
