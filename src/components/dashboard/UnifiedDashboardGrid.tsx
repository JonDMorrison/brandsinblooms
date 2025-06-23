import { CurrentCampaignSection } from "./current-campaign/CurrentCampaignSection";
import { CustomContentSection } from "./CustomContentSection";
import { QuickActionsSection } from "./QuickActionsSection";
import { EnhancedSeasonalHolidaysCard } from "./SeasonalMarketingGrid";
import { useIsMobile } from "@/hooks/use-mobile";

interface UnifiedDashboardGridProps {
  activeCampaign: any;
  userCreatedCampaigns: any[];
  tasks: any[];
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
  onCampaignUpdate: () => void;
  onCreateCampaign: () => void;
}

export const UnifiedDashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCreateCampaign
}: UnifiedDashboardGridProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="w-full space-y-6">
      {/* Current Campaign Section */}
      <div data-campaign-section>
        <CurrentCampaignSection
          activeCampaign={activeCampaign}
          tasks={tasks}
          onTaskUpdate={onTaskUpdate}
          onCreateCampaign={onCreateCampaign}
          onCampaignCreated={onCampaignCreated}
        />
      </div>

      {/* Custom Campaigns Section */}
      {userCreatedCampaigns.length > 0 && (
        <CustomContentSection
          campaigns={userCreatedCampaigns}
          tasks={tasks}
          onCampaignUpdate={onCampaignUpdate}
          onTaskUpdate={onTaskUpdate}
        />
      )}

      {/* Seasonal Marketing Section with improved styling */}
      <section className="seasonal-section card-shadow">
        <EnhancedSeasonalHolidaysCard
          onHolidayGenerate={(holiday) => {
            console.log('Holiday content generation requested for:', holiday);
          }}
        />
      </section>

      {/* Quick Actions Grid */}
      <QuickActionsSection onCampaignCreated={onCampaignCreated} />
    </div>
  );
};
