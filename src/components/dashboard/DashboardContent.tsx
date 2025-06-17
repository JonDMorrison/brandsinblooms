
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { BodyMedium } from "@/components/ui/typography";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EnhancedDashboardGrid } from "./EnhancedDashboardGrid";
import type { Campaign } from "@/types";

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
  const [activeCampaign, setActiveCampaign] = useState<Campaign | undefined>();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentWeekNumber = getCurrentWeekNumber();

  console.log('DashboardContent: Rendering with user:', user?.id);

  const findCampaignForTasks = async (allTasks: any[]) => {
    if (allTasks.length === 0) return null;

    console.log('DashboardContent: Finding campaign for', allTasks.length, 'tasks');

    // Get unique campaign IDs from tasks
    const campaignIds = [...new Set(allTasks.map(task => task.campaign_id).filter(Boolean))];
    console.log('DashboardContent: Found campaign IDs in tasks:', campaignIds);

    if (campaignIds.length === 0) return null;

    // Fetch campaigns for these IDs
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .in('id', campaignIds)
      .eq('user_id', user?.id);

    if (error) {
      console.error('DashboardContent: Error fetching campaigns by IDs:', error);
      return null;
    }

    console.log('DashboardContent: Found campaigns for tasks:', campaigns?.length || 0);

    if (!campaigns || campaigns.length === 0) return null;

    // Prefer current week campaign, otherwise pick the most recent
    const currentWeekCampaign = campaigns.find(c => c.week_number === currentWeekNumber);
    if (currentWeekCampaign) {
      console.log('DashboardContent: Selected current week campaign:', currentWeekCampaign.title);
      return currentWeekCampaign;
    }

    // Sort by creation date and pick the most recent
    const sortedCampaigns = campaigns.sort((a, b) => 
      new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
    );
    
    const selectedCampaign = sortedCampaigns[0];
    console.log('DashboardContent: Selected most recent campaign:', selectedCampaign.title);
    return selectedCampaign;
  };

  const selectBestCampaign = async (campaigns: Campaign[]) => {
    if (campaigns.length === 0) return null;
    if (campaigns.length === 1) return campaigns[0];

    console.log('DashboardContent: Multiple campaigns found, selecting best one:', campaigns.length);

    // For each campaign, check if it has content (with user filtering)
    const campaignsWithContentCount = await Promise.all(
      campaigns.map(async (campaign) => {
        // SECURITY FIX: Add user verification to task counting
        const { data: tasks } = await supabase
          .from('content_tasks')
          .select(`
            id, 
            ai_output,
            campaigns!inner (
              user_id
            )
          `)
          .eq('campaign_id', campaign.id)
          .eq('campaigns.user_id', user?.id);

        const tasksWithContent = tasks?.filter(task => task.ai_output && task.ai_output.trim() !== '') || [];
        
        return {
          campaign,
          taskCount: tasks?.length || 0,
          contentCount: tasksWithContent.length,
          hasContent: tasksWithContent.length > 0
        };
      })
    );

    // Sort by: 1) has content, 2) content count, 3) task count, 4) most recent
    campaignsWithContentCount.sort((a, b) => {
      if (a.hasContent !== b.hasContent) return b.hasContent ? 1 : -1;
      if (a.contentCount !== b.contentCount) return b.contentCount - a.contentCount;
      if (a.taskCount !== b.taskCount) return b.taskCount - a.taskCount;
      return new Date(b.campaign.created_at || '').getTime() - new Date(a.campaign.created_at || '').getTime();
    });

    const selectedCampaign = campaignsWithContentCount[0].campaign;
    console.log('DashboardContent: Selected campaign with content:', selectedCampaign.title, 'Content count:', campaignsWithContentCount[0].contentCount);

    // Clean up other campaigns in background (don't await) - with user verification
    const campaignsToCleanup = campaignsWithContentCount.slice(1).filter(c => !c.hasContent);
    if (campaignsToCleanup.length > 0) {
      console.log('DashboardContent: Cleaning up', campaignsToCleanup.length, 'empty duplicate campaigns');
      campaignsToCleanup.forEach(async ({ campaign }) => {
        try {
          // SECURITY FIX: Only delete campaigns that belong to the current user
          if (campaign.user_id === user?.id) {
            await supabase.from('content_tasks').delete().eq('campaign_id', campaign.id);
            await supabase.from('campaigns').delete().eq('id', campaign.id).eq('user_id', user.id);
            console.log('DashboardContent: Cleaned up empty campaign:', campaign.title);
          }
        } catch (error) {
          console.error('DashboardContent: Error cleaning up campaign:', error);
        }
      });
    }

    return selectedCampaign;
  };

  const fetchCampaignData = async () => {
    if (!user) {
      console.log('DashboardContent: No authenticated user, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('DashboardContent: Fetching campaign data for user:', user.id, 'week:', currentWeekNumber);

      // SECURITY FIX: Fetch all tasks for user first to understand what content exists
      const { data: allTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            user_id,
            id,
            week_number,
            created_at
          )
        `)
        .eq('campaigns.user_id', user.id)
        .order('created_at', { ascending: false });

      if (allTasksError) {
        console.error('DashboardContent: Error fetching all tasks:', allTasksError);
        setTasks([]);
      } else {
        console.log('DashboardContent: Successfully fetched', allTasks?.length || 0, 'tasks for user', user.id);
        
        // Additional security verification
        const userTasks = allTasks?.filter(task => 
          task.campaigns && task.campaigns.user_id === user.id
        ) || [];
        
        if (userTasks.length !== allTasks?.length) {
          console.warn('DashboardContent: Security alert - some tasks did not belong to current user');
        }
        
        setTasks(userTasks);

        // Now find the best campaign for these tasks
        if (userTasks.length > 0) {
          const campaignForTasks = await findCampaignForTasks(userTasks);
          if (campaignForTasks) {
            console.log('DashboardContent: Setting active campaign from tasks:', campaignForTasks.title);
            setActiveCampaign(campaignForTasks);
            return; // Exit early since we found a campaign
          }
        }
      }

      // Fallback: Try to get campaigns for current week if no tasks were found
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('week_number', currentWeekNumber)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignError) {
        console.error('DashboardContent: Error fetching campaigns:', campaignError);
        throw campaignError;
      }

      console.log('DashboardContent: Found campaigns for week', currentWeekNumber, ':', campaigns?.length || 0);
      
      if (campaigns && campaigns.length > 0) {
        console.log('DashboardContent: Campaign details:', campaigns.map(c => ({
          id: c.id,
          title: c.title,
          user_id: c.user_id,
          week_number: c.week_number
        })));
        
        // Use smart campaign selection only if we don't already have a campaign from tasks
        if (!activeCampaign) {
          const selectedCampaign = await selectBestCampaign(campaigns);
          
          if (selectedCampaign) {
            console.log('DashboardContent: Selected fallback campaign:', {
              id: selectedCampaign.id,
              title: selectedCampaign.title,
              user_id: selectedCampaign.user_id,
              hasUserId: !!selectedCampaign.user_id
            });
            setActiveCampaign(selectedCampaign);
          } else {
            console.log('DashboardContent: No valid campaign selected');
            setActiveCampaign(undefined);
          }
        }
      } else {
        console.log('DashboardContent: No campaigns found for week', currentWeekNumber);
        if (!activeCampaign) {
          setActiveCampaign(undefined);
        }
      }

    } catch (error) {
      console.error('DashboardContent: Error in fetchCampaignData:', error);
      // Set empty state on error
      if (!activeCampaign) {
        setActiveCampaign(undefined);
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('DashboardContent: useEffect triggered, user:', user?.id);
    if (user) {
      fetchCampaignData();
    } else {
      console.log('DashboardContent: No user authenticated, skipping data fetch');
      setLoading(false);
    }
  }, [user, currentWeekNumber]);

  const handleTaskUpdate = () => {
    console.log('DashboardContent: Task update triggered, refetching campaign data');
    fetchCampaignData();
  };

  const handleGetStarted = () => {
    // Scroll to current campaign section or trigger content viewer
    const campaignSection = document.querySelector('[data-campaign-section]');
    if (campaignSection) {
      campaignSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Early return if no authenticated user
  if (!user) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md"
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

  if (loading) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md"
        animated={true}
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <BodyMedium className="text-text-secondary mt-4">
            Loading your content...
          </BodyMedium>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  console.log('DashboardContent: Rendering dashboard with activeCampaign:', activeCampaign?.title, 'tasks:', tasks.length);

  return (
    <div className="space-y-8 mobile-dashboard-spacing">
      {/* Weekly Content Updater - runs automatically to maintain campaigns */}
      <WeeklyContentUpdater />
      
      {/* First Time User Welcome */}
      <FirstTimeUserWelcome 
        onGetStarted={handleGetStarted}
        tasksCount={tasks.length}
      />

      {/* Enhanced Dashboard Grid - Main dashboard sections */}
      <EnhancedDashboardGrid
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
