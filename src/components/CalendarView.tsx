
import { useState } from "react";
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
  useState(() => {
    setLocalCampaigns(campaigns);
  });

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
    <div className="space-y-6">
      {/* Weekly Content Themes */}
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-garden-green-dark flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Weekly Content Themes
          </h3>
          {campaignsNeedingThemes.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Sparkles className="w-4 h-4 text-purple-600" />
                {campaignsNeedingThemes.length} campaigns need themes
              </div>
              <WeeklyThemeGenerator onThemesGenerated={handleThemesGenerated} />
            </div>
          )}
        </div>

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
