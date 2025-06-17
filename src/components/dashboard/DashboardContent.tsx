
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

  const fetchCampaignData = async () => {
    if (!user) {
      console.log('DashboardContent: No authenticated user, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('DashboardContent: Fetching campaign data for user:', user.id, 'week:', currentWeekNumber);

      // STEP 1: Fetch all tasks for user first to understand what content exists
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
            source
          )
        `)
        .eq('campaigns.user_id', user.id)
        .order('created_at', { ascending: false });

      if (allTasksError) {
        console.error('DashboardContent: Error fetching all tasks:', allTasksError);
        setTasks([]);
      } else {
        console.log('DashboardContent: Successfully fetched', allTasks?.length || 0, 'tasks for user', user.id);
        
        // Security verification
        const userTasks = allTasks?.filter(task => 
          task.campaigns && task.campaigns.user_id === user.id
        ) || [];
        
        console.log('DashboardContent: After security filter:', userTasks.length, 'tasks');
        setTasks(userTasks);

        // STEP 2: Find campaign from tasks if they exist
        if (userTasks.length > 0) {
          console.log('DashboardContent: Found tasks, extracting campaign...');
          
          // Get the campaign from the first task (they should all belong to the same campaign for current week)
          const firstTask = userTasks[0];
          console.log('DashboardContent: First task campaign data:', firstTask.campaigns);
          
          if (firstTask.campaigns) {
            // Convert the campaign data to match our Campaign type
            const campaign: Campaign = {
              id: firstTask.campaigns.id,
              title: firstTask.campaigns.title,
              week_number: firstTask.campaigns.week_number,
              start_date: firstTask.campaigns.start_date,
              created_at: firstTask.campaigns.created_at,
              user_id: firstTask.campaigns.user_id,
              theme: firstTask.campaigns.theme || null,
              description: firstTask.campaigns.description || null,
              prompt: firstTask.campaigns.prompt || null,
              source: firstTask.campaigns.source || 'system'
            };

            console.log('DashboardContent: Setting activeCampaign to:', campaign);
            setActiveCampaign(campaign);
            setLoading(false);
            return; // Exit early since we found our campaign
          }
        }

        // STEP 3: If no tasks found, try to get campaigns for current week
        console.log('DashboardContent: No tasks with campaigns found, trying fallback...');
        
        const { data: campaigns, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (campaignError) {
          console.error('DashboardContent: Error fetching campaigns:', campaignError);
        } else {
          console.log('DashboardContent: Fallback found campaigns for week', currentWeekNumber, ':', campaigns?.length || 0);
          
          if (campaigns && campaigns.length > 0) {
            const selectedCampaign = campaigns[0]; // Take the most recent
            console.log('DashboardContent: Selected fallback campaign:', selectedCampaign.title);
            setActiveCampaign(selectedCampaign);
          } else {
            console.log('DashboardContent: No campaigns found for week', currentWeekNumber);
            setActiveCampaign(undefined);
          }
        }
      }

    } catch (error) {
      console.error('DashboardContent: Error in fetchCampaignData:', error);
      setActiveCampaign(undefined);
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

  // Debug logging for final state
  useEffect(() => {
    console.log('DashboardContent: Final state update:', {
      activeCampaign: activeCampaign ? {
        id: activeCampaign.id,
        title: activeCampaign.title,
        week_number: activeCampaign.week_number
      } : null,
      tasksCount: tasks.length,
      loading
    });
  }, [activeCampaign, tasks, loading]);

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

  console.log('DashboardContent: Final render state - activeCampaign:', activeCampaign?.title, 'tasks:', tasks.length);

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
