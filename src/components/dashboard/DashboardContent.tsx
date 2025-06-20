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

  // Debug logging to see what's rendering
  console.log('🔍 DashboardContent: Rendering with user:', user?.id, 'tenant:', tenant?.id);
  console.log('🎨 DashboardContent: Component loaded, should show garden green theme');

  const fetchCampaignData = async () => {
    if (!user || !tenant) {
      console.log('❌ DashboardContent: No authenticated user or tenant, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 DashboardContent: Fetching campaign data for tenant:', tenant.id, 'week:', currentWeekNumber);

      // URGENT FIX: Updated status filter to match live user requirements
      const statusFilter = ['generating', 'review', 'ready', 'approved', 'posted'];
      if (isDevelopment) {
        statusFilter.push('preview');
      }

      // STEP 1: Fetch all tasks for tenant with corrected status filter
      const { data: allTasks, error: allTasksError } = await supabase
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
        .eq('tenant_id', tenant.id)
        .in('status', statusFilter)  // URGENT FIX: Use corrected status filter
        .order('created_at', { ascending: false });

      if (allTasksError) {
        console.error('❌ DashboardContent: Error fetching all tasks:', allTasksError);
        setTasks([]);
      } else {
        console.log('✅ DashboardContent: Successfully fetched', allTasks?.length || 0, 'tasks for tenant', tenant.id);
        
        // Security verification and PREVIEW filtering for live users
        const tenantTasks = allTasks?.filter(task => {
          const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
          const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
          
          // URGENT FIX: Exclude PREVIEW campaigns for live users
          if (!isDevelopment && isPreviewCampaign) {
            return false;
          }
          
          return belongsToTenant;
        }) || [];
        
        console.log('✅ DashboardContent: After security filter and PREVIEW exclusion:', tenantTasks.length, 'tasks');
        setTasks(tenantTasks);

        // STEP 2: Find campaign from tasks if they exist
        if (tenantTasks.length > 0) {
          console.log('✅ DashboardContent: Found tasks, extracting campaign...');
          
          const firstTask = tenantTasks[0];
          console.log('🔍 DashboardContent: First task campaign data:', firstTask.campaigns);
          
          if (firstTask.campaigns) {
            const campaign: Campaign = {
              id: firstTask.campaigns.id,
              title: firstTask.campaigns.title,
              week_number: firstTask.campaigns.week_number,
              start_date: firstTask.campaigns.start_date,
              created_at: firstTask.campaigns.created_at,
              user_id: firstTask.campaigns.user_id,
              tenant_id: firstTask.campaigns.tenant_id,
              theme: firstTask.campaigns.theme || undefined,
              description: firstTask.campaigns.description || undefined,
              prompt: firstTask.campaigns.prompt || undefined,
              source: firstTask.campaigns.source || 'system'
            };

            console.log('✅ DashboardContent: Setting activeCampaign to:', campaign.title, 'ID:', campaign.id);
            setActiveCampaign(campaign);
            setLoading(false);
            return;
          }
        }

        // STEP 3: Enhanced campaign resolution with current week focus
        console.log('🔍 DashboardContent: No tasks with campaigns found, trying fallback campaign search...');
        
        // First try to find a campaign for the current week
        let campaignQuery = supabase
          .from('campaigns')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('week_number', currentWeekNumber)  // Focus on current week first
          .order('created_at', { ascending: false });

        // URGENT FIX: Exclude PREVIEW campaigns for live users
        if (!isDevelopment) {
          campaignQuery = campaignQuery.not('title', 'ilike', 'PREVIEW%');
        }

        const { data: currentWeekCampaigns, error: currentWeekError } = await campaignQuery.limit(1);

        if (currentWeekError) {
          console.error('❌ DashboardContent: Error fetching current week campaigns:', currentWeekError);
        } else if (currentWeekCampaigns && currentWeekCampaigns.length > 0) {
          const selectedCampaign = currentWeekCampaigns[0];
          console.log('✅ DashboardContent: Found current week campaign:', selectedCampaign.title, 'ID:', selectedCampaign.id);
          setActiveCampaign(selectedCampaign);
          
          // AUTO-GENERATE CONTENT if campaign exists but has no tasks
          await autoGenerateContentForCampaign(selectedCampaign, []);
          setLoading(false);
          return;
        }

        // If no current week campaign, try any recent campaign for this tenant
        console.log('🔍 DashboardContent: No current week campaign, searching for any recent campaign...');
        
        let fallbackQuery = supabase
          .from('campaigns')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('start_date', { ascending: false });

        if (!isDevelopment) {
          fallbackQuery = fallbackQuery.not('title', 'ilike', 'PREVIEW%');
        }

        const { data: campaigns, error: campaignError } = await fallbackQuery.limit(1);

        if (campaignError) {
          console.error('❌ DashboardContent: Error fetching fallback campaigns:', campaignError);
        } else {
          console.log('🔍 DashboardContent: Fallback search found campaigns:', campaigns?.length || 0);
          
          if (campaigns && campaigns.length > 0) {
            const selectedCampaign = campaigns[0];
            console.log('✅ DashboardContent: Selected fallback campaign:', selectedCampaign.title, 'ID:', selectedCampaign.id);
            setActiveCampaign(selectedCampaign);
            
            // AUTO-GENERATE CONTENT if campaign exists but has no tasks
            await autoGenerateContentForCampaign(selectedCampaign, []);
          } else {
            console.log('❌ DashboardContent: No campaigns found for tenant:', tenant.id);
            setActiveCampaign(undefined);
          }
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
        }
      );
    } catch (error) {
      console.error('DashboardContent: Error auto-generating content:', error);
    } finally {
      setGeneratingContent(false);
    }
  };

  useEffect(() => {
    console.log('🔍 DashboardContent: useEffect triggered, user:', user?.id, 'tenant:', tenant?.id);
    if (user && tenant && !tenantLoading) {
      fetchCampaignData();
    } else {
      console.log('🔍 DashboardContent: No user/tenant or tenant loading, skipping data fetch');
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
        tenant_id: activeCampaign.tenant_id
      } : null,
      tasksCount: tasks.length,
      loading,
      generatingContent,
      tenantId: tenant?.id
    });
  }, [activeCampaign, tasks, loading, generatingContent, tenant]);

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
