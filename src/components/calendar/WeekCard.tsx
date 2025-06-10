
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
    <Card className="border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="bg-white pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-gray-600" />
              <CardTitle className="text-lg font-semibold text-gray-900">
                {week} ({currentYear})
              </CardTitle>
            </div>
            {isCurrentWeek && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium">
                Current Week
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 font-medium">
            {startDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })} - {endDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-white border-t border-gray-100">
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
