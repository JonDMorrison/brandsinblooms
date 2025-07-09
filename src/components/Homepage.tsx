import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { HomepageErrorBoundary } from "./homepage/HomepageErrorBoundary";
import { Loader2 } from "lucide-react";
import { Campaign } from "@/types/content";

// Import the 5 main sections
import { QuickstartChecklist } from "@/components/onboarding/QuickstartChecklist";
import { WeeklyThemeCarousel } from "./homepage/WeeklyThemeCarousel";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";
import { SeasonalHolidaysCard } from "@/components/dashboard/seasonal-holidays/SeasonalHolidaysCard";
import { CustomContentSection } from "@/components/dashboard/custom-content/CustomContentSection";
import { ReadyToPostCard } from "./homepage/ReadyToPostCard";
import { WeeklyContentUpdater } from "@/components/dashboard/current-campaign/WeeklyContentUpdater";
import { ContentProvider, useContent } from "@/contexts/ContentContext";

const HomepageContent = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { campaigns, tasks, userCreatedCampaigns, loading, error, refreshData } = useContent();
  const [showQuickstart, setShowQuickstart] = useState(false);

  console.log('🔍 Homepage state:', {
    userExists: !!user,
    tenantExists: !!tenant,
    tenantLoading,
    contentLoading: loading,
    contentError: error,
    campaignsCount: campaigns?.length || 0,
    tasksCount: tasks?.length || 0
  });

  const handleTaskUpdate = () => {
    refreshData();
  };

  const handleCampaignCreated = () => {
    refreshData();
  };

  const handleNavigateToSection = (section: string) => {
    switch (section) {
      case 'social':
        window.location.href = '/social';
        break;
      case 'weekly-content':
        const weeklyElement = document.querySelector('[data-section="weekly-content"]');
        if (weeklyElement) {
          weeklyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'ready-to-post':
        const readyElement = document.querySelector('[data-section="ready-to-post"]');
        if (readyElement) {
          readyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
    }
  };


  // Check if should show quickstart checklist
  useEffect(() => {
    if (user && !tenantLoading) {
      const hasSeenChecklist = localStorage.getItem(`quickstart_dismissed_${user.id}`);
      setShowQuickstart(!hasSeenChecklist);
    }
  }, [user, tenantLoading]);

  const handleDismissQuickstart = () => {
    setShowQuickstart(false);
    if (user) {
      localStorage.setItem(`quickstart_dismissed_${user.id}`, 'true');
    }
  };

  // Handle early returns with proper loading states
  if (!user || tenantLoading) {
    console.log('🔍 Homepage: Showing loading - no user or tenant loading');
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-garden-green" />
              <p className="text-garden-green font-medium text-lg">
                {!user ? 'Please log in to access your campaigns' : 'Loading your workspace...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show tenant assignment message if user has no tenant
  if (!tenant) {
    console.log('🔍 Homepage: No tenant found');
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <p className="text-garden-green font-medium text-lg">Setting up your workspace...</p>
              <p className="text-gray-500 text-sm mt-2">Please contact support to assign you to an organization.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.log('🔍 Homepage: Content error:', error);
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <p className="text-red-600 font-medium text-lg">{error}</p>
              <button 
                onClick={refreshData}
                className="mt-4 px-4 py-2 bg-garden-green text-white rounded hover:bg-garden-green/90"
                aria-label="Retry loading content"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    console.log('🔍 Homepage: Content still loading');
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-garden-green" />
              <p className="text-garden-green font-medium text-lg">Loading your campaigns and content...</p>
              <p className="text-gray-500 text-sm mt-2">Setting up your marketing workspace</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('🔍 Homepage: All checks passed, rendering dashboard');

  const weekNumber = getCurrentWeekNumber();
  let currentCampaign = campaigns.find(c => c.week_number === weekNumber);
  
  if (!currentCampaign && campaigns.length > 0) {
    console.log(`Homepage: No campaign found for current week ${weekNumber}, available weeks:`, 
      campaigns.map(c => c.week_number));
  }

  return (
    <HomepageErrorBoundary>
      <div className="min-h-screen bg-sand-50 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Auto-generate weekly content for new users */}
          <WeeklyContentUpdater />
          
          {/* Section 1: 4 Steps to Use the App */}
          {showQuickstart && (
            <HomepageErrorBoundary>
              <QuickstartChecklist
                onDismiss={handleDismissQuickstart}
                onNavigateToSection={handleNavigateToSection}
              />
            </HomepageErrorBoundary>
          )}

          {/* Section 2: Weekly Theme Accordion */}
          <HomepageErrorBoundary>
            <div data-section="weekly-content">
              <WeeklyThemeCarousel 
                currentCampaign={currentCampaign}
                tasks={tasks}
                onTaskUpdate={handleTaskUpdate}
                onCampaignCreated={handleCampaignCreated}
              />
            </div>
          </HomepageErrorBoundary>

          {/* Section 3: Quick Actions - Responsive grid */}
          <HomepageErrorBoundary>
            <div className="w-full">
              <QuickActionsSection onCampaignCreated={handleCampaignCreated} />
            </div>
          </HomepageErrorBoundary>

          {/* Section 4: Custom Content Section */}
          <HomepageErrorBoundary>
            <div className="w-full">
              <CustomContentSection
                userCreatedCampaigns={userCreatedCampaigns}
                onContentGenerated={handleTaskUpdate}
              />
            </div>
          </HomepageErrorBoundary>

          {/* Section 5: Holiday Cards - Responsive layout */}
          <HomepageErrorBoundary>
            <div className="w-full">
              <SeasonalHolidaysCard onContentGenerated={handleTaskUpdate} />
            </div>
          </HomepageErrorBoundary>

          {/* Section 6: Ready to Post */}
          <HomepageErrorBoundary>
            <div data-section="ready-to-post">
              <ReadyToPostCard 
                tasks={tasks}
                onTaskUpdate={handleTaskUpdate}
              />
            </div>
          </HomepageErrorBoundary>

        </div>
      </div>
    </HomepageErrorBoundary>
  );
};

export const Homepage = () => {
  return (
    <ContentProvider>
      <HomepageContent />
    </ContentProvider>
  );
};
