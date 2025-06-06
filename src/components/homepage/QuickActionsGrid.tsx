
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, BarChart3, Users } from "lucide-react";

interface QuickActionsGridProps {
  onCampaignCreated: () => void;
}

export const QuickActionsGrid = ({ onCampaignCreated }: QuickActionsGridProps) => {
  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-black mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2 border-green-300 hover:bg-green-50"
            onClick={onCampaignCreated}
          >
            <PlusCircle className="w-6 h-6 text-green-600" />
            <span className="text-sm font-medium">New Campaign</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2 border-blue-300 hover:bg-blue-50"
          >
            <Calendar className="w-6 h-6 text-blue-600" />
            <span className="text-sm font-medium">View Calendar</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2 border-purple-300 hover:bg-purple-50"
          >
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <span className="text-sm font-medium">Analytics</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-20 flex flex-col gap-2 border-orange-300 hover:bg-orange-50"
          >
            <Users className="w-6 h-6 text-orange-600" />
            <span className="text-sm font-medium">Team</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
