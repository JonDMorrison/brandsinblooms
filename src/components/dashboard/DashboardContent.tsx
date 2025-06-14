
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { FirstTimeUserWelcome } from "./FirstTimeUserWelcome";
import { CurrentCampaignSection } from "./CurrentCampaignSection";
import { QuickStatsSection } from "./QuickStatsSection";
import { ContentPreviewGrid } from "./ContentPreviewGrid";
import { WeeklyContentUpdater } from "./current-campaign/WeeklyContentUpdater";
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
  const [tasksCount, setTasksCount] = useState(0);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentWeekNumber = getCurrentWeekNumber();

  const fetchCampaignData = async () => {
    if (!user) return;

    try {
      console.log('Fetching campaign data for user:', user.id, 'week:', currentWeekNumber);

      // Get current week campaign - handle multiple campaigns by selecting the most recent one
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('week_number', currentWeekNumber)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignError) {
        console.error('Error fetching campaigns:', campaignError);
        throw campaignError;
      }

      // Select the most recent campaign if multiple exist
      const currentCampaign = campaigns && campaigns.length > 0 ? campaigns[0] : null;
      
      console.log('Found campaigns:', campaigns?.length || 0, 'selected:', currentCampaign?.title);
      setActiveCampaign(currentCampaign);

      // Get task counts - need to join with campaigns to filter by user
      if (currentCampaign) {
        const { data: tasks, error: tasksError } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('campaign_id', currentCampaign.id);

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
        } else if (tasks) {
          console.log('Found tasks for campaign:', tasks.length);
          setTasksCount(tasks.length);
          setCompletedTasksCount(tasks.filter(t => t.status === 'completed' || t.status === 'posted').length);
          setPendingTasksCount(tasks.filter(t => t.status === 'pending' || t.status === 'generated').length);
        }
      } else {
        // No active campaign, reset counts
        console.log('No active campaign found, resetting counts');
        setTasksCount(0);
        setCompletedTasksCount(0);
        setPendingTasksCount(0);
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignData();
  }, [user, currentWeekNumber]);

  const handleTaskUpdate = () => {
    console.log('Task update triggered, refetching campaign data');
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
          <p className="text-gray-600">Loading your garden center content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Weekly Content Updater - runs automatically to fix Week 24 */}
      <WeeklyContentUpdater />
      
      {/* First Time User Welcome */}
      <FirstTimeUserWelcome 
        onGetStarted={handleGetStarted}
        tasksCount={tasksCount}
      />

      {/* Quick Stats */}
      <QuickStatsSection 
        totalTasks={tasksCount}
        completedTasks={completedTasksCount}
        pendingTasks={pendingTasksCount}
        activeCampaigns={activeCampaign ? 1 : 0}
      />

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
