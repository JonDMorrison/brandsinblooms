
import { useState, useEffect } from "react";
import { Palette, Sparkles } from "lucide-react";
import { WeeklyThemeGenerator } from "./theme-generation/WeeklyThemeGenerator";
import { WeekCard } from "./calendar/WeekCard";
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

export const CalendarView = ({ campaigns, tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const currentYear = new Date().getFullYear();
  const currentWeekNumber = getCurrentWeekNumber();

  // Update local campaigns when props change
  useEffect(() => {
    setLocalCampaigns(campaigns);
  }, [campaigns]);

  // Check if campaigns need AI-generated themes
  const campaignsNeedingThemes = localCampaigns.filter(campaign => 
    !campaign.theme || campaign.theme.includes("Summer Heat Solutions") || campaign.theme === campaign.title
  );

  // Sort campaigns starting with current week, then subsequent weeks in order
  const sortedCampaigns = [...localCampaigns].sort((a, b) => {
    // Calculate order starting from current week
    const aOrder = a.week_number >= currentWeekNumber 
      ? a.week_number - currentWeekNumber
      : (52 - currentWeekNumber) + a.week_number;
    
    const bOrder = b.week_number >= currentWeekNumber 
      ? b.week_number - currentWeekNumber
      : (52 - currentWeekNumber) + b.week_number;
    
    return aOrder - bOrder;
  });

  const groupedCampaigns = sortedCampaigns.reduce((acc, campaign) => {
    const week = `Week ${campaign.week_number}`;
    if (!acc[week]) acc[week] = [];
    acc[week].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const handleThemeUpdate = (campaignId: string, newTheme: string, newDescription?: string) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id.toString() === campaignId 
          ? { ...campaign, theme: newTheme, description: newDescription }
          : campaign
      )
    );
    onDataUpdate?.();
  };

  const handleThemesGenerated = () => {
    onDataUpdate?.();
  };

  return (
    <div className="w-full max-w-none space-y-6 bg-white overflow-hidden">
      {/* Weekly Content Themes Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                <Palette className="w-6 h-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                  Weekly Content Themes
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Organize and plan your marketing campaigns by week
                </p>
              </div>
            </div>
            
            {campaignsNeedingThemes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full">
                  <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
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

      {/* Weekly Campaign Cards */}
      <div className="space-y-4">
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => {
          const weekNumber = weekCampaigns[0].week_number;
          const isCurrentWeek = weekNumber === currentWeekNumber;
          
          return (
            <WeekCard
              key={week}
              week={week}
              weekCampaigns={weekCampaigns}
              currentYear={currentYear}
              isCurrentWeek={isCurrentWeek}
              onThemeUpdate={handleThemeUpdate}
            />
          );
        })}
      </div>
    </div>
  );
};
