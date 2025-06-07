
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, BarChart3, CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { AddEventDialog } from "./AddEventDialog";
import { toast } from "sonner";

interface QuickActionsGridProps {
  onCampaignCreated: () => void;
}

export const QuickActionsGrid = ({ onCampaignCreated }: QuickActionsGridProps) => {
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  const handleEventCreated = () => {
    console.log('QuickActions: Event created successfully');
    setShowAddEventDialog(false);
    onCampaignCreated();
    toast.success('Event added successfully!');
  };

  const handleNewCampaign = async () => {
    try {
      setIsCreatingCampaign(true);
      console.log('QuickActions: Creating new campaign');
      await onCampaignCreated();
      toast.success('Campaign creation initiated!');
    } catch (error) {
      console.error('QuickActions: Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const handleViewCalendar = () => {
    console.log('QuickActions: Navigating to calendar view');
    window.location.href = '/calendar';
  };

  const handleViewAnalytics = () => {
    console.log('QuickActions: Navigating to analytics view');
    window.location.href = '/analytics';
  };

  return (
    <>
      <Card className="shadow-lg border-green-200 rounded-xl">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-black mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto min-h-[120px] flex flex-col gap-3 border-green-300 hover:bg-green-50 p-4 justify-center"
              onClick={handleNewCampaign}
              disabled={isCreatingCampaign}
            >
              {isCreatingCampaign ? (
                <Loader2 className="w-6 h-6 text-green-600 flex-shrink-0 animate-spin" />
              ) : (
                <PlusCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              )}
              <span className="text-sm font-medium text-center">New Campaign</span>
              <span className="text-xs text-gray-500 text-center">Create a new theme</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto min-h-[120px] flex flex-col gap-3 border-blue-300 hover:bg-blue-50 p-4 justify-center"
              onClick={handleViewCalendar}
            >
              <Calendar className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <span className="text-sm font-medium text-center">View Calendar</span>
              <span className="text-xs text-gray-500 text-center">See upcoming events</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto min-h-[120px] flex flex-col gap-3 border-purple-300 hover:bg-purple-50 p-4 justify-center"
              onClick={handleViewAnalytics}
            >
              <BarChart3 className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <span className="text-sm font-medium text-center">Analytics</span>
              <span className="text-xs text-gray-500 text-center">Track performance</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto min-h-[120px] flex flex-col gap-3 border-orange-300 hover:bg-orange-50 p-4 justify-center"
              onClick={() => setShowAddEventDialog(true)}
            >
              <CalendarPlus className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-medium text-center">Add An Event</span>
              <span className="text-xs text-gray-500 text-center">Get promotion help</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />
    </>
  );
};
