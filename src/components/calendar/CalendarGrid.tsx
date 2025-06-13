
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { CalendarDayCell } from "./CalendarDayCell";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

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

  // Get current week number for proper seasonal alignment
  const currentWeekNumber = getCurrentWeekNumber();
  
  // Map campaigns to appropriate weeks based on current week
  const adjustedCampaigns = campaigns.map(campaign => {
    // Calculate the actual week this campaign should represent
    // If we're in week 24 and this is stored as week 1, it should show as week 24
    const weekOffset = campaign.week_number - 1; // 0-based offset
    const actualWeekNumber = ((currentWeekNumber - 1 + weekOffset) % 52) + 1;
    
    // Calculate the actual date this campaign should be for
    const campaignDate = new Date();
    campaignDate.setDate(campaignDate.getDate() + (weekOffset * 7));
    
    return {
      ...campaign,
      start_date: campaignDate.toISOString().split('T')[0],
      week_number: actualWeekNumber
    };
  });

  // Group campaigns by date using the adjusted campaigns
  const campaignsByDate = adjustedCampaigns.reduce((acc, campaign) => {
    const dateKey = format(new Date(campaign.start_date), 'yyyy-MM-dd');
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
          <CardTitle className="text-2xl font-bold">
            {format(currentDate, 'MMMM yyyy')}
          </CardTitle>
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
            const dayCampaigns = campaignsByDate[dateKey] || [];
            
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
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
