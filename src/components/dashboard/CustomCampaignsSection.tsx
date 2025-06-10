
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { NewCampaignCard } from "@/components/homepage/NewCampaignCard";

interface CustomCampaignsSectionProps {
  userCreatedCampaigns: any[];
  onTaskUpdate: () => void;
  onCampaignUpdate: () => void;
  onCampaignDelete?: (campaignId: string) => void;
  onCreateCampaign?: () => void;
}

export const CustomCampaignsSection = ({
  userCreatedCampaigns,
  onTaskUpdate,
  onCampaignUpdate,
  onCampaignDelete,
  onCreateCampaign
}: CustomCampaignsSectionProps) => {
  if (userCreatedCampaigns.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Your Custom Campaigns</h2>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Create Your Custom Campaign</h3>
                <p className="text-muted-foreground max-w-md">
                  Design a unique marketing theme tailored to your garden center's special events, promotions, or seasonal focuses.
                </p>
              </div>
              <Button 
                onClick={onCreateCampaign}
                className="bg-primary hover:bg-primary-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Campaign
              </Button>
              <p className="text-xs text-muted-foreground">
                Perfect for promoting sales, workshops, new arrivals, or community events
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Your Custom Campaigns</h2>
        <Button 
          onClick={onCreateCampaign}
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>
      
      <div className="grid gap-4">
        {userCreatedCampaigns.map((campaign) => (
          <NewCampaignCard
            key={campaign.id}
            campaign={campaign}
            onTaskUpdate={onTaskUpdate}
            onCampaignUpdate={onCampaignUpdate}
            onCampaignDelete={onCampaignDelete}
          />
        ))}
      </div>
    </div>
  );
};
