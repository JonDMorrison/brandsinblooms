
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EditableTheme } from "./EditableTheme";
import { format } from "date-fns";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CampaignDetailsModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (campaign: Campaign) => void;
}

export const CampaignDetailsModal = ({
  campaign,
  isOpen,
  onClose,
  onUpdate,
}: CampaignDetailsModalProps) => {
  if (!campaign) return null;

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    const updatedCampaign = {
      ...campaign,
      theme: newTheme,
      description: newDescription,
    };
    onUpdate(updatedCampaign);
  };

  const needsTheme = !campaign.theme || 
                   campaign.theme.includes("Summer Heat Solutions") || 
                   campaign.theme === campaign.title;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{campaign.title}</span>
            <Badge variant="outline" className="text-xs">
              Week {campaign.week_number}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Campaign Date</h4>
            <p className="text-sm text-gray-600">
              {format(new Date(campaign.start_date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
            {needsTheme ? (
              <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50">
                Needs Creative Theme
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                Theme Set
              </Badge>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Campaign Theme</h4>
            <EditableTheme
              campaignId={campaign.id.toString()}
              currentTheme={campaign.theme || ""}
              currentDescription={campaign.description || ""}
              weekNumber={campaign.week_number}
              onThemeUpdate={handleThemeUpdate}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
