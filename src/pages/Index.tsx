
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
      // Check URL params for navigation
      const params = new URLSearchParams(location.search);
      
      if (params.get('view') === 'landing') {
        setShowLanding(true);
        setIsOnboarded(false);
      } else if (params.get('view') === 'app') {
        // Check if user has completed onboarding
        const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
        if (savedData) {
          // User has onboarding data, go straight to dashboard
          const parsedData = JSON.parse(savedData);
          setOnboardingData(parsedData);
          setIsOnboarded(true);
          setShowLanding(false);
        } else {
          // No onboarding data, stay in onboarding flow
          setShowLanding(false);
          setIsOnboarded(false);
        }
      } else {
        // Default behavior - check if user has completed onboarding
        const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setOnboardingData(parsedData);
          setIsOnboarded(true);
          setShowLanding(false);
        } else {
          // No saved data, start fresh
          setShowLanding(true);
          setIsOnboarded(false);
        }
      }
    }
  }, [user, location.search]);

  const handleOnboardingComplete = (data: any) => {
    if (user) {
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
