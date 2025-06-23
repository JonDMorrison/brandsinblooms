import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { user, loading } = useAuth();
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  // Load onboarding data
  useEffect(() => {
    const loadOnboardingData = async () => {
      if (!user) return;

      // First check localStorage
      const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setOnboardingData(parsedData);
        return;
      }

      // If not in localStorage, check the database
      try {
        const { data: dbOnboardingData, error } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching onboarding data:', error);
          return;
        }

        if (dbOnboardingData) {
          const syncedData = {
            aboutBusiness: dbOnboardingData.about_business || "",
            toneSamples: dbOnboardingData.tone_samples || "",
            annualEvents: dbOnboardingData.annual_events || "",
            websiteUrl: ""
          };
          
          localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(syncedData));
          setOnboardingData(syncedData);
        }
      } catch (error) {
        console.error('Error loading onboarding data:', error);
      }
    };

    loadOnboardingData();
  }, [user]);

  const handleBusinessNameChange = (newName: string) => {
    const updatedData = {
      ...onboardingData,
      aboutBusiness: `${newName} has been serving the community with quality products and expert advice.`
    };
    setOnboardingData(updatedData);
    
    if (user) {
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(updatedData));
    }
  };

  const handleCampaignCreated = () => {
    // Refresh dashboard data
    window.location.reload();
  };

  // Show loading state while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-garden-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardContent
      onboardingData={onboardingData}
      onBusinessNameChange={handleBusinessNameChange}
      onCampaignCreated={handleCampaignCreated}
    />
  );
};

export default Index;
