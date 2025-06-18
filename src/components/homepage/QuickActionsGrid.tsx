
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
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

  const actionItems = [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      color: 'text-green-600',
      onClick: () => setShowNewCampaignModal(true),
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      color: 'text-blue-600',
      onClick: () => setShowAddEventDialog(true),
      ariaLabel: 'Add a new event to promote'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      color: 'text-purple-600',
      onClick: handleViewCalendar,
      ariaLabel: 'View content calendar'
    }
  ];

  return (
    <>
      <EnhancedAppleCard 
        variant="elevated" 
        surface="primary" 
        className="shadow-lg border-gray-200 rounded-xl"
        hoverEffect="subtle"
        animated={true}
      >
        <AppleCardContent className="responsive-padding">
          <div className="flex items-center gap-2 mb-6 apple-slide-up">
            <Sparkles className="w-5 h-5 text-primary apple-icon-bounce" />
            <HeadlineLarge className="text-text-primary apple-text-glow">Quick Actions</HeadlineLarge>
          </div>
          
          <div className="flex flex-col items-start space-y-4">
            {actionItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.id}
                  className={`w-full border border-gray-200 rounded-lg p-4 cursor-pointer apple-hover-subtle apple-stagger-${Math.min(index + 1, 4)}`}
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
                    <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg apple-hover-subtle">
                      <IconComponent className={`w-5 h-5 ${item.color} apple-icon-bounce`} />
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-1">
                      <HeadlineLarge className="text-text-primary apple-text-glow">
                        {item.title}
                      </HeadlineLarge>
                      
                      <BodyMedium className="text-text-secondary apple-color-transition">
                        {item.description}
                      </BodyMedium>
                      
                      <CaptionMedium className="text-text-tertiary apple-color-transition">
                        {item.benefit}
                      </CaptionMedium>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>

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
