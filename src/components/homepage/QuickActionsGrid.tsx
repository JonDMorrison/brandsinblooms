
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, BarChart3, CalendarPlus, Sparkles, CheckCircle } from "lucide-react";
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
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    onCampaignCreated();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
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
      title: 'Create Campaign',
      description: 'Build a themed marketing campaign',
      benefit: 'Get 5+ content pieces instantly',
      color: 'primary',
      onClick: () => setShowNewCampaignModal(true),
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your event',
      benefit: 'Custom promotional content',
      color: 'green',
      onClick: () => setShowAddEventDialog(true),
      ariaLabel: 'Add a new event to promote'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content',
      benefit: 'Stay organized & consistent',
      color: 'blue',
      onClick: handleViewCalendar,
      ariaLabel: 'View content calendar'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      title: 'View Analytics',
      description: 'Track your performance',
      benefit: 'Optimize your strategy',
      color: 'purple',
      onClick: handleViewAnalytics,
      ariaLabel: 'View analytics dashboard'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700 bg-blue-25';
      case 'purple':
        return 'border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-700 bg-purple-25';
      case 'green':
        return 'border-green-200 hover:bg-green-50 hover:border-green-300 text-green-700 bg-green-25';
      default:
        return 'border-primary/30 hover:bg-primary/10 hover:border-primary/50 text-primary bg-primary/5';
    }
  };

  return (
    <>
      <Card className="shadow-lg border-primary/20 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold text-black">Quick Actions</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Start here</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <Button 
                  key={item.id}
                  variant="outline" 
                  className={`h-auto flex flex-col gap-3 p-4 justify-start items-center transition-all duration-200 hover:scale-105 hover:shadow-md ${getColorClasses(item.color)} min-h-[240px] sm:min-h-[220px] lg:min-h-[200px]`}
                  onClick={item.onClick}
                  aria-label={item.ariaLabel}
                >
                  <IconComponent className="w-8 h-8 flex-shrink-0 mt-2" />
                  <div className="text-center space-y-2 flex-1 flex flex-col justify-center">
                    <div className="font-semibold text-black text-sm leading-tight">{item.title}</div>
                    <div className="text-xs text-gray-600 leading-relaxed">{item.description}</div>
                    <div className="text-xs font-medium text-current opacity-80 leading-relaxed">{item.benefit}</div>
                  </div>
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
