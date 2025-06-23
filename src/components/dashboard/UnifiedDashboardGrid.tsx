
import { CurrentCampaignSection } from "./current-campaign/CurrentCampaignSection";
import { CustomContentSection } from "./custom-content/CustomContentSection";
import { QuickActionsSection } from "./QuickActionsSection";
import { EnhancedSeasonalHolidaysCard } from "./seasonal-holidays/EnhancedSeasonalHolidaysCard";
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
          onCampaignCreated={onCampaignCreated}
        />
      </div>

      {/* Custom Campaigns Section */}
      {userCreatedCampaigns.length > 0 && (
        <CustomContentSection
          userCreatedCampaigns={userCreatedCampaigns}
          onContentGenerated={onTaskUpdate}
        />
      )}

      {/* Seasonal Marketing Section with improved styling */}
      <section className="seasonal-section card-shadow">
        <EnhancedSeasonalHolidaysCard
          onContentGenerated={onCampaignCreated}
        />
      </section>

      {/* Quick Actions Grid */}
      <QuickActionsSection onCampaignCreated={onCampaignCreated} />
    </div>
  );
};
