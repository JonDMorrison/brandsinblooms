
import { AppleCard, AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { BarChart3, Calendar, CheckCircle } from "lucide-react";

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
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AppleCard variant="default" surface="primary">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary">Week {currentWeekNumber}</HeadlineLarge>
                <BodyMedium className="text-text-secondary">Current period</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </AppleCard>

        <AppleCard variant="default" surface="primary">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded-xl">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary">{completedTasksCount}</HeadlineLarge>
                <BodyMedium className="text-text-secondary">Completed tasks</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </AppleCard>

        <AppleCard variant="default" surface="primary">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-warning/10 rounded-xl">
                <BarChart3 className="w-5 h-5 text-warning" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary">{pendingTasksCount}</HeadlineLarge>
                <BodyMedium className="text-text-secondary">Pending tasks</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </AppleCard>
      </div>

      {/* Current Campaign Section */}
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

      {/* Ready To Post Section */}
      <ReadyToPostCard 
        tasks={tasks}
        onTaskClick={onTaskClick}
        onTaskUpdate={onTaskUpdate}
      />

      {/* Custom Campaigns Section */}
      <CustomCampaignsSection 
        userCreatedCampaigns={userCreatedCampaigns}
        onTaskUpdate={onTaskUpdate}
        onCampaignUpdate={onCampaignUpdate}
        onCampaignDelete={onCampaignDelete}
        onCreateCampaign={onCreateCampaign}
      />
    </div>
  );
};
