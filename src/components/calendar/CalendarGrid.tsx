
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { CalendarDayCell } from "./CalendarDayCell";
import { getCurrentWeekNumber, getDateForWeek, dateToWeekNumber } from "@/utils/dateUtils";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CalendarGridProps {
  campaigns: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
  onCreateCampaign?: (date: Date) => void;
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
}

export const CalendarGrid = ({ 
  campaigns, 
  onCampaignClick, 
  onCreateCampaign,
  selectionMode = false,
  selectedCampaigns = []
}: CalendarGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get current week number for display
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = currentDate.getFullYear();
  
  // Create a map of campaigns by date, using proper week number calculation
  const campaignsByDate = new Map<string, Campaign>();

  campaigns.forEach(campaign => {
    // Use the actual week number from the campaign to get the correct date
    const campaignDate = getDateForWeek(campaign.week_number, currentYear);
    const dateKey = format(campaignDate, 'yyyy-MM-dd');
    
    // Only add campaigns that fall within a reasonable range and don't duplicate
    if (!campaignsByDate.has(dateKey)) {
      campaignsByDate.set(dateKey, {
        ...campaign,
        start_date: dateKey
      });
    }
  });

  // Convert map back to the expected format for rendering
  const campaignsByDateObject = Array.from(campaignsByDate.entries()).reduce((acc, [dateKey, campaign]) => {
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-2xl font-bold">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
              Current Week: {currentWeekNumber}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {selectionMode && selectedCampaigns.length > 0 && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded">
            {selectedCampaigns.length} campaign{selectedCampaigns.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayCampaigns = campaignsByDateObject[dateKey] || [];
            const dayWeekNumber = dateToWeekNumber(day);
            
            return (
              <CalendarDayCell
                key={dateKey}
                date={day}
                campaigns={dayCampaigns}
                isCurrentMonth={isSameMonth(day, currentDate)}
                isToday={isToday(day)}
                onCampaignClick={onCampaignClick}
                onCreateCampaign={onCreateCampaign}
                selectionMode={selectionMode}
                selectedCampaigns={selectedCampaigns}
                weekNumber={dayWeekNumber}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
