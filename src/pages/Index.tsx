
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { UserMenu } from "@/components/UserMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarLayout } from "@/components/SidebarLayout";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { useLoading } from "@/contexts/LoadingContext";

const Index = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const { setLoading, clearLoading } = useLoading();
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
    // Refresh dashboard data without full page reload
    window.dispatchEvent(new CustomEvent('campaignCreated'));
  };

  // Manage auth loading state in global context
  useEffect(() => {
    if (loading) {
      setLoading('auth', {
        isLoading: true,
        message: 'Loading dashboard...',
        priority: 'auth'
      });
    } else {
      clearLoading('auth');
    }
  }, [loading, setLoading, clearLoading]);

  // Show loading state while auth is loading - let GlobalLoadingOverlay handle display
  if (loading) {
    return null;
  }

  if (!user) {
    return <div>Please log in to access the dashboard</div>;
  }

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen relative">
        {/* Fixed UserMenu - always visible at top right */}
        <div className={`fixed top-4 right-4 z-[9999] ${isMobile ? 'top-2 right-2' : ''}`}>
          <UserMenu />
        </div>
        
        <SidebarLayout>
          <div className="w-full h-full bg-garden-background">
            {/* Dashboard Content */}
            <div className="w-full h-full p-6">
          <DashboardContent 
            onboardingData={onboardingData} 
            onBusinessNameChange={handleBusinessNameChange}
            onCampaignCreated={handleCampaignCreated}
          />
            </div>
          </div>
        </SidebarLayout>
      </div>
    </DashboardErrorBoundary>
  );
};

export default Index;
