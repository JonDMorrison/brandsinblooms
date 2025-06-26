
import { Badge } from "@/components/ui/badge";
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
  const isCampaignSelected = (campaign: Campaign) => {
    return selectedCampaigns.some(c => c.id === campaign.id);
  };

  const handleCampaignClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('CalendarCampaignList: Campaign click handler called for campaign:', campaign.id);
    if (onCampaignClick) {
      onCampaignClick(campaign);
    }
  };

  return (
    <>
      {campaigns.slice(0, 2).map((campaign) => {
        const isSelected = isCampaignSelected(campaign);
        
        return (
          <div
            key={campaign.id}
            className={cn(
              "relative p-2 rounded-md cursor-pointer transition-all duration-200 border text-xs",
              selectionMode && isSelected 
                ? "bg-blue-50 border-blue-300" 
                : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50",
              !selectionMode && "hover:border-blue-300 hover:shadow-sm"
            )}
            onClick={(e) => handleCampaignClick(campaign, e)}
          >
            {selectionMode && isSelected && (
              <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                <Check className="w-2.5 h-2.5" />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800 truncate pr-2">
                {campaign.title}
              </h4>
              <Badge className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 shrink-0">
                W{campaign.week_number}
              </Badge>
            </div>
            
            {campaign.theme && campaign.theme !== campaign.title && (
              <p className="text-xs text-gray-600 truncate mt-1">
                {campaign.theme}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
};
