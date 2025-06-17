
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
        
        setTasks(userTasks);

        // STEP 2: If we have tasks, find the best campaign from those tasks
        if (userTasks.length > 0) {
          console.log('DashboardContent: Found tasks, extracting campaigns...');
          
          // Extract unique campaigns from tasks
          const campaignsFromTasks = userTasks.reduce((acc: Campaign[], task) => {
            if (task.campaigns && task.campaigns.id) {
              const existingCampaign = acc.find(c => c.id === task.campaigns.id);
              if (!existingCampaign) {
                // Convert the campaign data to match our Campaign type
                const campaign: Campaign = {
                  id: task.campaigns.id,
                  title: task.campaigns.title,
                  week_number: task.campaigns.week_number,
                  start_date: task.campaigns.start_date,
                  created_at: task.campaigns.created_at,
                  user_id: task.campaigns.user_id,
                  theme: task.campaigns.theme || null,
                  description: task.campaigns.description || null,
                  prompt: task.campaigns.prompt || null,
                  source: task.campaigns.source || 'system'
                };
                acc.push(campaign);
              }
            }
            return acc;
          }, []);

          console.log('DashboardContent: Extracted campaigns from tasks:', campaignsFromTasks.length);

          if (campaignsFromTasks.length > 0) {
            // Select the best campaign (prefer current week, then most recent with content)
            let selectedCampaign = campaignsFromTasks.find(c => c.week_number === currentWeekNumber);
            
            if (!selectedCampaign) {
              // Sort by creation date and pick the most recent
              campaignsFromTasks.sort((a, b) => 
                new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
              );
              selectedCampaign = campaignsFromTasks[0];
            }

            console.log('DashboardContent: Selected campaign from tasks:', selectedCampaign.title);
            setActiveCampaign(selectedCampaign);
            setLoading(false);
            return; // Exit early since we found our campaign
          }
        }
      }

      // STEP 3: Fallback - try to get campaigns for current week if no tasks were found
      console.log('DashboardContent: No tasks found, trying fallback campaign fetch...');
      
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
