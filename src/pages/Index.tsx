import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LandingPage } from "@/components/LandingPage";

const Index = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showLanding, setShowLanding] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [currentView, setCurrentView] = useState<"home" | "calendar" | "team" | "profile">("home");
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  const checkOnboardingStatus = async (userId: string) => {
    try {
      // First check localStorage
      const savedData = localStorage.getItem(`garden-center-onboarding-${userId}`);
      
      if (savedData) {
        console.log('Index: Found onboarding data in localStorage');
        const parsedData = JSON.parse(savedData);
        setOnboardingData(parsedData);
        setIsOnboarded(true);
        return;
      }

      // If not in localStorage, check the database
      console.log('Index: No localStorage data, checking database');
      const { data: dbOnboardingData, error } = await supabase
        .from('onboarding_responses')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching onboarding data:', error);
        return;
      }

      if (dbOnboardingData) {
        console.log('Index: Found onboarding data in database, syncing to localStorage');
        const syncedData = {
          aboutBusiness: dbOnboardingData.about_business || "",
          toneSamples: dbOnboardingData.tone_samples || "",
          annualEvents: dbOnboardingData.annual_events || "",
          websiteUrl: "" // This might not be in the database, could be added later
        };
        
        // Sync to localStorage for faster future access
        localStorage.setItem(`garden-center-onboarding-${userId}`, JSON.stringify(syncedData));
        setOnboardingData(syncedData);
        setIsOnboarded(true);
      } else {
        console.log('Index: No onboarding data found in database either');
        setIsOnboarded(false);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboarded(false);
    } finally {
      setIsCheckingOnboarding(false);
    }
  };

  useEffect(() => {
    console.log('Index: Auth state changed, user:', user?.id);
    console.log('Index: Current pathname:', location.pathname);
    console.log('Index: Current search params:', location.search);
    
    if (user) {
      setIsCheckingOnboarding(true);
      
      // Check URL params for navigation - only show landing if explicitly requested
      const params = new URLSearchParams(location.search);
      
      if (params.get('view') === 'landing') {
        console.log('Index: Showing landing page due to URL param');
        setShowLanding(true);
        setIsOnboarded(false);
        setIsCheckingOnboarding(false);
      } else {
        // For authenticated users, always prioritize dashboard flow
        console.log('Index: Authenticated user - checking onboarding and showing dashboard');
        checkOnboardingStatus(user.id);
      }
    } else {
      setIsCheckingOnboarding(false);
    }
  }, [user, location.search, location.pathname]);

  const handleOnboardingComplete = (data: any) => {
    console.log('Index: Onboarding completed with data:', data);
    if (user) {
      // Store the data and update state immediately
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      setOnboardingData(data);
      setIsOnboarded(true);
      setShowLanding(false);
    }
  };

  const handleGetStarted = () => {
    console.log('Index: Get started clicked, hiding landing page');
    setShowLanding(false);
  };

  const handleBusinessNameChange = (newName: string) => {
    const updatedData = {
      ...onboardingData,
      aboutBusiness: `${newName} has been serving the community with quality gardening products and expert advice.`
    };
    setOnboardingData(updatedData);
    
    if (user) {
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(updatedData));
    }
  };

  const handleCampaignCreated = () => {
    // Refresh data or trigger any necessary updates
    console.log('Index: Campaign created, refreshing dashboard data');
  };

  if (!user) {
    console.log('Index: No user found, returning null');
    return null; // This shouldn't happen due to ProtectedRoute, but just in case
  }

  // Show loading state while checking onboarding status
  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-garden-green mx-auto mb-4"></div>
          <p className="text-garden-green font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  console.log('Index: Final render state - showLanding:', showLanding, 'isOnboarded:', isOnboarded, 'currentView:', currentView);

  // For authenticated users: onboarding (if not completed) > dashboard (default)
  // Landing page should only show if explicitly requested via URL param
  return (
    <div className="min-h-screen bg-garden-background">
      {showLanding ? (
        <LandingPage onGetStarted={handleGetStarted} />
      ) : !isOnboarded ? (
        <WebsiteOnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <DashboardLayout
          currentView={currentView}
          onViewChange={setCurrentView}
          onboardingData={onboardingData}
          onBusinessNameChange={handleBusinessNameChange}
          onCampaignCreated={handleCampaignCreated}
        >
          <DashboardContent
            onboardingData={onboardingData}
            onBusinessNameChange={handleBusinessNameChange}
            onCampaignCreated={handleCampaignCreated}
          />
        </DashboardLayout>
      )}
    </div>
  );
};

export default Index;
