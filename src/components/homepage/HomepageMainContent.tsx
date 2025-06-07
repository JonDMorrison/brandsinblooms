
import { CampaignCard } from "./CampaignCard";
import { WhatsComingNextCard } from "./WhatsComingNextCard";
import { getSeasonalContent } from "./SeasonalContent";

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
      {currentCampaign ? (
        <CampaignCard 
          campaign={currentCampaign} 
          onTaskUpdate={onTaskUpdate}
          seasonalContent={seasonalContent} 
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No campaigns found</p>
          <p className="text-gray-400">Create a new campaign to get started</p>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-semibold text-garden-green-dark mb-6">
          What's Coming Next
        </h2>
        <WhatsComingNextCard onTaskUpdate={onTaskUpdate} />
      </div>
    </div>
  );
};
