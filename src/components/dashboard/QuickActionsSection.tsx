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

  const handleOpenPublishPortal = () => {
    window.location.href = '/publish';
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
      id: 'publish-portal',
      icon: Sparkles,
      title: 'Publish Portal',
      description: 'Schedule and publish your content',
      benefit: 'Professional social media management',
      onClick: handleOpenPublishPortal,
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      onClick: () => { window.location.href = '/calendar'; },
    }
  ];

  return (
    <div>
      <Card className="bg-white border-gray-200 card-interactive">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-left text-brand-navy font-semibold tracking-tight">
            <Sparkles className="w-5 h-5 text-brand-teal" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actionItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                className="group w-full border border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-brand-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 micro-bounce"
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
                  <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg group-hover:bg-brand-teal/10 transition-colors duration-150">
                    <IconComponent className="w-4 h-4 text-brand-teal" />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-0.5 text-left">
                    <h3 className="text-brand-navy font-semibold text-sm tracking-tight">
                      {item.title}
                    </h3>
                    
                    <p className="text-gray-600 text-xs leading-relaxed">
                      {item.description}
                    </p>
                    
                    <p className="text-gray-500 text-xs leading-relaxed">
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
