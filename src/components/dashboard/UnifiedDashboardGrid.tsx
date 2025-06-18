
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { SampleCampaignCard } from "@/components/dashboard/SampleCampaignCard";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { SeasonalHolidaysCard } from "./seasonal-holidays/SeasonalHolidaysCard";

interface UnifiedDashboardGridProps {
  onTaskUpdate: () => void;
}

export const UnifiedDashboardGrid = ({ onTaskUpdate }: UnifiedDashboardGridProps) => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Current Campaign Section */}
      <CurrentCampaignSection 
        activeCampaign={null}
        onTaskUpdate={onTaskUpdate}
        onCreateCampaign={() => {}}
        onCampaignCreated={() => {}}
      />

      {/* Seasonal Holidays Section - Only show for authenticated users */}
      {user && (
        <div className="space-y-6">
          <div>
            <HeadlineLarge className="text-text-primary">
              Seasonal Marketing Opportunities
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              Create timely content for upcoming holidays and observances
            </BodyMedium>
          </div>
          <SeasonalHolidaysCard onContentGenerated={onTaskUpdate} />
        </div>
      )}

      {/* Sample Campaign Section - Only show for new users */}
      {!user && (
        <div className="space-y-6">
          <div>
            <HeadlineLarge className="text-text-primary">
              Sample Campaign Preview
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              See what your marketing content could look like
            </BodyMedium>
          </div>
          <SampleCampaignCard onCreateRealCampaign={() => {}} />
        </div>
      )}

      {/* Quick Actions */}
      <QuickActionsSection onCampaignCreated={() => {}} />
    </div>
  );
};
