
import { useState, useEffect } from "react";
import { Palette, Calendar as CalendarIcon } from "lucide-react";
import { WeeklyThemeGenerator } from "./theme-generation/WeeklyThemeGenerator";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CampaignDetailsModal } from "./calendar/CampaignDetailsModal";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  campaigns?: {
    title: string;
  };
}

interface CalendarViewProps {
  campaigns: Campaign[];
  tasks?: Task[];
  onDataUpdate?: () => void;
}

export const CalendarView = ({ campaigns = [], tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState<Campaign[]>(campaigns);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Update local campaigns when props change
  useEffect(() => {
    if (Array.isArray(campaigns)) {
      setLocalCampaigns(campaigns);
    }
  }, [campaigns]);

  // Check if campaigns need AI-generated themes - add safety check
  const campaignsNeedingThemes = Array.isArray(localCampaigns) ? localCampaigns.filter(campaign => 
    !campaign?.theme || campaign.theme.includes("Summer Heat Solutions") || campaign.theme === campaign.title
  ) : [];

  const handleCampaignClick = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleCreateCampaign = (date: Date) => {
    console.log('Create campaign for date:', date);
    // TODO: Implement campaign creation
  };

  const handleThemesGenerated = () => {
    if (onDataUpdate) {
      onDataUpdate();
    }
  };

  const handleCampaignUpdate = (updatedCampaign: Campaign) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === updatedCampaign.id ? updatedCampaign : campaign
      )
    );
    if (onDataUpdate) {
      onDataUpdate();
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 bg-white overflow-hidden">
      {/* Header with Theme Generator */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                <CalendarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                  Campaign Calendar
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  View and manage your marketing campaigns in calendar format
                </p>
              </div>
            </div>
            
            {campaignsNeedingThemes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full">
                  <Palette className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-purple-700 whitespace-nowrap">
                    {campaignsNeedingThemes.length} {campaignsNeedingThemes.length === 1 ? 'campaign needs' : 'campaigns need'} themes
                  </span>
                </div>
                <WeeklyThemeGenerator onThemesGenerated={handleThemesGenerated} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <CalendarGrid
        campaigns={localCampaigns}
        onCampaignClick={handleCampaignClick}
        onCreateCampaign={handleCreateCampaign}
      />

      {/* Campaign Details Modal */}
      <CampaignDetailsModal
        campaign={selectedCampaign}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={handleCampaignUpdate}
      />
    </div>
  );
};
