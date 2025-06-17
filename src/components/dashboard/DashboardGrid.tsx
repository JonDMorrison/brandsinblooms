
import { UnifiedDashboardGrid } from "./UnifiedDashboardGrid";

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

// This component now acts as a wrapper to ensure backward compatibility
// while using the unified dashboard implementation
export const DashboardGrid = (props: DashboardGridProps) => {
  return <UnifiedDashboardGrid {...props} />;
};
