
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { BarChart3, Calendar, CheckCircle } from "lucide-react";

interface EnhancedDashboardGridProps {
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

export const EnhancedDashboardGrid = ({
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
}: EnhancedDashboardGridProps) => {
  return (
    <div className="space-y-8 apple-fade-in">
      {/* Overview Stats */}
      <ResponsiveGrid 
        cols={{ mobile: 1, tablet: 3, desktop: 3 }}
        gap={{ mobile: 4, tablet: 6, desktop: 6 }}
        animated={true}
      >
        <EnhancedAppleCard variant="default" surface="primary" hoverEffect="subtle">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl apple-hover-subtle">
                <Calendar className="w-5 h-5 text-primary apple-icon-bounce" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary apple-text-glow">Week {currentWeekNumber}</HeadlineLarge>
                <BodyMedium className="text-text-secondary apple-color-transition">Current period</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </EnhancedAppleCard>

        <EnhancedAppleCard variant="default" surface="primary" hoverEffect="subtle">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded-xl apple-hover-subtle">
                <CheckCircle className="w-5 h-5 text-success apple-icon-bounce" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary apple-text-glow">{completedTasksCount}</HeadlineLarge>
                <BodyMedium className="text-text-secondary apple-color-transition">Completed tasks</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </EnhancedAppleCard>

        <EnhancedAppleCard variant="default" surface="primary" hoverEffect="subtle">
          <AppleCardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-warning/10 rounded-xl apple-hover-subtle">
                <BarChart3 className="w-5 h-5 text-warning apple-icon-bounce" />
              </div>
              <div>
                <HeadlineLarge className="text-text-primary apple-text-glow">{pendingTasksCount}</HeadlineLarge>
                <BodyMedium className="text-text-secondary apple-color-transition">Pending tasks</BodyMedium>
              </div>
            </div>
          </AppleCardHeader>
        </EnhancedAppleCard>
      </ResponsiveGrid>

      {/* Current Campaign Section */}
      <div className="apple-slide-up">
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
      </div>

      {/* Ready To Post Section */}
      <div className="apple-slide-up apple-stagger-1">
        <ReadyToPostCard 
          tasks={tasks}
          onTaskClick={onTaskClick}
          onTaskUpdate={onTaskUpdate}
        />
      </div>

      {/* Custom Campaigns Section */}
      <div className="apple-slide-up apple-stagger-2">
        <CustomCampaignsSection 
          userCreatedCampaigns={userCreatedCampaigns}
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onCampaignUpdate}
          onCampaignDelete={onCampaignDelete}
          onCreateCampaign={onCreateCampaign}
        />
      </div>
    </div>
  );
};
