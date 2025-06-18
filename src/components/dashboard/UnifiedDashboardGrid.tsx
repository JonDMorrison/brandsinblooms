
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { ReviewQueueCard } from "@/components/content/ReviewQueueCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";

interface UnifiedDashboardGridProps {
  activeCampaign: any;
  userCreatedCampaigns: any[];
  tasks: any[];
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
  onCampaignUpdate: () => void;
  onCampaignDelete?: (campaignId: string) => void;
  onCreateCampaign: () => void;
  onTaskClick?: (task: any) => void;
}

export const UnifiedDashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCampaignDelete,
  onCreateCampaign,
  onTaskClick
}: UnifiedDashboardGridProps) => {
  return (
    <div className="space-y-6 apple-fade-in">
      {/* Hero Section - 8fr/4fr Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main Campaign Content - 8 columns */}
        <div className="col-span-12 lg:col-span-8 apple-slide-up">
          <CurrentCampaignSection 
            activeCampaign={activeCampaign}
            onTaskUpdate={onTaskUpdate}
            onCreateCampaign={onCreateCampaign}
            onCampaignCreated={onCampaignCreated}
            onTaskClick={onTaskClick}
          />
        </div>

        {/* Quick Actions Sidebar - 4 columns */}
        <div className="col-span-12 lg:col-span-4 apple-slide-up apple-stagger-1">
          <QuickActionsGrid 
            onCampaignCreated={onCampaignCreated}
          />
        </div>
      </div>

      {/* Content Management Section - Full Width Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Content Review - 8 columns */}
        <div className="col-span-12 lg:col-span-8 apple-slide-up apple-stagger-2">
          <ReviewQueueCard 
            onTaskUpdate={onTaskUpdate}
            onTaskClick={onTaskClick}
          />
        </div>

        {/* Ready To Post - 4 columns */}
        <div className="col-span-12 lg:col-span-4 apple-slide-up apple-stagger-3">
          <ReadyToPostCard 
            tasks={tasks}
            onTaskClick={onTaskClick}
            onTaskUpdate={onTaskUpdate}
          />
        </div>
      </div>

      {/* Custom Campaigns Section - Full Width when present */}
      {userCreatedCampaigns && userCreatedCampaigns.length > 0 && (
        <div className="apple-slide-up apple-stagger-4">
          <CustomCampaignsSection 
            userCreatedCampaigns={userCreatedCampaigns}
            onTaskUpdate={onTaskUpdate}
            onCampaignUpdate={onCampaignUpdate}
            onCampaignDelete={onCampaignDelete}
            onCreateCampaign={onCreateCampaign}
          />
        </div>
      )}
    </div>
  );
};
