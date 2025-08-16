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
import { ReadyToPublishSection } from "./ReadyToPublishSection";
import { QuickPublishModal } from "./QuickPublishModal";
import { TASK_STATUS } from "@/constants/taskStatus";
import { useNavigate } from "react-router-dom";
// Removed sonner import - using global toast replacement
import { ProgressiveDashboardShell } from "./ProgressiveDashboardShell";
import { ProgressiveLoadingCard } from "./ProgressiveLoadingCard";

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
  const navigate = useNavigate();
  const [activeCampaign, setActiveCampaign] = useState<Campaign | undefined>();
  const [tasks, setTasks] = useState([]);
  const [userCreatedCampaigns, setUserCreatedCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickstartChecklist, setShowQuickstartChecklist] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  
  // Get approved tasks for the Ready to Publish section
  const approvedTasks = tasks?.filter(task => task.status === TASK_STATUS.APPROVED) || [];

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

      console.log('✅ DashboardContent: Found campaigns:', allCampaigns?.length || 0, 'Current user:', user.id, 'Current tenant:', tenant?.id);
      
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
      
      console.log('🎯 Custom campaigns found:', customCampaigns.length, customCampaigns.map(c => ({
        id: c.id,
        title: c.title,
        source: c.source,
        user_id: c.user_id,
        tenant_id: c.tenant_id,
        created_at: c.created_at
      })));
      
      setUserCreatedCampaigns(customCampaigns);

      console.log('🔧 After setUserCreatedCampaigns, length should be:', customCampaigns.length);

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
            const isCustomCampaign = task.campaigns?.source === 'quick_action';
            
            if (!belongsToTenant) return false;
            if (!isDevelopment && isPreviewCampaign) return false;
            
            return true;
          } else {
            const belongsToUser = task.campaigns && (task.campaigns.user_id === user.id || task.user_id === user.id);
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            const isCustomCampaign = task.campaigns?.source === 'quick_action';
            
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

  // Listen for campaign creation events to refresh data
  useEffect(() => {
    const handleCampaignCreated = () => {
      console.log('🔄 DashboardContent: Campaign created event received, refreshing data');
      fetchCampaignData();
    };

    window.addEventListener('campaignCreated', handleCampaignCreated);
    
    return () => {
      window.removeEventListener('campaignCreated', handleCampaignCreated);
    };
  }, []);

  // Set up real-time subscriptions for progressive loading
  useEffect(() => {
    if (!user || !tenant) return;

    // Check if we're in a state where content might still be generating
    const checkContentGenerationStatus = () => {
      const hasMinimalContent = tasks.length >= 10 && activeCampaign;
      setIsContentGenerating(!hasMinimalContent);
    };

    checkContentGenerationStatus();

    // Set up real-time subscription for campaigns
    const campaignChannel = supabase
      .channel('dashboard-campaign-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'campaigns',
          filter: tenant?.id ? `tenant_id=eq.${tenant.id}` : `user_id=eq.${user.id}`
        },
        () => {
          console.log('📡 Real-time: New campaign created');
          fetchCampaignData();
        }
      )
      .subscribe();

    // Set up real-time subscription for content tasks
    const taskChannel = supabase
      .channel('dashboard-task-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_tasks',
          filter: tenant?.id ? `tenant_id=eq.${tenant.id}` : `user_id=eq.${user.id}`
        },
        () => {
          console.log('📡 Real-time: New content task created');
          fetchCampaignData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(taskChannel);
    };
  }, [user, tenant, tasks.length, activeCampaign]);

  const handleTaskUpdate = () => {
    console.log('DashboardContent: Task update triggered, refetching campaign data');
    fetchCampaignData();
  };
  
  const handlePublishNow = (task: any) => {
    setSelectedTask(task);
    setShowPublishModal(true);
  };
  
  const handleSchedulePost = (task: any) => {
    setSelectedTask(task);
    setShowPublishModal(true);
  };
  
  const handleViewAllPublishable = () => {
    navigate('/publish');
  };
  
  const handlePublish = async (task: any, platform: string, scheduledTime?: Date) => {
    // This is a placeholder - in real implementation, this would:
    // 1. Call the publish API
    // 2. Update task status to 'scheduled' or 'published'
    // 3. Show success toast
    
    console.log('Publishing task:', task.id, 'to platform:', platform, 'at:', scheduledTime);
    
    const status = scheduledTime ? TASK_STATUS.SCHEDULED : TASK_STATUS.PUBLISHED;
    
    toast.success(
      scheduledTime 
        ? `Post scheduled for ${scheduledTime.toLocaleString()}`
        : 'Post published successfully!'
    );
    
    // Refresh data to reflect changes
    handleTaskUpdate();
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
      <ProgressiveDashboardShell>
        <div className="w-full overflow-x-hidden dashboard-background">
          <div className="space-y-4 p-4 md:p-6 w-full dashboard-container">
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

          {/* Ready to Publish Section - Only show if there are approved tasks */}
          {approvedTasks.length > 0 && (
            <ReadyToPublishSection
              approvedTasks={approvedTasks}
              onPublishNow={handlePublishNow}
              onSchedulePost={handleSchedulePost}
              onViewAll={handleViewAllPublishable}
            />
          )}

          {/* Weekly Content Updater */}
          <WeeklyContentUpdater />
          
          {/* First Time User Welcome */}
          <FirstTimeUserWelcome 
            onGetStarted={handleGetStarted}
            tasksCount={tasks.length}
          />

          {/* Unified Dashboard Grid with Progressive Loading */}
          {!isContentGenerating || activeCampaign || tasks.length > 0 ? (
            <UnifiedDashboardGrid
              activeCampaign={activeCampaign}
              userCreatedCampaigns={userCreatedCampaigns}
              tasks={tasks.filter(t => t.campaigns?.source !== 'quick_action')}
              onTaskUpdate={handleTaskUpdate}
              onCampaignCreated={fetchCampaignData}
              onCampaignUpdate={fetchCampaignData}
              onCreateCampaign={onCampaignCreated}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
              <div className="xl:col-span-8 space-y-6">
                <ProgressiveLoadingCard
                  title="Weekly Content Campaign"
                  description="Your personalized weekly content themes are being created"
                  expectedContent="Custom weekly gardening themes, seasonal tips, and targeted content for your audience"
                  isLoading={true}
                />
                
                <ProgressiveLoadingCard
                  title="Ready to Publish Posts"
                  description="Individual social media posts are being generated"
                  expectedContent="7 posts per week covering gardening tips, seasonal advice, and business promotions"
                  isLoading={true}
                />
              </div>
              
              <div className="xl:col-span-4 space-y-6">
                <ProgressiveLoadingCard
                  title="Quick Actions"
                  description="Setting up your content creation tools"
                  expectedContent="Quick campaign creation, event planning, and content generation tools"
                  isLoading={false}
                />
                
                <ProgressiveLoadingCard
                  title="Seasonal Holidays"
                  description="Loading relevant seasonal content opportunities"
                  expectedContent="Holiday-specific content suggestions and marketing opportunities"
                  isLoading={true}
                />
              </div>
            </div>
          )}

          {/* Empty state hint - only show if not generating and no content */}
          {!isContentGenerating && tasks.length === 0 && !activeCampaign && (
            <div className="text-center py-8 text-gray-500">
              <h3 className="text-lg font-medium mb-2">Ready to create content?</h3>
              <p className="text-sm">Use the Quick Actions above to generate your first posts.</p>
            </div>
          )}
        </div>

        {/* Micro Walkthrough Tour */}
        <MicroWalkthroughTour
          isVisible={flowState.shouldShowOnboarding}
          onComplete={completeOnboarding}
          onSkip={completeOnboarding}
        />
        
        {/* Quick Publish Modal */}
        <QuickPublishModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          socialConnections={[]} // TODO: Pass real social connections
          onPublish={handlePublish}
        />
        </div>
      </ProgressiveDashboardShell>
    </ContentGenerationProvider>
  );
};
