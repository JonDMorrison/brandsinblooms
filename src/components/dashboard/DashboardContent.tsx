
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

  const selectBestCampaign = async (campaigns: Campaign[]) => {
    if (campaigns.length === 0) return null;
    if (campaigns.length === 1) return campaigns[0];

    console.log('DashboardContent: Multiple campaigns found, selecting best one:', campaigns.length);

    // For each campaign, check if it has content
    const campaignsWithContentCount = await Promise.all(
      campaigns.map(async (campaign) => {
        const { data: tasks } = await supabase
          .from('content_tasks')
          .select('id, ai_output')
          .eq('campaign_id', campaign.id);

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

    // Clean up other campaigns in background (don't await)
    const campaignsToCleanup = campaignsWithContentCount.slice(1).filter(c => !c.hasContent);
    if (campaignsToCleanup.length > 0) {
      console.log('DashboardContent: Cleaning up', campaignsToCleanup.length, 'empty duplicate campaigns');
      campaignsToCleanup.forEach(async ({ campaign }) => {
        try {
          await supabase.from('content_tasks').delete().eq('campaign_id', campaign.id);
          await supabase.from('campaigns').delete().eq('id', campaign.id);
          console.log('DashboardContent: Cleaned up empty campaign:', campaign.title);
        } catch (error) {
          console.error('DashboardContent: Error cleaning up campaign:', error);
        }
      });
    }

    return selectedCampaign;
  };

  const fetchCampaignData = async () => {
    if (!user) return;

    try {
      console.log('DashboardContent: Fetching campaign data for user:', user.id, 'week:', currentWeekNumber);

      // Get all campaigns for current week and user, ordered by creation date
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
        // Use smart campaign selection
        const selectedCampaign = await selectBestCampaign(campaigns);
        
        if (selectedCampaign) {
          console.log('DashboardContent: Selected campaign:', selectedCampaign.title, 'ID:', selectedCampaign.id);
          setActiveCampaign(selectedCampaign);
        } else {
          console.log('DashboardContent: No valid campaign selected');
          setActiveCampaign(undefined);
        }
      } else {
        console.log('DashboardContent: No campaigns found for week', currentWeekNumber);
        setActiveCampaign(undefined);
      }

      // Fetch all tasks for ready to post and review queue
      const { data: allTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (allTasksError) {
        console.error('DashboardContent: Error fetching all tasks:', allTasksError);
      } else {
        setTasks(allTasks || []);
      }
    } catch (error) {
      console.error('DashboardContent: Error in fetchCampaignData:', error);
      // Set empty state on error
      setActiveCampaign(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();
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
