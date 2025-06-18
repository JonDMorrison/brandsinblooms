import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/hooks/useUser";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { SmartThemeSelector } from "@/components/dashboard/SmartThemeSelector";
import { SampleCampaignCard } from "@/components/dashboard/SampleCampaignCard";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { SeasonalHolidaysCard } from "./seasonal-holidays/SeasonalHolidaysCard";

interface UnifiedDashboardGridProps {
  onTaskUpdate: () => void;
}

export const UnifiedDashboardGrid = ({ onTaskUpdate }: UnifiedDashboardGridProps) => {
  const { user } = useAuth();
  const { isNewUser, loading } = useUser();

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Current Campaign Section */}
      <CurrentCampaignSection onTaskUpdate={onTaskUpdate} />

      {/* Weekly Themes Section - Only show for authenticated users */}
      {user && (
        <div className="space-y-6">
          <div>
            <HeadlineLarge className="text-text-primary">
              Weekly Theme Planning
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              Generate and manage seasonal content themes
            </BodyMedium>
          </div>
          <SmartThemeSelector />
        </div>
      )}

      {/* Seasonal Holidays Section - New addition */}
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
      {(!user || isNewUser) && (
        <div className="space-y-6">
          <div>
            <HeadlineLarge className="text-text-primary">
              Sample Campaign Preview
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              See what your marketing content could look like
            </BodyMedium>
          </div>
          <SampleCampaignCard />
        </div>
      )}

      {/* Quick Actions */}
      <QuickActionsSection />
    </div>
  );
};
