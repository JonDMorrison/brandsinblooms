
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { NewCampaignCard } from "@/components/homepage/NewCampaignCard";
import type { Campaign } from "@/types";

interface CustomCampaignsSectionProps {
  userCreatedCampaigns: Campaign[];
  onTaskUpdate: () => void;
  onCampaignUpdate: () => void;
}

export const CustomCampaignsSection = ({
  userCreatedCampaigns,
  onTaskUpdate,
  onCampaignUpdate
}: CustomCampaignsSectionProps) => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Custom Campaigns</h2>
      {userCreatedCampaigns.length > 0 ? (
        <div className="space-y-4">
          {userCreatedCampaigns.map((campaign) => (
            <NewCampaignCard
              key={campaign.id}
              campaign={campaign}
              onTaskUpdate={onTaskUpdate}
              onCampaignUpdate={onCampaignUpdate}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-gray-500">
                <PlusCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Custom Campaigns Yet</h3>
                <p className="text-sm">
                  Use the Quick Actions above to create custom campaigns for events or special promotions. They will appear here once created.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
