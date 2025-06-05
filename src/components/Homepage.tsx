
import { useState, useEffect } from "react";
import { TaskChecklist } from "@/components/TaskChecklist";
import { WelcomeSection } from "./homepage/WelcomeSection";
import { WeekCampaignCard } from "./homepage/WeekCampaignCard";
import { CampaignTasksCard } from "./homepage/CampaignTasksCard";
import { UpcomingContentCard } from "./homepage/UpcomingContentCard";
import { QuickActionsGrid } from "./homepage/QuickActionsGrid";
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

        {/* This Week's Campaign - Full Width */}
        <div className="w-full">
          <WeekCampaignCard
            currentCampaign={currentCampaign}
            campaignTasks={campaignTasks}
            isGeneratingTasks={isGeneratingTasks || isCreatingCampaign}
            onTaskClick={onTaskClick}
            onTaskUpdate={onTaskUpdate}
          />
        </div>

        {/* Secondary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CampaignTasksCard overdueTasks={overdueTasks} />
          <UpcomingContentCard 
            upcomingContent={upcomingContent} 
            onNavigateToCalendar={onNavigateToCalendar}
          />
        </div>

        <QuickActionsGrid />

        {/* Task Checklist - Full width */}
        <div className="w-full">
          <TaskChecklist 
            campaignTitle={currentCampaign?.title}
            weekNumber={getCurrentWeekNumber()}
          />
        </div>

        <AnalyticsSnapshot campaigns={campaigns} tasks={tasks} />
      </div>
    </div>
  );
};
