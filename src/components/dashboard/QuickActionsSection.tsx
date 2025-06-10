
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Sparkles, Calendar } from "lucide-react";
import { useState } from "react";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";

interface QuickActionsSectionProps {
  onCampaignCreated: () => void;
}

export const QuickActionsSection = ({
  onCampaignCreated
}: QuickActionsSectionProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Create New Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => setShowNewCampaignDialog(true)}
            className="w-full"
            variant="outline"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Custom Event Campaign
          </Button>
          <p className="text-xs text-gray-600">
            Create campaigns for special events, promotions, or seasonal content.
          </p>
        </CardContent>
      </Card>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />
    </div>
  );
};
