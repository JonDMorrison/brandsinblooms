
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { WhatsComingNextCard } from "@/components/homepage/WhatsComingNextCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { AnalyticsSnapshot } from "@/components/homepage/AnalyticsSnapshot";
import { CurrentCampaignSection } from "./CurrentCampaignSection";
import { CustomCampaignsSection } from "./CustomCampaignsSection";
import type { Campaign, ContentTask } from "@/types";

interface DashboardGridProps {
  activeCampaign: Campaign | undefined;
  userCreatedCampaigns: Campaign[];
  tasks: ContentTask[];
  currentWeekNumber: number;
  completedTasksCount: number;
  totalTasksCount: number;
  pendingTasksCount: number;
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
  onCampaignUpdate: () => void;
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
  onCreateCampaign,
  onTaskClick
}: DashboardGridProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Current Campaign */}
        <CurrentCampaignSection
          activeCampaign={activeCampaign}
          currentWeekNumber={currentWeekNumber}
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onCampaignUpdate}
          onCreateCampaign={onCreateCampaign}
        />

        {/* Quick Actions */}
        <QuickActionsGrid onCampaignCreated={onCampaignCreated} />

        {/* Custom Campaigns */}
        <CustomCampaignsSection
          userCreatedCampaigns={userCreatedCampaigns}
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onCampaignUpdate}
        />
        
        {/* What's Coming Next */}
        <WhatsComingNextCard onTaskUpdate={onTaskUpdate} />
      </div>
      
      {/* Right Column - Sidebar */}
      <div className="space-y-6">
        {/* Ready to Post - Now the primary content review section */}
        <ReadyToPostCard tasks={tasks} onTaskClick={onTaskClick} />
        
        {/* Analytics Snapshot */}
        <AnalyticsSnapshot 
          totalTasks={totalTasksCount}
          completedTasks={completedTasksCount}
          pendingTasks={pendingTasksCount}
          activeCampaigns={activeCampaign ? 1 : 0}
        />
      </div>
    </div>
  );
};
