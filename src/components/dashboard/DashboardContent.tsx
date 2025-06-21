import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { BodyMedium } from "@/components/ui/typography";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { UnifiedDashboardGrid } from "./UnifiedDashboardGrid";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";
import { DevPreviewBadge } from "@/components/ui/dev-preview-badge";
import type { Campaign } from "@/types/content";

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
  const [generatingContent, setGeneratingContent] = useState(false);

  const currentWeekNumber = getCurrentWeekNumber();
  
  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  console.log('🔍 DashboardContent: Rendering with user:', user?.id, 'tenant:', tenant?.id || 'none', 'isDevelopment:', isDevelopment);

  const fetchCampaignData = async () => {
    // 🔧 HYBRID: Support both tenant-based and user-based models
    if (!user) {
      console.log('❌ DashboardContent: No authenticated user, skipping fetch');
      setLoading(false);
      return;
    }

    // Wait for tenant loading to complete
    if (tenantLoading) {
      console.log('🔍 DashboardContent: Tenant still loading, waiting...');
      return;
    }

    try {
      console.log('🔍 DashboardContent: Fetching campaign data for user:', user.id, 'tenant:', tenant?.id || 'none', 'week:', currentWeekNumber, 'isDevelopment:', isDevelopment);

      // STEP 1: Look for campaigns with hybrid approach
      console.log('🔍 DashboardContent: Looking for campaigns...');
      
      let campaignQuery = supabase
        .from('campaigns')
        .select('*');

      // 🔧 HYBRID: Apply appropriate filtering based on available data
      if (tenant?.id) {
        // If user has tenant, use tenant-based filtering
        campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
        console.log('🔍 DashboardContent: Using tenant-based campaign filtering for tenant:', tenant.id);
      } else {
        // If no tenant, fall back to user-based filtering
        campaignQuery = campaignQuery.eq('user_id', user.id);
        console.log('🔍 DashboardContent: Using user-based campaign filtering for user:', user.id);
      }

      // 🔧 FIXED: Only exclude PREVIEW campaigns for production users, not development
      if (!isDevelopment) {
        campaignQuery = campaignQuery.not('title', 'ilike', 'PREVIEW%');
        console.log('🔍 DashboardContent: Production mode - excluding PREVIEW campaigns');
      } else {
        console.log('🔍 DashboardContent: Development mode - including PREVIEW campaigns');
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
      
      // 🔧 FIXED: More inclusive filtering for custom campaigns
      let customCampaigns = allCampaigns.filter(c => c.source === 'quick_action');
      
      // If no custom campaigns found with strict filtering, try more inclusive approach
      if (customCampaigns.length === 0) {
        console.log('🔍 DashboardContent: No custom campaigns found with strict filtering, trying inclusive approach...');
        
        // Fetch all quick_action campaigns and filter more inclusively
        const { data: allQuickActionCampaigns } = await supabase
          .from('campaigns')
          .select('*')
          .eq('source', 'quick_action');
          
        if (allQuickActionCampaigns) {
          // Include campaigns that:
          // 1. Match current user_id, OR
          // 2. Match tenant_id (if user has tenant), OR  
          // 3. Have null user_id but were created recently (likely by current user)
          customCampaigns = allQuickActionCampaigns.filter(c => {
            const matchesUser = c.user_id === user.id;
            const matchesTenant = tenant?.id && c.tenant_id === tenant.id;
            const isOrphanedRecent = !c.user_id && !c.tenant_id && 
              new Date(c.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000); // Created within 24 hours
            
            return matchesUser || matchesTenant || isOrphanedRecent;
          });
          
          console.log('🔍 DashboardContent: Found custom campaigns with inclusive filtering:', customCampaigns.length);
        }
      }
      
      console.log('🔍 DashboardContent: System campaigns:', systemCampaigns.length, 'Custom campaigns:', customCampaigns.length);
      setUserCreatedCampaigns(customCampaigns);

      // 🔧 FIXED: Updated campaign selection logic to prioritize preview campaigns in development
      let selectedCampaign: Campaign | undefined;
      
      if (isDevelopment) {
        // In development, prioritize PREVIEW campaigns first
        selectedCampaign = systemCampaigns.find(c => 
          c.title?.includes('PREVIEW') || c.title?.includes('DEV PREVIEW')
        );
        
        if (selectedCampaign) {
          console.log('✅ DashboardContent: Found PREVIEW campaign for development:', selectedCampaign.title);
        } else {
          console.log('🔍 DashboardContent: No PREVIEW campaign found, falling back to current week');
          // Fall back to current week campaign
          selectedCampaign = systemCampaigns.find(c => c.week_number === currentWeekNumber);
        }
      } else {
        // In production, use current week campaign
        selectedCampaign = systemCampaigns.find(c => c.week_number === currentWeekNumber);
      }
      
      if (!selectedCampaign) {
        // If no current week campaign, use the most recent one
        selectedCampaign = systemCampaigns[systemCampaigns.length - 1];
        console.log('🔍 DashboardContent: No current week campaign, using most recent:', selectedCampaign?.title);
      }

      console.log('🎯 DashboardContent: Selected campaign:', {
        title: selectedCampaign?.title,
        id: selectedCampaign?.id,
        isPreview: selectedCampaign?.title?.includes('PREVIEW'),
        isDevelopment,
        hasContent: false // Will be determined below
      });

      setActiveCampaign(selectedCampaign);

      // STEP 2: Fetch tasks for all campaigns with hybrid approach
      const statusFilter = ['generating', 'review', 'ready', 'approved', 'posted'];
      if (isDevelopment) {
        statusFilter.push('preview');
        console.log('🔍 DashboardContent: Development mode - including preview status in filter');
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

      // 🔧 HYBRID: Apply appropriate filtering based on available data
      if (tenant?.id) {
        // If user has tenant, use tenant-based filtering
        taskQuery = taskQuery.eq('tenant_id', tenant.id);
        console.log('🔍 DashboardContent: Using tenant-based task filtering for tenant:', tenant.id);
      } else {
        // If no tenant, fall back to user-based filtering
        taskQuery = taskQuery.eq('user_id', user.id);
        console.log('🔍 DashboardContent: Using user-based task filtering for user:', user.id);
      }

      const { data: allTasks, error: allTasksError } = await taskQuery;

      if (allTasksError) {
        console.error('❌ DashboardContent: Error fetching tasks:', allTasksError);
        setTasks([]);
      } else {
        console.log('✅ DashboardContent: Successfully fetched', allTasks?.length || 0, 'tasks');
        
        // 🔧 HYBRID: Security verification and PREVIEW filtering
        const securityCheckedTasks = allTasks?.filter(task => {
          if (tenant?.id) {
            // Tenant-based security
            const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            
            // Only exclude PREVIEW campaigns for production users
            if (!isDevelopment && isPreviewCampaign) {
              return false;
            }
            
            return belongsToTenant;
          } else {
            // User-based security
            const belongsToUser = task.campaigns && (task.campaigns.user_id === user.id || task.user_id === user.id);
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            
            // Only exclude PREVIEW campaigns for production users
            if (!isDevelopment && isPreviewCampaign) {
              return false;
            }
            
            return belongsToUser;
          }
        }) || [];
        
        console.log('✅ DashboardContent: After filtering:', securityCheckedTasks.length, 'tasks (isDevelopment:', isDevelopment, ', tenant:', !!tenant?.id, ')');
        setTasks(securityCheckedTasks);

        // 🔧 NEW: Check if we have tasks with stuck "generating" status and log it
        const stuckGeneratingTasks = securityCheckedTasks.filter(task => task.status === 'generating');
        if (stuckGeneratingTasks.length > 0) {
          console.warn('⚠️ DashboardContent: Found', stuckGeneratingTasks.length, 'tasks stuck in generating status');
          stuckGeneratingTasks.forEach(task => {
            console.warn(`⚠️ Stuck task: ${task.post_type} (${task.id}) for campaign ${task.campaigns?.title}`);
          });
        }

        // 🔧 NEW: Auto-detect if we should show generating state based on campaign content
        if (selectedCampaign) {
          const campaignTasks = securityCheckedTasks.filter(task => task.campaign_id === selectedCampaign.id);
          const hasRealContent = campaignTasks.some(task => 
            task.ai_output && 
            task.ai_output.trim() !== '' && 
            task.status !== 'generating'
          );
          
          // If campaign has no real content, show generating state temporarily
          if (!hasRealContent && campaignTasks.length === 0) {
            console.log('🔄 DashboardContent: Campaign has no content tasks, may be generating...');
            setGeneratingContent(true);
            
            // Clear generating state after 10 seconds to prevent getting stuck
            setTimeout(() => {
              console.log('🔄 DashboardContent: Clearing generating state after timeout');
              setGeneratingContent(false);
            }, 10000);
          } else {
            setGeneratingContent(false);
          }
        }
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
    console.log('🔍 DashboardContent: useEffect triggered, user:', user?.id, 'tenant:', tenant?.id || 'none', 'tenantLoading:', tenantLoading);
    if (user && !tenantLoading) {
      // 🔧 HYBRID: Don't wait for tenant - proceed if user is available and tenant loading is complete
      fetchCampaignData();
    } else {
      console.log('🔍 DashboardContent: Waiting for user or tenant loading to complete');
      if (!user) setLoading(false);
    }
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  // Debug logging for final state
  useEffect(() => {
    console.log('🔍 DashboardContent: Final state update:', {
      activeCampaign: activeCampaign ? {
        id: activeCampaign.id,
        title: activeCampaign.title,
        week_number: activeCampaign.week_number,
        tenant_id: activeCampaign.tenant_id,
        user_id: activeCampaign.user_id,
        isPreview: activeCampaign.title?.startsWith('PREVIEW')
      } : null,
      tasksCount: tasks.length,
      loading,
      generatingContent,
      tenantId: tenant?.id || 'none',
      userId: user?.id,
      isDevelopment,
      usesTenantModel: !!tenant?.id
    });
  }, [activeCampaign, tasks, loading, generatingContent, tenant, user, isDevelopment]);

  const handleTaskUpdate = () => {
    console.log('DashboardContent: Task update triggered, refetching campaign data');
    fetchCampaignData();
  };

  const handleGetStarted = () => {
    const campaignSection = document.querySelector('[data-campaign-section]');
    if (campaignSection) {
      campaignSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Early return if no authenticated user or tenant is loading
  if (!user || tenantLoading) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md bg-white"
        animated={true}
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <BodyMedium className="text-text-secondary">
            {!user ? 'Please log in to access your dashboard' : 'Loading your workspace...'}
          </BodyMedium>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  if (loading || generatingContent) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md bg-white"
        animated={true}
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <BodyMedium className="text-text-secondary mt-4">
            {generatingContent ? 'Generating your content...' : 'Loading your content...'}
          </BodyMedium>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  console.log('🎨 DashboardContent: Final render - activeCampaign:', activeCampaign?.title, 'tasks:', tasks.length);

  return (
    <div className="space-y-8 mobile-dashboard-spacing bg-garden-background">
      {/* Development Preview Badge */}
      {isDevelopment && activeCampaign?.title?.startsWith('PREVIEW') && (
        <div className="flex justify-center">
          <DevPreviewBadge show={true} />
        </div>
      )}

      {/* Weekly Content Updater - runs automatically to maintain campaigns and generate content */}
      <WeeklyContentUpdater />
      
      {/* First Time User Welcome */}
      <FirstTimeUserWelcome 
        onGetStarted={handleGetStarted}
        tasksCount={tasks.length}
      />

      {/* Unified Dashboard Grid - Main dashboard sections */}
      <UnifiedDashboardGrid
        activeCampaign={activeCampaign}
        userCreatedCampaigns={userCreatedCampaigns}
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
        onCampaignCreated={fetchCampaignData}
        onCampaignUpdate={fetchCampaignData}
        onCreateCampaign={onCampaignCreated}
      />
    </div>
  );
};
