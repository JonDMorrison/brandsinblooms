
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";

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
  return (
    <div className="space-y-6">
      {/* Current Campaign Section with Quick Actions */}
      <CurrentCampaignSection 
        activeCampaign={activeCampaign}
        currentWeekNumber={currentWeekNumber}
        completedTasksCount={completedTasksCount}
        totalTasksCount={totalTasksCount}
        pendingTasksCount={pendingTasksCount}
        onTaskUpdate={onTaskUpdate}
        onCreateCampaign={onCreateCampaign}
        onCampaignCreated={onCampaignCreated}
        onTaskClick={onTaskClick}
      />

      {/* Custom Campaigns Section */}
      <CustomCampaignsSection 
        userCreatedCampaigns={userCreatedCampaigns}
        onTaskUpdate={onTaskUpdate}
        onCampaignUpdate={onCampaignUpdate}
        onCampaignDelete={onCampaignDelete}
      />
    </div>
  );
};
