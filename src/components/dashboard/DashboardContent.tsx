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
  const [loading, setLoading] = useState(true);
  const [generatingContent, setGeneratingContent] = useState(false);

  const currentWeekNumber = getCurrentWeekNumber();
  
  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  console.log('🔍 DashboardContent: Rendering with user:', user?.id, 'tenant:', tenant?.id, 'isDevelopment:', isDevelopment);

  const fetchCampaignData = async () => {
    // 🔧 HYBRID: Support both tenant-based and user-based models
    if (!user) {
      console.log('❌ DashboardContent: No authenticated user, skipping fetch');
      setLoading(false);
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
        setLoading(false);
        return;
      }

      console.log('✅ DashboardContent: Found campaigns:', allCampaigns?.length || 0);
      
      if (!allCampaigns || allCampaigns.length === 0) {
        console.log('❌ DashboardContent: No campaigns found for user:', user.id, 'tenant:', tenant?.id || 'none');
        setActiveCampaign(undefined);
        setTasks([]);
        setLoading(false);
        return;
      }

      // 🔧 FIXED: Updated campaign selection logic to prioritize preview campaigns in development
      let selectedCampaign: Campaign | undefined;
      
      if (isDevelopment) {
        // In development, prioritize PREVIEW campaigns first
        selectedCampaign = allCampaigns.find(c => 
          c.title?.includes('PREVIEW') || c.title?.includes('DEV PREVIEW')
        );
        
        if (selectedCampaign) {
          console.log('✅ DashboardContent: Found PREVIEW campaign for development:', selectedCampaign.title);
        } else {
          console.log('🔍 DashboardContent: No PREVIEW campaign found, falling back to current week');
          // Fall back to current week campaign
          selectedCampaign = allCampaigns.find(c => c.week_number === currentWeekNumber);
        }
      } else {
        // In production, use current week campaign
        selectedCampaign = allCampaigns.find(c => c.week_number === currentWeekNumber);
      }
      
      if (!selectedCampaign) {
        // If no current week campaign, use the most recent one
        selectedCampaign = allCampaigns[allCampaigns.length - 1];
        console.log('🔍 DashboardContent: No current week campaign, using most recent:', selectedCampaign?.title);
      }

      console.log('🎯 DashboardContent: Selected campaign:', {
        title: selectedCampaign?.title,
        id: selectedCampaign?.id,
        isPreview: selectedCampaign?.title?.includes('PREVIEW'),
        isDevelopment
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

        // STEP 3: Auto-generate content if campaign exists but has no tasks
        if (selectedCampaign && securityCheckedTasks.length === 0) {
          console.log('🔍 DashboardContent: Campaign exists but no tasks found, auto-generating...');
          await autoGenerateContentForCampaign(selectedCampaign, []);
        }
      }

    } catch (error) {
      console.error('❌ DashboardContent: Error in fetchCampaignData:', error);
      setActiveCampaign(undefined);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateContentForCampaign = async (campaign: Campaign, existingTasks: any[]) => {
    if (generatingContent || existingTasks.length > 0) {
      console.log('DashboardContent: Skipping auto-generation - already generating or tasks exist');
      return;
    }

    console.log('DashboardContent: Auto-generating content for campaign:', campaign.title);
    setGeneratingContent(true);

    try {
      await generateRequiredTasks(
        campaign.id,
        [campaign], // Pass campaigns array
        user.id,
        () => {
          console.log('DashboardContent: Content generation completed, refetching data');
          fetchCampaignData();
        },
        tenant?.id // 🔧 HYBRID: Pass tenant_id if available, otherwise undefined for user-based model
      );
    } catch (error) {
      console.error('DashboardContent: Error auto-generating content:', error);
    } finally {
      setGeneratingContent(false);
    }
  };

  useEffect(() => {
    console.log('🔍 DashboardContent: useEffect triggered, user:', user?.id, 'tenant:', tenant?.id || 'none');
    if (user && !tenantLoading) {
      // 🔧 HYBRID: Don't wait for tenant - proceed if user is available
      fetchCampaignData();
    } else {
      console.log('🔍 DashboardContent: No user or tenant loading, skipping data fetch');
      setLoading(false);
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
            Please log in to access your dashboard
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

      {/* Weekly Content Updater - runs automatically to maintain campaigns */}
      <WeeklyContentUpdater />
      
      {/* First Time User Welcome */}
      <FirstTimeUserWelcome 
        onGetStarted={handleGetStarted}
        tasksCount={tasks.length}
      />

      {/* Unified Dashboard Grid - Main dashboard sections */}
      <UnifiedDashboardGrid
        activeCampaign={activeCampaign}
        userCreatedCampaigns={[]}
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
        onCampaignCreated={fetchCampaignData}
        onCampaignUpdate={fetchCampaignData}
        onCreateCampaign={onCampaignCreated}
      />
    </div>
  );
};
