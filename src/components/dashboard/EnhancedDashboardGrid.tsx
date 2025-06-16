
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";

interface EnhancedDashboardGridProps {
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

export const EnhancedDashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCampaignDelete,
  onCreateCampaign,
  onTaskClick
}: EnhancedDashboardGridProps) => {
  return (
    <div className="space-y-8 apple-fade-in">
      {/* Current Campaign Section */}
      <div className="apple-slide-up">
        <CurrentCampaignSection 
          activeCampaign={activeCampaign}
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
