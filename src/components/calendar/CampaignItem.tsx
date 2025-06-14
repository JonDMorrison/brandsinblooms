
import { Badge } from "@/components/ui/badge";
import { EditableTheme } from "./EditableTheme";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CampaignItemProps {
  campaign: Campaign;
  onThemeUpdate: (campaignId: string, newTheme: string, newDescription?: string) => void;
}

export const CampaignItem = ({ campaign, onThemeUpdate }: CampaignItemProps) => {
  const needsTheme = !campaign.theme || 
                   campaign.theme.includes("Summer Heat Solutions") || 
                   campaign.theme === campaign.title;

  return (
    <div 
      className={`p-4 rounded-lg border transition-shadow bg-white ${
        needsTheme 
          ? 'border-gray-200 hover:shadow-sm' 
          : 'border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-gray-800 mb-1">{campaign.title}</h4>
          {needsTheme && (
            <Badge variant="outline" className="text-gray-700 border-gray-300 bg-white">
              Needs Creative Theme
            </Badge>
          )}
        </div>
        {!needsTheme && (
          <Badge variant="outline" className="text-green-700 border-green-300 bg-white">
            Active
          </Badge>
        )}
      </div>
      
      <div className="border-t border-gray-200 pt-3">
        <EditableTheme
          campaignId={campaign.id.toString()}
          currentTheme={campaign.theme || ""}
          currentDescription={campaign.description || ""}
          onThemeUpdate={(newTheme, newDescription) => onThemeUpdate(campaign.id.toString(), newTheme, newDescription)}
        />
      </div>
    </div>
  );
};
