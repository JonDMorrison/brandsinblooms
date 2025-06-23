import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider } from "@/components/ui/sidebar";

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

  const getCurrentView = (): "home" | "calendar" | "team" | "profile" => {
    const path = location.pathname;
    if (path === "/calendar") return "calendar";
    if (path === "/team") return "team";
    if (path === "/profile") return "profile";
    return "home";
  };

  const [currentView, setCurrentView] = useState<"home" | "calendar" | "team" | "profile">(getCurrentView());

  useEffect(() => {
    setCurrentView(getCurrentView());
  }, [location.pathname]);

  useEffect(() => {
    const loadOnboardingData = async () => {
      if (!user) return;

      const savedData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setOnboardingData(parsedData);
        return;
      }

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
    <SidebarProvider>
      <div className="min-h-screen w-full flex flex-col">
        {/* Trial Banner */}
        <TrialBanner />
        
        <div className="flex flex-1 w-full min-h-0 overflow-hidden">
          <DashboardLayout
            currentView={currentView}
            onViewChange={handleViewChange}
            onboardingData={onboardingData}
            onBusinessNameChange={handleBusinessNameChange}
            onCampaignCreated={handleCampaignCreated}
          >
            {isHomePage ? (
              <div className="w-full h-full bg-garden-background">
                <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
                  <UserMenu />
                </div>
                
                <div className="w-full h-full p-6">
                  {children}
                </div>
              </div>
            ) : (
              children
            )}
          </DashboardLayout>
        </div>
      </div>
    </SidebarProvider>
  );
};
