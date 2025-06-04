
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { LandingPage } from "@/components/LandingPage";

const Index = () => {
  const { user } = useAuth();
  const [showLanding, setShowLanding] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: ""
  });

  useEffect(() => {
    if (user) {
      // Reset onboarding state to allow fresh start
      setIsOnboarded(false);
      setOnboardingData({
        aboutBusiness: "",
        toneSamples: "",
        annualEvents: ""
      });
      // Don't automatically hide landing page when user logs in
      // Let them click "Get Started" to proceed
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
