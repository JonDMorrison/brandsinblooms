
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { LandingPage } from "@/components/LandingPage";

const Index = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showLanding, setShowLanding] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  useEffect(() => {
    if (user) {
      // Check URL params for navigation
      const params = new URLSearchParams(location.search);
      
      if (params.get('view') === 'landing') {
        setShowLanding(true);
        setIsOnboarded(false);
      } else {
        // Check if user has completed onboarding
        const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
        if (savedData) {
          // User has onboarding data, go directly to dashboard
          const parsedData = JSON.parse(savedData);
          setOnboardingData(parsedData);
          setIsOnboarded(true);
          setShowLanding(false);
        } else {
          // No onboarding data, start onboarding flow
          setShowLanding(false);
          setIsOnboarded(false);
        }
      }
    }
  }, [user, location.search]);

  const handleOnboardingComplete = (data: any) => {
    if (user) {
      // Store the data and update state immediately
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      setOnboardingData(data);
      setIsOnboarded(true);
      setShowLanding(false);
    }
  };

  const handleGetStarted = () => {
    setShowLanding(false);
  };

  if (!user) {
    return null; // This shouldn't happen due to ProtectedRoute, but just in case
  }

  return (
    <div className="min-h-screen bg-background">
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
