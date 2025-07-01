import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { UnifiedDashboardGrid } from "./UnifiedDashboardGrid";
import { DevPreviewBadge } from "@/components/ui/dev-preview-badge";
import type { Campaign } from "@/types/content";
import { QuickstartChecklist } from "@/components/onboarding/QuickstartChecklist";
import { MicroWalkthroughTour } from "@/components/onboarding/MicroWalkthroughTour";
import { usePostConnectionFlow } from "@/hooks/usePostConnectionFlow";
import { ContentGenerationProvider } from "@/contexts/ContentGenerationContext";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange: (name: string) => void;
  onCampaignCreated: () => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
}: DashboardContentProps) => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeCampaign, setActiveCampaign] = useState<Campaign | undefined>();
  const [tasks, setTasks] = useState([]);
  const [userCreatedCampaigns, setUserCreatedCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickstartChecklist, setShowQuickstartChecklist] = useState(false);

  // Post-connection flow
  const { flowState, navigateToTargetSection, completeOnboarding } = usePostConnectionFlow();

  const currentWeekNumber = getCurrentWeekNumber();
  const isDevelopment = import.meta.env.DEV;

  console.log('🔍 DashboardContent: Rendering with user:', user?.id, 'tenant:', tenant?.id || 'none', 'isDevelopment:', isDevelopment);

  const fetchCampaignData = async () => {
    if (!user) {
      console.log('❌ DashboardContent: No authenticated user, skipping fetch');
      setLoading(false);
      return;
    }

    if (tenantLoading) {
      console.log('🔍 DashboardContent: Tenant still loading, waiting...');
      return;
    }

    try {
      console.log('🔍 DashboardContent: Fetching campaign data for user:', user.id, 'tenant:', tenant?.id || 'none');

      // Fetch campaigns
      let campaignQuery = supabase
        .from('campaigns')
        .select('*');

      if (tenant?.id) {
        campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
      } else {
        campaignQuery = campaignQuery.eq('user_id', user.id);
      }

      if (!isDevelopment) {
        campaignQuery = campaignQuery.not('title', 'ilike', 'PREVIEW%');
      }

      const { data: allCampaigns, error: campaignError } = await campaignQuery
        .order('week_number', { ascending: true });

      if (campaignError) {
        console.error('❌ DashboardContent: Error fetching campaigns:', campaignError);
        setActiveCampaign(undefined);
        setTasks([]);
        setUserCreatedCampaigns([]);
        setLoading(false);
        return;
      }

      console.log('✅ DashboardContent: Found campaigns:', allCampaigns?.length || 0);
      
      if (!allCampaigns || allCampaigns.length === 0) {
        console.log('❌ DashboardContent: No campaigns found - WeeklyContentUpdater should create one');
        setActiveCampaign(undefined);
        setTasks([]);
        setUserCreatedCampaigns([]);
        setLoading(false);
        return;
      }

      // Separate system campaigns from user-created campaigns
      const systemCampaigns = allCampaigns.filter(c => c.source !== 'quick_action');
      
      let customCampaigns = allCampaigns.filter(c => {
        if (c.source !== 'quick_action') return false;
        
        if (tenant?.id) {
          return c.tenant_id === tenant.id;
        } else {
          return c.user_id === user.id;
        }
      });
      
      setUserCreatedCampaigns(customCampaigns);

      // Select active campaign with improved logic
      let selectedCampaign: Campaign | undefined;
      
      if (isDevelopment) {
        selectedCampaign = systemCampaigns.find(c => 
          c.title?.includes('PREVIEW') || c.title?.includes('DEV PREVIEW')
        );
      }
      
      if (!selectedCampaign) {
        selectedCampaign = systemCampaigns.find(c => 
          c.week_number === currentWeekNumber &&
          c.theme && 
          !c.theme.includes('Seasonal Gardening Focus') &&
          !c.theme.includes('Week ') &&
          !c.theme.includes('PREVIEW')
        );
      }
      
      if (!selectedCampaign) {
        selectedCampaign = systemCampaigns.find(c => c.week_number === currentWeekNumber);
      }
      
      if (!selectedCampaign) {
        selectedCampaign = systemCampaigns[systemCampaigns.length - 1];
      }

      setActiveCampaign(selectedCampaign);

      // Fetch tasks
      const statusFilter = ['generating', 'review', 'ready', 'approved', 'scheduled', 'published'];
      if (isDevelopment) {
        statusFilter.push('preview');
      }

      let taskQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            user_id,
            id,
            week_number,
            created_at,
            theme,
            description,
            start_date,
            prompt,
            source,
            tenant_id
          )
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery = taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery = taskQuery.eq('user_id', user.id);
      }

      const { data: allTasks, error: allTasksError } = await taskQuery;

      if (allTasksError) {
        console.error('❌ DashboardContent: Error fetching tasks:', allTasksError);
        setTasks([]);
      } else {
        const securityCheckedTasks = allTasks?.filter(task => {
          if (tenant?.id) {
            const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            
            if (!belongsToTenant) return false;
            if (!isDevelopment && isPreviewCampaign) return false;
            
            return true;
          } else {
            const belongsToUser = task.campaigns && (task.campaigns.user_id === user.id || task.user_id === user.id);
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            
            if (!belongsToUser) return false;
            if (!isDevelopment && isPreviewCampaign) return false;
            
            return true;
          }
        }) || [];
        
        console.log('🔒 SECURITY: After security filtering:', securityCheckedTasks.length, 'tasks');
        setTasks(securityCheckedTasks);
      }

    } catch (error) {
      console.error('❌ DashboardContent: Error in fetchCampaignData:', error);
      setActiveCampaign(undefined);
      setTasks([]);
      setUserCreatedCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 DashboardContent: useEffect triggered');
    if (user && !tenantLoading) {
      fetchCampaignData();
    } else {
      if (!user) setLoading(false);
    }
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  const handleTaskUpdate = () => {
    console.log('DashboardContent: Task update triggered, refetching campaign data');
    fetchCampaignData();
  };

  const handleGetStarted = () => {
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      const campaignSection = document.querySelector('[data-campaign-section]');
      if (campaignSection) {
        campaignSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
        
        // Add visual feedback by briefly highlighting the section
        campaignSection.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          campaignSection.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
        }, 2000);
      } else {
        console.warn('Campaign section not found for scrolling');
        // Fallback: scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // Check if should show quickstart checklist
  useEffect(() => {
    if (user && !tenantLoading) {
      const hasSeenChecklist = localStorage.getItem(`quickstart_dismissed_${user.id}`);
      setShowQuickstartChecklist(!hasSeenChecklist);
    }
  }, [user, tenantLoading]);

  // Handle post-connection navigation
  useEffect(() => {
    if (flowState.isFirstTimeConnection && !loading) {
      navigateToTargetSection();
    }
  }, [flowState.isFirstTimeConnection, loading, navigateToTargetSection]);

  const handleDismissQuickstart = () => {
    setShowQuickstartChecklist(false);
    if (user) {
      localStorage.setItem(`quickstart_dismissed_${user.id}`, 'true');
    }
  };

  const handleNavigateToSection = (section: string) => {
    switch (section) {
      case 'social':
        // Navigate to social page or scroll to social section
        window.location.href = '/social';
        break;
      case 'weekly-content':
        const weeklyElement = document.querySelector('[data-section="weekly-content-section"]');
        if (weeklyElement) {
          weeklyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      case 'ready-to-post':
        const readyElement = document.querySelector('[data-section="ready-to-post-section"]');
        if (readyElement) {
          readyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
    }
  };

  if (!user || tenantLoading) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md bg-white"
        animated={true}
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-600">
            {!user ? 'Please log in to access your dashboard' : 'Loading your workspace...'}
          </p>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  if (loading) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md bg-white"
        animated={true}
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading your content...</p>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  return (
    <ContentGenerationProvider>
      <div className="w-full overflow-x-hidden bg-gray-50">
        <div className="space-y-4 p-4 md:p-6 w-full">
          {/* Quickstart Checklist - only show after social connection */}
          {showQuickstartChecklist && (
            <QuickstartChecklist
              onDismiss={handleDismissQuickstart}
              onNavigateToSection={handleNavigateToSection}
            />
          )}

          {/* Development Preview Badge */}
          {isDevelopment && activeCampaign?.title?.startsWith('PREVIEW') && (
            <div className="flex justify-center w-full">
              <DevPreviewBadge show={true} />
            </div>
          )}

          {/* Weekly Content Updater */}
          <WeeklyContentUpdater />
          
          {/* First Time User Welcome */}
          <FirstTimeUserWelcome 
            onGetStarted={handleGetStarted}
            tasksCount={tasks.length}
          />

          {/* Unified Dashboard Grid */}
          <UnifiedDashboardGrid
            activeCampaign={activeCampaign}
            userCreatedCampaigns={userCreatedCampaigns}
            tasks={tasks}
            onTaskUpdate={handleTaskUpdate}
            onCampaignCreated={fetchCampaignData}
            onCampaignUpdate={fetchCampaignData}
            onCreateCampaign={onCampaignCreated}
          />

          {/* Empty state hint */}
          {tasks.length === 0 && !activeCampaign && (
            <div className="text-center py-8 text-gray-500">
              <h3 className="text-lg font-medium mb-2">Need inspiration?</h3>
              <p className="text-sm">Generate your first posts ↑ to see them here.</p>
            </div>
          )}
        </div>

        {/* Micro Walkthrough Tour */}
        <MicroWalkthroughTour
          isVisible={flowState.shouldShowOnboarding}
          onComplete={completeOnboarding}
          onSkip={completeOnboarding}
        />
      </div>
    </ContentGenerationProvider>
  );
};
