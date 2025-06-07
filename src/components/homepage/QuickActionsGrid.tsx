
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, BarChart3, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { AddEventDialog } from "./AddEventDialog";
import { NewCampaignModal } from "./NewCampaignModal";
import { toast } from "sonner";

interface QuickActionsGridProps {
  onCampaignCreated: () => void;
}

export const QuickActionsGrid = ({ onCampaignCreated }: QuickActionsGridProps) => {
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
    toast.success('Event added successfully!');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    onCampaignCreated();
    toast.success('Campaign created successfully!');
  };

  const handleViewCalendar = () => {
    window.location.href = '/calendar';
  };

  const handleViewAnalytics = () => {
    window.location.href = '/analytics';
  };

  const actionItems = [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'New Campaign',
      description: 'Create a new theme',
      color: 'primary',
      onClick: () => setShowNewCampaignModal(true),
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'View Calendar',
      description: 'See upcoming content',
      color: 'secondary',
      onClick: handleViewCalendar,
      ariaLabel: 'View content calendar'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      title: 'Analytics',
      description: 'Track performance',
      color: 'accent',
      onClick: handleViewAnalytics,
      ariaLabel: 'View analytics dashboard'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Add An Event',
      description: 'Get promotion help',
      color: 'primary',
      onClick: () => setShowAddEventDialog(true),
      ariaLabel: 'Add a new event to promote'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'secondary':
        return 'border-secondary/30 hover:bg-secondary/10 text-secondary';
      case 'accent':
        return 'border-accent/30 hover:bg-accent/10 text-accent';
      default:
        return 'border-primary/30 hover:bg-primary/10 text-primary';
    }
  };

  return (
    <>
      <Card className="shadow-lg border-border rounded-xl">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Button 
                  key={item.id}
                  variant="outline" 
                  className={`h-auto min-h-[120px] flex flex-col gap-3 p-4 justify-center transition-colors ${getColorClasses(item.color)}`}
                  onClick={item.onClick}
                  aria-label={item.ariaLabel}
                >
                  <IconComponent className="w-6 h-6 flex-shrink-0" />
                  <span className="text-sm font-medium text-center">{item.title}</span>
                  <span className="text-xs text-center text-muted-foreground">{item.description}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />

      <NewCampaignModal 
        open={showNewCampaignModal}
        onOpenChange={setShowNewCampaignModal}
        onCampaignCreated={handleCampaignCreated}
      />
    </>
  );
};
