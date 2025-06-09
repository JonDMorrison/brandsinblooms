
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar } from "lucide-react";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import type { Campaign } from "@/types";

interface CurrentCampaignSectionProps {
  activeCampaign: Campaign | undefined;
  currentWeekNumber: number;
  onTaskUpdate: () => void;
  onCampaignUpdate: () => void;
  onCreateCampaign: () => void;
}

export const CurrentCampaignSection = ({
  activeCampaign,
  currentWeekNumber,
  onTaskUpdate,
  onCampaignUpdate,
  onCreateCampaign
}: CurrentCampaignSectionProps) => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Current Campaign (Week {currentWeekNumber})
      </h2>
      {activeCampaign ? (
        <CampaignCard 
          campaign={activeCampaign} 
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onCampaignUpdate}
        />
      ) : (
        <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Campaign for Week {currentWeekNumber}</h3>
                <p className="text-sm">
                  Create a campaign for the current week to start generating content.
                </p>
              </div>
              <Button 
                onClick={onCreateCampaign}
                className="bg-primary hover:bg-primary-600 text-white"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Campaign for Week {currentWeekNumber}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
