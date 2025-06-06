
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { LandingPage } from "@/components/LandingPage";

const Index = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showLanding, setShowLanding] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  useEffect(() => {
    if (user) {
      // Reset onboarding state to allow fresh start
      setIsOnboarded(false);
      setOnboardingData({
        aboutBusiness: "",
        toneSamples: "",
        annualEvents: "",
        websiteUrl: ""
      });
      
      // Check URL params for dev navigation
      const params = new URLSearchParams(location.search);
      if (params.get('view') === 'landing') {
        setShowLanding(true);
      } else if (params.get('view') === 'app') {
        setShowLanding(false);
        setIsOnboarded(true); // Skip onboarding for dev purposes
      }
    }
  }, [user, location.search]);

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
        <WebsiteOnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <Dashboard onboardingData={onboardingData} />
      )}
    </div>
  );
};

export default Index;
