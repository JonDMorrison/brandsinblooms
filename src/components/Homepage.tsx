
import { useState, useEffect } from "react";
import { TaskChecklist } from "@/components/TaskChecklist";
import { WelcomeSection } from "./homepage/WelcomeSection";
import { WeekCampaignCard } from "./homepage/WeekCampaignCard";
import { CampaignTasksCard } from "./homepage/CampaignTasksCard";
import { UpcomingContentCard } from "./homepage/UpcomingContentCard";
import { QuickActionsGrid } from "./homepage/QuickActionsGrid";
import { ContentPipelineCard } from "./homepage/ContentPipelineCard";
import { AnalyticsSnapshot } from "./homepage/AnalyticsSnapshot";
import { 
  getCurrentWeekCampaign,
  getUpcomingContent,
  getTasksForCampaign,
  getOverdueTasks,
  getCurrentWeekNumber
} from "./homepage/homepageUtils";
import { useAutoCampaignManager } from "./homepage/CampaignAutoManager";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onNavigateToCalendar: () => void;
  onTaskClick: (task: any) => void;
  campaigns: any[];
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const Homepage = ({ 
  onboardingData, 
  onNavigateToKanban, 
  onNavigateToCalendar,
  onTaskClick, 
  campaigns, 
  tasks, 
  onTaskUpdate 
}: HomepageProps) => {
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const { autoCreateCurrentWeekCampaign } = useAutoCampaignManager(campaigns, tasks, onTaskUpdate);

  // Auto-create current week campaign if none exists
  useEffect(() => {
    if (campaigns.length > 0) {
      autoCreateCurrentWeekCampaign();
    }
  }, [campaigns, tasks]);

  const currentCampaign = getCurrentWeekCampaign(campaigns);
  const campaignTasks = currentCampaign ? getTasksForCampaign(tasks, currentCampaign.id) : [];
  const overdueTasks = getOverdueTasks(tasks);
  const upcomingContent = getUpcomingContent(tasks);

  console.log('Rendering Homepage with:', {
    currentCampaign: currentCampaign?.title,
    campaignTasks: campaignTasks.length,
    requiredTypes: ['newsletter', 'instagram', 'facebook', 'email', 'video'],
    isGeneratingTasks
  });

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
            <CampaignTasksCard overdueTasks={overdueTasks} />
            <UpcomingContentCard 
              upcomingContent={upcomingContent} 
              onNavigateToCalendar={onNavigateToCalendar}
            />
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
