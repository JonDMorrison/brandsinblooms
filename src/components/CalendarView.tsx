
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Palette } from "lucide-react";
import { EditableTheme } from "./calendar/EditableTheme";

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

const getWeekDateRange = (weekNumber: number, year: number) => {
  // Calculate the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Calculate which day of the week January 1st falls on (0 = Sunday, 1 = Monday, etc.)
  const firstDayWeekday = firstDayOfYear.getDay();
  
  // Calculate the date of the first Monday of the year (start of week 1)
  const firstMonday = new Date(firstDayOfYear);
  const daysToFirstMonday = firstDayWeekday === 0 ? 1 : (8 - firstDayWeekday);
  firstMonday.setDate(firstDayOfYear.getDate() + daysToFirstMonday);
  
  // Calculate the start date of the specified week
  const weekStartDate = new Date(firstMonday);
  weekStartDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Calculate the end date of the week (Sunday)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  
  return { startDate: weekStartDate, endDate: weekEndDate };
};

const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export const CalendarView = ({ campaigns, tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const currentYear = new Date().getFullYear();
  const currentWeekNumber = getCurrentWeekNumber();

  // Update local campaigns when props change
  useState(() => {
    setLocalCampaigns(campaigns);
  });

  // Sort campaigns to show current week first, then subsequent weeks
  const sortedCampaigns = [...localCampaigns].sort((a, b) => {
    // If one campaign is the current week, prioritize it
    if (a.week_number === currentWeekNumber && b.week_number !== currentWeekNumber) return -1;
    if (b.week_number === currentWeekNumber && a.week_number !== currentWeekNumber) return 1;
    
    // For other campaigns, sort by week number
    return a.week_number - b.week_number;
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

  return (
    <div className="space-y-6">
      {/* Weekly Content Themes */}
      <div className="grid gap-4">
        <h3 className="text-xl font-bold text-garden-green-dark flex items-center gap-2">
          <Palette className="w-6 h-6" />
          Weekly Content Themes
        </h3>
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => {
          const weekNumber = weekCampaigns[0].week_number;
          const { startDate, endDate } = getWeekDateRange(weekNumber, currentYear);
          const isCurrentWeek = weekNumber === currentWeekNumber;
          
          return (
            <Card key={week} className={`border-green-200 ${isCurrentWeek ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-green-800">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    {week} ({currentYear})
                    {isCurrentWeek && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        Current Week
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-normal text-gray-500">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-4">
                  {weekCampaigns.map((campaign) => (
                    <div 
                      key={campaign.id}
                      className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800 mb-1">{campaign.title}</h4>
                        </div>
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          Active
                        </Badge>
                      </div>
                      
                      <div className="border-t pt-3">
                        <EditableTheme
                          campaignId={campaign.id.toString()}
                          currentTheme={campaign.theme || ""}
                          currentDescription={campaign.description || ""}
                          onThemeUpdate={(newTheme, newDescription) => handleThemeUpdate(campaign.id.toString(), newTheme, newDescription)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
