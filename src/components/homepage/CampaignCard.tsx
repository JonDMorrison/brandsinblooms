
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface CampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
}

export const CampaignCard = ({ campaign, onTaskUpdate }: CampaignCardProps) => {
  return (
    <Card className="border-garden-green-light">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-garden-green-dark">{campaign.title}</CardTitle>
          <Badge variant="secondary" className="bg-garden-green-light text-garden-green-dark">
            Week {campaign.week_number}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {campaign.description && (
          <p className="text-garden-green mb-4">{campaign.description}</p>
        )}
        {campaign.theme && (
          <div className="mb-4">
            <h4 className="font-semibold text-garden-green-dark mb-2">Theme:</h4>
            <p className="text-garden-green">{campaign.theme}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
