import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { HomepageErrorBoundary } from "./homepage/HomepageErrorBoundary";
import { useLoading } from "@/contexts/LoadingContext";
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
  const { setLoading, clearLoading } = useLoading();

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

  // Manage loading states in global context
  useEffect(() => {
    if (!user) {
      setLoading('homepage', {
        isLoading: true,
        message: 'Please log in to access your campaigns',
        priority: 'page'
      });
      return;
    }
    
    if (tenantLoading) {
      setLoading('homepage', {
        isLoading: true,
        message: 'Setting up your workspace...',
        priority: 'page'
      });
      return;
    }
    
    if (!tenant) {
      setLoading('homepage', {
        isLoading: true,
        message: 'Setting up your workspace... Please contact support if this continues.',
        priority: 'page'
      });
      return;
    }
    
    if (loading) {
      setLoading('homepage', {
        isLoading: true,
        message: 'Loading your campaigns and content...',
        priority: 'page'
      });
      return;
    }
    
    // Clear loading when everything is ready
    clearLoading('homepage');
  }, [user, tenantLoading, tenant, loading, setLoading, clearLoading]);

  // Handle early returns - let GlobalLoadingOverlay handle the display
  if (!user || tenantLoading || !tenant) {
    return null;
  }

  // Show error state
  if (error) {
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
    return null;
  }

  const weekNumber = getCurrentWeekNumber();
  let currentCampaign = campaigns.find(c => c.week_number === weekNumber);
  
  if (!currentCampaign && campaigns.length > 0) {
    console.log(`Homepage: No campaign found for current week ${weekNumber}, available weeks:`, 
      campaigns.map(c => c.week_number));
  }

  return (
    <HomepageErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
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
