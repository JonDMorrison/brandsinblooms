
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Sparkles, Calendar, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";

interface QuickActionsSectionProps {
  onCampaignCreated: () => void;
}

export const QuickActionsSection = ({
  onCampaignCreated
}: QuickActionsSectionProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
  };

  const handleViewCalendar = () => {
    window.location.href = '/calendar';
  };

  const actionItems = [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      onClick: () => setShowNewCampaignDialog(true),
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      onClick: () => setShowAddEventDialog(true),
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      onClick: handleViewCalendar,
    }
  ];

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-left">
            <Sparkles className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                className="w-full border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={item.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
              >
                <div className="flex items-start space-x-3 text-left">
                  <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg">
                    <IconComponent className="w-5 h-5 text-green-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1 text-left">
                    <h3 className="text-gray-800 font-medium text-left">
                      {item.title}
                    </h3>
                    
                    <p className="text-gray-600 text-sm text-left">
                      {item.description}
                    </p>
                    
                    <p className="text-gray-500 text-xs text-left">
                      {item.benefit}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />

      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};
