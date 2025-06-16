
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";
import { CurrentCampaignSection } from "./CurrentCampaignSection";
import { ContentPreviewGrid } from "./ContentPreviewGrid";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
import { ReviewQueueCard } from "@/components/content/ReviewQueueCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
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
  const [tasksCount, setTasksCount] = useState(0);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
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

          // Get task counts for the selected campaign
          const { data: tasks, error: tasksError } = await supabase
            .from('content_tasks')
            .select('*')
            .eq('campaign_id', selectedCampaign.id);

          if (tasksError) {
            console.error('DashboardContent: Error fetching tasks:', tasksError);
          } else if (tasks) {
            console.log('DashboardContent: Found tasks for campaign:', tasks.length);
            setTasksCount(tasks.length);
            setCompletedTasksCount(tasks.filter(t => t.status === 'completed' || t.status === 'posted').length);
            setPendingTasksCount(tasks.filter(t => t.status === 'pending' || t.status === 'generated').length);
          }
        } else {
          console.log('DashboardContent: No valid campaign selected');
          setActiveCampaign(undefined);
          setTasksCount(0);
          setCompletedTasksCount(0);
          setPendingTasksCount(0);
        }
      } else {
        console.log('DashboardContent: No campaigns found for week', currentWeekNumber);
        setActiveCampaign(undefined);
        setTasksCount(0);
        setCompletedTasksCount(0);
        setPendingTasksCount(0);
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
      setTasksCount(0);
      setCompletedTasksCount(0);
      setPendingTasksCount(0);
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Weekly Content Updater - runs automatically to maintain campaigns */}
      <WeeklyContentUpdater />
      
      {/* First Time User Welcome */}
      <FirstTimeUserWelcome 
        onGetStarted={handleGetStarted}
        tasksCount={tasksCount}
      />

      {/* Review Queue - Only show if there are tasks to review */}
      <ReviewQueueCard onTaskUpdate={handleTaskUpdate} />

      {/* Current Campaign Section */}
      <div data-campaign-section>
        <CurrentCampaignSection
          activeCampaign={activeCampaign}
          currentWeekNumber={currentWeekNumber}
          completedTasksCount={completedTasksCount}
          totalTasksCount={tasksCount}
          pendingTasksCount={pendingTasksCount}
          onTaskUpdate={handleTaskUpdate}
          onCreateCampaign={onCampaignCreated}
          onCampaignCreated={fetchCampaignData}
        />
      </div>

      {/* Ready to Post section - moved to be right after Current Campaign */}
      <ReadyToPostCard 
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
      />

      {/* Content Preview Grid */}
      {activeCampaign && (
        <ContentPreviewGrid 
          campaign={activeCampaign}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
};
