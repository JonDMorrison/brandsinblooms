
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Loader2 } from "lucide-react";

interface NoCampaignStateProps {
  currentWeekNumber: number;
  isAutoCreating: boolean;
  onCreateCampaign: () => void;
}

export const NoCampaignState = ({
  currentWeekNumber,
  isAutoCreating,
  onCreateCampaign
}: NoCampaignStateProps) => {
  return (
    <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
      <CardContent className="p-8 text-center">
        <div className="space-y-4">
          {isAutoCreating ? (
            <div className="text-primary">
              <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Setting Up Your Week {currentWeekNumber} Campaign</h3>
              <p className="text-sm">
                We're creating your weekly marketing content and generating engaging posts for review...
              </p>
            </div>
          ) : (
            <div className="text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Campaign for Week {currentWeekNumber}</h3>
              <p className="text-sm">
                Create a campaign for the current week to start generating content.
              </p>
            </div>
          )}
          {!isAutoCreating && (
            <Button 
              onClick={onCreateCampaign}
              className="bg-primary hover:bg-primary-600 text-white"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Campaign for Week {currentWeekNumber}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
