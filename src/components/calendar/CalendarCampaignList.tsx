
import { Badge } from "@/components/ui/badge";
import { dateToWeekNumber } from "@/utils/dateUtils";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CalendarCampaignListProps {
  campaigns: Campaign[];
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
}

export const CalendarCampaignList = ({
  campaigns,
  selectionMode = false,
  selectedCampaigns = [],
  onCampaignClick,
}: CalendarCampaignListProps) => {
  // Campaigns are now pre-filtered by CalendarGrid, so no need for deduplication
  

  const isCampaignSelected = (campaign: Campaign) => {
    return selectedCampaigns.some(c => c.id === campaign.id);
  };

  const handleCampaignClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCampaignClick) {
      onCampaignClick(campaign);
    }
  };

  // Show up to 2 campaigns per day to maintain clean UI
  return (
    <>
      {campaigns.slice(0, 2).map((campaign) => {
        const isSelected = isCampaignSelected(campaign);
        
        return (
          <div
            key={campaign.id}
            className={cn(
              "relative p-3 rounded-lg cursor-pointer transition-all duration-300 border text-xs shadow-sm",
              selectionMode && isSelected 
                ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 shadow-md" 
                : "bg-gradient-to-r from-white to-blue-50/30 border-blue-200/50 hover:border-blue-300 hover:from-blue-50/50 hover:to-blue-100/40 hover:shadow-md",
              !selectionMode && "hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
            )}
            onClick={(e) => handleCampaignClick(campaign, e)}
          >
            {selectionMode && isSelected && (
              <div className="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <Check className="w-3 h-3" />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800 truncate pr-2">
                {campaign.title}
              </h4>
              <Badge className="text-xs bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 px-2 py-1 shrink-0 shadow-sm border-blue-200/50">
                W{dateToWeekNumber(new Date(campaign.start_date))}
              </Badge>
            </div>
            
            {campaign.theme && campaign.theme !== campaign.title && (
              <p className="text-xs text-gray-600 truncate mt-1.5 leading-relaxed">
                {campaign.theme}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
};
