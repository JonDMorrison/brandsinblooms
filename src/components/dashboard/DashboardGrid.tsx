import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { UpcomingTasksSection } from "@/components/dashboard/UpcomingTasksSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";

interface DashboardGridProps {
  activeCampaign: any;
  userCreatedCampaigns: any[];
  tasks: any[];
  currentWeekNumber: number;
  completedTasksCount: number;
  totalTasksCount: number;
  pendingTasksCount: number;
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
  onCampaignUpdate: () => void;
  onCampaignDelete?: (campaignId: string) => void;
  onCreateCampaign: () => void;
  onTaskClick?: (task: any) => void;
}

export const DashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  currentWeekNumber,
  completedTasksCount,
  totalTasksCount,
  pendingTasksCount,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCampaignDelete,
  onCreateCampaign,
  onTaskClick
}: DashboardGridProps) => {
  const upcomingTasks = tasks.filter(task => task.status !== 'completed').slice(0, 5);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Current Campaign Section */}
        <CurrentCampaignSection 
          activeCampaign={activeCampaign}
          currentWeekNumber={currentWeekNumber}
          completedTasksCount={completedTasksCount}
          totalTasksCount={totalTasksCount}
          pendingTasksCount={pendingTasksCount}
          onTaskUpdate={onTaskUpdate}
          onCreateCampaign={onCreateCampaign}
          onTaskClick={onTaskClick}
        />

        {/* Upcoming Tasks Section */}
        <UpcomingTasksSection 
          upcomingTasks={upcomingTasks} 
          onTaskUpdate={onTaskUpdate} 
          onTaskClick={onTaskClick}
        />
      </div>

      {/* Right Column */}
      <div className="lg:col-span-1 space-y-6">
        {/* Quick Actions Section */}
        <QuickActionsSection 
          onCampaignCreated={onCampaignCreated} 
        />

        {/* Custom Campaigns Section */}
        <CustomCampaignsSection 
          userCreatedCampaigns={userCreatedCampaigns}
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onCampaignUpdate}
          onCampaignDelete={onCampaignDelete}
        />
      </div>
    </div>
  );
};
