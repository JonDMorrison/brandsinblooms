import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TaskChecklist } from "@/components/TaskChecklist";
import { WelcomeSection } from "./homepage/WelcomeSection";
import { NextStepBanner } from "./homepage/NextStepBanner";
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
  getNextStepGuidance,
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
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick, campaigns, tasks }: HomepageProps) => {
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  const generateSampleTasks = async (campaignId: string) => {
    setIsGeneratingTasks(true);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      const today = new Date();
      const seasonalContent = getSeasonalContent();
      
      // Generate 4 tasks spread throughout the current week using today as the starting point
      const sampleTasks = seasonalContent.posts.map((post, index) => {
        const scheduledDate = new Date(today);
        // Spread posts across the week: today, +1 day, +3 days, +5 days
        scheduledDate.setDate(today.getDate() + index + (index > 0 ? index : 0));
        
        return {
          campaign_id: campaignId,
          post_type: post.type,
          status: index === 0 ? 'review' : index === 1 ? 'generating' : 'planned',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: index === 0 ? post.content : null, // Only first post has content ready
          hashtags: post.hashtags,
          image_idea: post.imageIdea
        };
      });

      // Insert tasks into the database
      for (const task of sampleTasks) {
        const { error } = await supabase
          .from('content_tasks')
          .insert(task);
        
        if (error) {
          console.error('Error creating task:', error);
        }
      }

      // Refresh the page to show new tasks
      window.location.reload();
      
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const currentCampaign = getCurrentWeekCampaign(campaigns);
  const campaignTasks = currentCampaign ? getTasksForCampaign(tasks, currentCampaign.id) : [];
  const overdueTasks = getOverdueTasks(tasks);
  const nextStep = getNextStepGuidance(campaigns, tasks, currentCampaign);
  const setupProgress = getSetupProgress(onboardingData, campaigns, tasks);
  const upcomingContent = getUpcomingContent(tasks);

  const handleNextStepAction = () => {
    if (nextStep.action === "Generate Content" && currentCampaign) {
      generateSampleTasks(currentCampaign.id);
    }
  };

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <WelcomeSection />

        <NextStepBanner 
          nextStep={nextStep}
          isGeneratingTasks={isGeneratingTasks}
          onActionClick={handleNextStepAction}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* This Week's Campaign - Spans 2 columns */}
          <div className="lg:col-span-2">
            <WeekCampaignCard
              currentCampaign={currentCampaign}
              campaignTasks={campaignTasks}
              isGeneratingTasks={isGeneratingTasks}
              onTaskClick={onTaskClick}
              onGenerateTasks={generateSampleTasks}
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

        <AnalyticsSnapshot />
      </div>
    </div>
  );
};
