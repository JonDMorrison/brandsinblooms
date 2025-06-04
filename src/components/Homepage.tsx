
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TaskChecklist } from "@/components/TaskChecklist";
import { WelcomeSection } from "./homepage/WelcomeSection";
import { WeekCampaignCard } from "./homepage/WeekCampaignCard";
import { SetupProgressCard } from "./homepage/SetupProgressCard";
import { CampaignTasksCard } from "./homepage/CampaignTasksCard";
import { UpcomingContentCard } from "./homepage/UpcomingContentCard";
import { QuickActionsGrid } from "./homepage/QuickActionsGrid";
import { ContentPipelineCard } from "./homepage/ContentPipelineCard";
import { AnalyticsSnapshot } from "./homepage/AnalyticsSnapshot";
import { getSeasonalContent } from "./homepage/SeasonalContent";
import { 
  getCurrentWeekCampaign,
  getSetupProgress,
  getUpcomingContent,
  getTasksForCampaign,
  getOverdueTasks,
  getCurrentWeekNumber
} from "./homepage/homepageUtils";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
  campaigns: any[];
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick, campaigns, tasks, onTaskUpdate }: HomepageProps) => {
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Auto-create current week campaign if none exists
  useEffect(() => {
    const autoCreateCurrentWeekCampaign = async () => {
      let currentCampaign = getCurrentWeekCampaign(campaigns);
      
      // If no current campaign exists, create one for this week
      if (!currentCampaign && campaigns.length >= 0) {
        setIsCreatingCampaign(true);
        
        try {
          const today = new Date();
          const weekNumber = getCurrentWeekNumber();
          const seasonalContent = getSeasonalContent();
          
          // Create a new campaign for the current week
          const { data: newCampaign, error } = await supabase
            .from('campaigns')
            .insert({
              title: seasonalContent.theme,
              week_number: weekNumber,
              start_date: today.toISOString().split('T')[0],
              prompt: `Weekly campaign for ${seasonalContent.theme} - Week ${weekNumber}`
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating campaign:', error);
          } else {
            console.log('Created new current week campaign:', newCampaign);
            // Update the campaigns list and set as current
            if (onTaskUpdate) {
              onTaskUpdate();
            }
            currentCampaign = newCampaign;
          }
        } catch (error) {
          console.error('Error creating current week campaign:', error);
        } finally {
          setIsCreatingCampaign(false);
        }
      }

      // Auto-generate content tasks for campaigns that don't have any
      if (currentCampaign) {
        const campaignTasks = getTasksForCampaign(tasks, currentCampaign.id);
        if (campaignTasks.length === 0) {
          await generateSampleTasks(currentCampaign.id.toString());
        }
      }
    };

    autoCreateCurrentWeekCampaign();
  }, [campaigns, tasks]);

  const generateSampleTasks = async (campaignId: string) => {
    setIsGeneratingTasks(true);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      // Check if tasks already exist for this campaign to prevent duplicates
      const existingTasks = getTasksForCampaign(tasks, campaignId);
      if (existingTasks.length > 0) {
        console.log('Tasks already exist for this campaign, skipping generation');
        return;
      }

      const today = new Date();
      const seasonalContent = getSeasonalContent();
      
      console.log('Seasonal content structure:', seasonalContent);
      
      // Generate exactly 4 tasks - one for each required type
      const requiredTypes = ['instagram', 'facebook', 'email', 'newsletter'];
      const sampleTasks = requiredTypes.map((postType, index) => {
        const scheduledDate = new Date(today);
        // Spread posts across the week: today, +1 day, +3 days, +5 days
        scheduledDate.setDate(today.getDate() + index + (index > 0 ? index : 0));
        
        // Find the matching content for this post type
        const postContent = seasonalContent.posts.find(post => post.type === postType);
        
        console.log(`Finding content for ${postType}:`, postContent);
        
        return {
          campaign_id: campaignId,
          post_type: postType,
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: postContent?.content || `Generated ${postType} content for this week's campaign - seasonal content will be added here automatically`,
          hashtags: postContent?.hashtags || `#${postType} #WeeklyCampaign #SeasonalContent`,
          image_idea: postContent?.imageIdea || `${postType} post image idea`
        };
      });

      console.log('Auto-generating tasks with proper content mapping:', sampleTasks);

      // Insert tasks into the database in a single batch to prevent duplicates
      const { data, error } = await supabase
        .from('content_tasks')
        .insert(sampleTasks)
        .select();
      
      if (error) {
        console.error('Error creating tasks:', error);
      } else {
        console.log('Tasks created successfully:', data);
      }

      // Refresh the page to show new tasks
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const currentCampaign = getCurrentWeekCampaign(campaigns);
  const campaignTasks = currentCampaign ? getTasksForCampaign(tasks, currentCampaign.id) : [];
  const overdueTasks = getOverdueTasks(tasks);
  const setupProgress = getSetupProgress(onboardingData, campaigns, tasks);
  const upcomingContent = getUpcomingContent(tasks);

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <WelcomeSection />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* This Week's Campaign - Spans 2 columns */}
          <div className="lg:col-span-2">
            <WeekCampaignCard
              currentCampaign={currentCampaign}
              campaignTasks={campaignTasks}
              isGeneratingTasks={isGeneratingTasks || isCreatingCampaign}
              onTaskClick={onTaskClick}
              onTaskUpdate={onTaskUpdate}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <SetupProgressCard setupProgress={setupProgress} />
            <CampaignTasksCard overdueTasks={overdueTasks} />
            <UpcomingContentCard upcomingContent={upcomingContent} />
          </div>
        </div>

        <QuickActionsGrid />

        {/* Task Checklist and Workflow Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <TaskChecklist 
              campaignTitle={currentCampaign?.title}
              weekNumber={getCurrentWeekNumber()}
            />
          </div>
          
          <div>
            <ContentPipelineCard
              tasks={tasks}
              onNavigateToKanban={onNavigateToKanban}
              onTaskClick={onTaskClick}
            />
          </div>
        </div>

        <AnalyticsSnapshot campaigns={campaigns} tasks={tasks} />
      </div>
    </div>
  );
};
