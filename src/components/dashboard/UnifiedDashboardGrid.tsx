
import { CurrentCampaignSection } from "./current-campaign/CurrentCampaignSection";
import { CustomContentSection } from "./custom-content/CustomContentSection";
import { QuickActionsSection } from "./QuickActionsSection";
import { EnhancedSeasonalHolidaysCard } from "./seasonal-holidays/EnhancedSeasonalHolidaysCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
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
        />
      </div>

      {/* Custom Campaigns Section */}
      {userCreatedCampaigns.length > 0 && (
        <CustomContentSection
          userCreatedCampaigns={userCreatedCampaigns}
          onContentGenerated={onTaskUpdate}
        />
      )}

      {/* Quick Actions Grid */}
      <QuickActionsSection onCampaignCreated={onCampaignCreated} />

      {/* Seasonal Marketing Section with improved styling */}
      <section className="seasonal-section card-shadow">
        <EnhancedSeasonalHolidaysCard
          onContentGenerated={onCampaignCreated}
        />
      </section>

      {/* Ready to Post Section - Moved to bottom */}
      <section className="ready-to-post-section">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Ready to Post</h2>
          <p className="text-sm text-gray-600 mt-1">Approved content ready for publishing</p>
        </div>
        <ReadyToPostCard 
          tasks={tasks}
          onTaskUpdate={onTaskUpdate}
        />
      </section>
    </div>
  );
};
