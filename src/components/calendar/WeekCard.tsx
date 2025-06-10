
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";
import { CampaignItem } from "./CampaignItem";
import { getWeekDateRange } from "@/utils/dateUtils";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface WeekCardProps {
  week: string;
  weekCampaigns: Campaign[];
  currentYear: number;
  isCurrentWeek: boolean;
  onThemeUpdate: (campaignId: string, newTheme: string, newDescription?: string) => void;
}

export const WeekCard = ({ 
  week, 
  weekCampaigns, 
  currentYear, 
  isCurrentWeek, 
  onThemeUpdate 
}: WeekCardProps) => {
  const weekNumber = weekCampaigns[0].week_number;
  const { startDate, endDate } = getWeekDateRange(weekNumber, currentYear);

  return (
    <Card className={`border-gray-200 bg-white ${isCurrentWeek ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
      <CardHeader className="bg-white">
        <CardTitle className="flex items-center justify-between text-black">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {week} ({currentYear})
            {isCurrentWeek && (
              <Badge className="bg-blue-100 text-blue-800 text-xs border-blue-200">
                Current Week
              </Badge>
            )}
          </div>
          <span className="text-sm font-normal text-gray-500">
            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 bg-white">
        <div className="grid gap-4">
          {weekCampaigns.map((campaign) => (
            <CampaignItem
              key={campaign.id}
              campaign={campaign}
              onThemeUpdate={onThemeUpdate}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
