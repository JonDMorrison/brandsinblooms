
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CampaignCard } from "./CampaignCard";
import { WhatsComingNextCard } from "./WhatsComingNextCard";
import { getSeasonalContent } from "./SeasonalContent";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { Calendar, Plus } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface HomepageMainContentProps {
  currentCampaign: Campaign | undefined;
  onTaskUpdate: () => void;
}

export const HomepageMainContent = ({ currentCampaign, onTaskUpdate }: HomepageMainContentProps) => {
  const seasonalContent = getSeasonalContent();

  return (
    <div className="lg:col-span-2 space-y-8">
      {/* Main Campaign Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <HeadlineLarge className="text-text-primary">
              This Week's Campaign
            </HeadlineLarge>
            <BodyMedium className="text-text-secondary mt-1">
              Your active marketing content for this week
            </BodyMedium>
          </div>
          <div className="flex items-center gap-2 text-text-tertiary">
            <Calendar className="w-4 h-4" />
            <BodyMedium>Week {getCurrentWeekNumber()}</BodyMedium>
          </div>
        </div>

        {currentCampaign ? (
          <CampaignCard 
            campaign={currentCampaign} 
            onTaskUpdate={onTaskUpdate}
            seasonalContent={seasonalContent} 
          />
        ) : (
          <AppleCard variant="default" surface="secondary" className="border-dashed border-2">
            <AppleCardContent className="text-center py-12">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <HeadlineLarge className="text-text-primary mb-2">
                No Campaign This Week
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary max-w-md mx-auto">
                Create a new campaign to generate professional marketing content for your garden center
              </BodyMedium>
            </AppleCardContent>
          </AppleCard>
        )}
      </div>

      {/* What's Coming Next Section */}
      <div className="space-y-6">
        <div>
          <HeadlineLarge className="text-text-primary">
            What's Coming Next
          </HeadlineLarge>
          <BodyMedium className="text-text-secondary mt-1">
            Upcoming content and seasonal opportunities
          </BodyMedium>
        </div>
        <WhatsComingNextCard onTaskUpdate={onTaskUpdate} />
      </div>
    </div>
  );
};
