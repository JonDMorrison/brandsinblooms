
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Sparkles, CalendarPlus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";
import { toast } from "sonner";
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
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-create campaign for current week if user doesn't have one
  useEffect(() => {
    const autoCreateWeeklyContent = async () => {
      if (!user || activeCampaign || isAutoCreating) return;

      console.log('No campaign found for current week, auto-creating...');
      setIsAutoCreating(true);

      try {
        // Create a default campaign for the current week
        const campaignTitle = `Week ${currentWeekNumber} Marketing Campaign`;
        const startDate = new Date();
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + mondayOffset);

        const { data: newCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            title: campaignTitle,
            description: 'Auto-generated weekly marketing campaign with essential content for your garden center.',
            theme: 'Weekly Marketing',
            prompt: 'Create engaging marketing content for this week that promotes seasonal gardening activities and products.',
            start_date: weekStartDate.toISOString().split('T')[0],
            week_number: currentWeekNumber,
            source: 'auto_generated',
            user_id: user.id
          })
          .select()
          .single();

        if (campaignError) {
          console.error('Error creating auto campaign:', campaignError);
          return;
        }

        console.log('Auto-created campaign:', newCampaign);

        // Generate content tasks for the new campaign
        if (newCampaign) {
          await generateRequiredTasks(newCampaign.id, [newCampaign], user.id, onTaskUpdate);
          toast.success(`Welcome! We've created a marketing campaign for Week ${currentWeekNumber} with content ready for review.`);
          onCampaignCreated();
        }
      } catch (error) {
        console.error('Error auto-creating weekly content:', error);
      } finally {
        setIsAutoCreating(false);
      }
    };

    // Only auto-create if we don't have a campaign and user is authenticated
    if (!activeCampaign && user) {
      autoCreateWeeklyContent();
    }
  }, [activeCampaign, currentWeekNumber, user, isAutoCreating, onTaskUpdate, onCampaignCreated]);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
  };

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const actionItems = [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Custom Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      color: 'text-green-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: () => setShowNewCampaignDialog(true),
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Your Event',
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
      title: 'View Content Calendar',
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
              {isAutoCreating ? (
                <div className="text-primary">
                  <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
                  <h3 className="text-lg font-semibold mb-2">Setting Up Your Week {currentWeekNumber} Campaign</h3>
                  <p className="text-sm">
                    We're creating your weekly marketing content and generating engaging posts for review...
                  </p>
                </div>
              ) : (
                <div className="text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Campaign for Week {currentWeekNumber}</h3>
                  <p className="text-sm">
                    Create a campaign for the current week to start generating content.
                  </p>
                </div>
              )}
              {!isAutoCreating && (
                <Button 
                  onClick={onCreateCampaign}
                  className="bg-primary hover:bg-primary-600 text-white"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Campaign for Week {currentWeekNumber}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Quick Actions
        </h3>
        <Card className="shadow-lg border-gray-200 rounded-xl bg-white">
          <CardContent className="p-4 space-y-3">
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
          </CardContent>
        </Card>
      </div>

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
