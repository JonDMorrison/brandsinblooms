
import { useDashboardData } from "./useDashboardData";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { SetupProgressCard } from "@/components/homepage/SetupProgressCard";
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { TaskList } from "@/components/homepage/TaskList";
import { UpcomingContentCard } from "@/components/homepage/UpcomingContentCard";
import { AnalyticsSnapshot } from "@/components/homepage/AnalyticsSnapshot";
import { NextStepBanner } from "@/components/homepage/NextStepBanner";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
}: DashboardContentProps) => {
  const {
    campaigns,
    tasks,
    loading,
    handleTaskUpdate,
    handleCampaignCreated
  } = useDashboardData();

  const activeCampaign = campaigns.find(c => {
    const campaignStart = new Date(c.start_date);
    const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return now >= campaignStart && now <= campaignEnd;
  });

  const upcomingTasks = tasks
    .filter(task => task.status === 'draft')
    .slice(0, 5);

  const completedTasksCount = tasks.filter(task => task.status === 'completed').length;
  const totalTasksCount = tasks.length;

  return (
    <div className="p-6 space-y-6">
      <WelcomeSection 
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
      />

      <NextStepBanner 
        campaignsCount={campaigns.length}
        tasksCount={totalTasksCount}
        completedTasksCount={completedTasksCount}
        onCampaignCreated={() => {
          handleCampaignCreated();
          onCampaignCreated();
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SetupProgressCard 
            campaignsCount={campaigns.length}
            tasksCount={totalTasksCount}
            completedTasksCount={completedTasksCount}
          />
          
          <QuickActionsGrid onCampaignCreated={() => {
            handleCampaignCreated();
            onCampaignCreated();
          }} />
          
          {activeCampaign && (
            <CampaignCard 
              campaign={activeCampaign} 
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          
          <TaskList 
            tasks={upcomingTasks}
            onTaskUpdate={handleTaskUpdate}
          />
        </div>
        
        <div className="space-y-6">
          <UpcomingContentCard tasks={upcomingTasks} />
          <AnalyticsSnapshot 
            totalTasks={totalTasksCount}
            completedTasks={completedTasksCount}
            activeCampaigns={campaigns.filter(c => {
              const campaignStart = new Date(c.start_date);
              const campaignEnd = new Date(campaignStart.getTime() + 7 * 24 * 60 * 60 * 1000);
              const now = new Date();
              return now >= campaignStart && now <= campaignEnd;
            }).length}
          />
        </div>
      </div>
    </div>
  );
};
