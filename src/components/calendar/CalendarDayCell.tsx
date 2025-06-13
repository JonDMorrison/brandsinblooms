
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CalendarDayCellProps {
  date: Date;
  campaigns: Campaign[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onCampaignClick?: (campaign: Campaign) => void;
  onCreateCampaign?: (date: Date) => void;
}

export const CalendarDayCell = ({
  date,
  campaigns,
  isCurrentMonth,
  isToday,
  onCampaignClick,
  onCreateCampaign,
}: CalendarDayCellProps) => {
  const dayNumber = format(date, 'd');

  return (
    <div
      className={cn(
        "min-h-[120px] p-2 border border-gray-200 bg-white hover:bg-gray-50 transition-colors",
        !isCurrentMonth && "text-gray-400 bg-gray-50",
        isToday && "bg-blue-50 border-blue-200"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "text-sm font-medium",
            isToday && "text-blue-600 font-bold"
          )}
        >
          {dayNumber}
        </span>
        {isCurrentMonth && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
            onClick={() => onCreateCampaign?.(date)}
          >
            <Plus className="w-3 h-3" />
          </Button>
        )}
      </div>
      
      <div className="space-y-1">
        {campaigns.slice(0, 2).map((campaign) => (
          <div
            key={campaign.id}
            className="text-xs p-1 bg-green-100 border border-green-200 rounded cursor-pointer hover:bg-green-200 transition-colors"
            onClick={() => onCampaignClick?.(campaign)}
          >
            <div className="font-medium text-green-800 truncate">
              {campaign.title}
            </div>
            {campaign.theme && (
              <div className="text-green-600 truncate">
                {campaign.theme}
              </div>
            )}
          </div>
        ))}
        
        {campaigns.length > 2 && (
          <div className="text-xs text-gray-500 text-center">
            +{campaigns.length - 2} more
          </div>
        )}
      </div>
    </div>
  );
};
