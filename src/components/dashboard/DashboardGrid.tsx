
import { AppleCard, AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { CustomCampaignsSection } from "@/components/dashboard/CustomCampaignsSection";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";

interface DashboardGridProps {
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

export const DashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCampaignDelete,
  onCreateCampaign,
  onTaskClick
}: DashboardGridProps) => {
  return (
    <div className="space-y-8">
      {/* Current Campaign Section */}
      <CurrentCampaignSection 
        activeCampaign={activeCampaign}
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
