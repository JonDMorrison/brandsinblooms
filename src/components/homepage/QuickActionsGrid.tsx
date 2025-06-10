
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, BarChart3, CalendarPlus, Sparkles } from "lucide-react";
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
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      color: 'text-green-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: () => setShowNewCampaignModal(true),
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      color: 'text-gray-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: () => setShowAddEventDialog(true),
      ariaLabel: 'Add a new event to promote'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      color: 'text-blue-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: handleViewCalendar,
      ariaLabel: 'View content calendar'
    }
  ];

  return (
    <>
      <Card className="shadow-lg border-gray-200 rounded-xl bg-white">
        <CardContent className="p-6 bg-white">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold text-black">Quick Actions</h3>
          </div>
          
          <div className="flex flex-col items-start space-y-4">
            {actionItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.id}
                  className={`w-full border border-gray-200 rounded-lg px-4 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md hover:border-gray-300 ${item.bgColor}`}
                  onClick={item.onClick}
                  role="button"
                  tabIndex={0}
                  aria-label={item.ariaLabel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <IconComponent className={`w-6 h-6 ${item.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-black mb-1">
                        {item.title}
                      </h4>
                      
                      <p className="text-sm text-gray-600 leading-relaxed mb-1 text-wrap overflow-hidden">
                        {item.description}
                      </p>
                      
                      <p className="text-sm text-gray-500 leading-relaxed text-wrap overflow-hidden">
                        {item.benefit}
                      </p>
                    </div>
                  </div>
                </div>
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
