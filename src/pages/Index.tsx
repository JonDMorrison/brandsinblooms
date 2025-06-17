
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { UserMenu } from "@/components/UserMenu";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  // Add state for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

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

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    handleCampaignCreated();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreatedInternal = () => {
    setShowNewCampaignModal(false);
    handleCampaignCreated();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  // Show loading state while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
    <div className="min-h-screen bg-surface-secondary apple-fade-in">
      {/* Fixed UserMenu in top right corner */}
      <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
        <UserMenu />
      </div>

      {/* Enhanced Header with Apple Design */}
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="border-0 border-b border-gray-200 rounded-none shadow-sm"
        hoverEffect="none"
        animated={true}
      >
        <AppleCardContent className={`
          max-w-7xl mx-auto 
          ${isMobile ? 'mobile-safe-area mobile-welcome-section' : 'responsive-padding'}
        `}>
          <WelcomeSection 
            onboardingData={onboardingData}
            onBusinessNameChange={handleBusinessNameChange}
          />
        </AppleCardContent>
      </EnhancedAppleCard>
      
      {/* Dashboard Content - This is the main content area */}
      <div className={`
        max-w-7xl mx-auto apple-slide-up
        ${isMobile ? 'mobile-safe-area mobile-container-constraint' : 'responsive-padding'}
      `}>
        <DashboardContent
          onboardingData={onboardingData}
          onBusinessNameChange={handleBusinessNameChange}
          onCampaignCreated={handleCampaignCreated}
        />
      </div>

      {/* Quick Action Modals */}
      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />

      <NewCampaignModal 
        open={showNewCampaignModal}
        onOpenChange={setShowNewCampaignModal}
        onCampaignCreated={handleCampaignCreatedInternal}
      />
    </div>
  );
};

export default Index;
