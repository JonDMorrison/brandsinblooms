
import { useState, useEffect } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null);

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {!isOnboarded ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <Dashboard onboardingData={onboardingData} />
      )}
    </div>
  );
};

export default Index;
