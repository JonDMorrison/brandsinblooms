
import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TrialBanner } from "@/components/TrialBanner";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { UserMenu } from "@/components/UserMenu";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  // Determine current view based on pathname
  const getCurrentView = (): "home" | "calendar" | "team" | "profile" => {
    const path = location.pathname;
    if (path === "/calendar") return "calendar";
    if (path === "/team") return "team";
    if (path === "/profile") return "profile";
    return "home";
  };

  const [currentView, setCurrentView] = useState<"home" | "calendar" | "team" | "profile">(getCurrentView());

  // Update current view when location changes
  useEffect(() => {
    setCurrentView(getCurrentView());
  }, [location.pathname]);

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

  const handleViewChange = (view: "home" | "calendar" | "team" | "profile") => {
    setCurrentView(view);
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
    console.log('Campaign created, refreshing dashboard data');
  };

  const isHomePage = currentView === "home";

  return (
    <>
      <TrialBanner />
      <DashboardLayout
        currentView={currentView}
        onViewChange={handleViewChange}
        onboardingData={onboardingData}
        onBusinessNameChange={handleBusinessNameChange}
        onCampaignCreated={handleCampaignCreated}
      >
        {isHomePage ? (
          <div className="space-y-6 bg-white">
            {/* Fixed UserMenu in top right corner */}
            <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
              <UserMenu />
            </div>

            {/* Enhanced Header with Apple Design - Force white background */}
            <EnhancedAppleCard 
              variant="default" 
              surface="primary" 
              className="border-0 border-b border-gray-200 rounded-none shadow-sm bg-white"
              hoverEffect="none"
              animated={true}
            >
              <AppleCardContent className={`
                bg-white
                ${isMobile ? 'mobile-safe-area mobile-welcome-section' : 'responsive-padding'}
              `}>
                <WelcomeSection 
                  onboardingData={onboardingData}
                  onBusinessNameChange={handleBusinessNameChange}
                />
              </AppleCardContent>
            </EnhancedAppleCard>
            
            {/* Dashboard Content - Force white background on main content area */}
            <div className={`
              bg-white
              ${isMobile ? 'mobile-safe-area mobile-container-constraint' : 'responsive-padding'}
            `}>
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </DashboardLayout>
    </>
  );
};
