
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { LandingPage } from "@/components/LandingPage";

const Index = () => {
  const { user } = useAuth();
  const [showLanding, setShowLanding] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "Green Thumb Garden Center has been serving the Springfield community since 1985.",
    toneSamples: "Friendly, knowledgeable, community-focused gardening advice.",
    annualEvents: "Spring Sale (March), Mother's Day Plant Sale (May), Summer Herb Workshop Series (June-August)"
  });

  useEffect(() => {
    if (user) {
      // Check if user has completed onboarding
      const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      if (savedData) {
        setOnboardingData(JSON.parse(savedData));
        setIsOnboarded(true);
      }
    }
  }, [user]);

  const handleOnboardingComplete = (data: any) => {
    if (user) {
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      setOnboardingData(data);
      setIsOnboarded(true);
    }
  };

  const handleGetStarted = () => {
    setShowLanding(false);
  };

  if (!user) {
    return null; // This shouldn't happen due to ProtectedRoute, but just in case
  }

  return (
    <div className="min-h-screen bg-garden-background">
      {showLanding ? (
        <LandingPage onGetStarted={handleGetStarted} />
      ) : !isOnboarded ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <Dashboard onboardingData={onboardingData} />
      )}
    </div>
  );
};

export default Index;
