
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { SampleCampaignCard } from "@/components/dashboard/SampleCampaignCard";
import { QuickActionsSection } from "@/components/dashboard/QuickActionsSection";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { SeasonalHolidaysCard } from "./seasonal-holidays/SeasonalHolidaysCard";
import { useUser } from "@/hooks/useUser";
import type { Campaign } from "@/types/content";

interface UnifiedDashboardGridProps {
  activeCampaign?: Campaign | null;
  userCreatedCampaigns?: Campaign[];
  tasks?: any[];
  onTaskUpdate: () => void;
  onCampaignCreated?: () => void;
  onCampaignUpdate?: () => void;
  onCreateCampaign?: () => void;
}

export const UnifiedDashboardGrid = ({ 
  activeCampaign,
  userCreatedCampaigns = [],
  tasks = [],
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCreateCampaign
}: UnifiedDashboardGridProps) => {
  const { user } = useAuth();
  const { isNewUser, loading } = useUser();

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Current Campaign Section */}
      <CurrentCampaignSection 
        activeCampaign={activeCampaign}
        onTaskUpdate={onTaskUpdate}
        onCreateCampaign={onCreateCampaign || (() => {})}
        onCampaignCreated={onCampaignCreated || (() => {})}
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

      {/* Sample Campaign Section - Only show for new users or non-authenticated */}
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
          <SampleCampaignCard onCreateRealCampaign={onCreateCampaign || (() => {})} />
        </div>
      )}

      {/* Quick Actions */}
      <QuickActionsSection onCampaignCreated={onCampaignCreated || (() => {})} />
    </div>
  );
};
