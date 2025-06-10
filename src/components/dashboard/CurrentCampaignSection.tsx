
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Sparkles } from "lucide-react";
import { useState } from "react";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import type { Campaign } from "@/types";

interface CurrentCampaignSectionProps {
  activeCampaign: Campaign | undefined;
  currentWeekNumber: number;
  completedTasksCount: number;
  totalTasksCount: number;
  pendingTasksCount: number;
  onTaskUpdate: () => void;
  onCreateCampaign: () => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const CurrentCampaignSection = ({
  activeCampaign,
  currentWeekNumber,
  completedTasksCount,
  totalTasksCount,
  pendingTasksCount,
  onTaskUpdate,
  onCreateCampaign,
  onCampaignCreated,
  onTaskClick
}: CurrentCampaignSectionProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Current Campaign (Week {currentWeekNumber})
      </h2>
      {activeCampaign ? (
        <CampaignCard 
          campaign={activeCampaign} 
          onTaskUpdate={onTaskUpdate}
          onCampaignUpdate={onTaskUpdate}
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

      {/* Quick Actions Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Quick Actions
        </h3>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Button
              onClick={() => setShowNewCampaignDialog(true)}
              className="w-full justify-start"
              variant="outline"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Custom Campaign
            </Button>
            <p className="text-xs text-gray-600">
              Create campaigns for special events, promotions, or seasonal content.
            </p>
          </CardContent>
        </Card>
      </div>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />
    </div>
  );
};
