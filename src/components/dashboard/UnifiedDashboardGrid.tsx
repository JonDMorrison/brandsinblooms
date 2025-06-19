import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { SampleCampaignCard } from "@/components/dashboard/SampleCampaignCard";
import { QuickActionsSection } from "@/components/dashboard/current-campaign/QuickActionsSection";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { SeasonalHolidaysCard } from "./seasonal-holidays/SeasonalHolidaysCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { useUser } from "@/hooks/useUser";
import type { Campaign } from "@/types/content";
import { toast } from "sonner";
import { EnhancedSeasonalHolidaysCard } from "./seasonal-holidays/EnhancedSeasonalHolidaysCard";

interface UnifiedDashboardGridProps {
  activeCampaign?: Campaign | null;
  userCreatedCampaigns?: Campaign[];
  tasks?: any[];
  onTaskUpdate: () => void;
  onCampaignCreated?: () => void;
  onCampaignUpdate?: () => void;
  onCreateCampaign?: () => void;
}

export const UnifiedDashboardGrid = ({ 
  activeCampaign,
  userCreatedCampaigns = [],
  tasks = [],
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCreateCampaign
}: UnifiedDashboardGridProps) => {
  const { user } = useAuth();
  const { isNewUser, loading } = useUser();
  const navigate = useNavigate();

  // State for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Quick action handlers
  const handleNewCampaignClick = () => {
    setShowNewCampaignModal(true);
  };

  const handleAddEventClick = () => {
    setShowAddEventDialog(true);
  };

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onTaskUpdate();
    onCampaignCreated?.();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreatedInternal = () => {
    setShowNewCampaignModal(false);
    onTaskUpdate();
    onCampaignCreated?.();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  // Filter ready tasks for the ReadyToPostCard
  const readyTasks = tasks.filter(task => 
    ['review', 'approved', 'posted'].includes(task.status) && 
    task.ai_output &&
    task.campaigns?.user_id === user?.id
  );

  return (
    <>
      <div className="space-y-8">
        {/* Current Campaign Section */}
        <CurrentCampaignSection 
          activeCampaign={activeCampaign}
          onTaskUpdate={onTaskUpdate}
          onCreateCampaign={onCreateCampaign || (() => {})}
          onCampaignCreated={onCampaignCreated || (() => {})}
        />

        {/* Enhanced Seasonal Holidays Section - Only show for authenticated users */}
        {user && (
          <div className="space-y-6">
            <div>
              <HeadlineLarge className="text-text-primary">
                Seasonal Marketing Opportunities
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary mt-1">
                Create timely content for upcoming holidays and observances
              </BodyMedium>
            </div>
            <EnhancedSeasonalHolidaysCard onContentGenerated={onTaskUpdate} />
          </div>
        )}

        {/* Sample Campaign Section - Only show for new users or non-authenticated */}
        {(!user || isNewUser) && (
          <div className="space-y-6">
            <div>
              <HeadlineLarge className="text-text-primary">
                Sample Campaign Preview
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary mt-1">
                See what your marketing content could look like
              </BodyMedium>
            </div>
            <SampleCampaignCard onCreateRealCampaign={onCreateCampaign || (() => {})} />
          </div>
        )}

        {/* Quick Actions */}
        <QuickActionsSection 
          onNewCampaignClick={handleNewCampaignClick}
          onAddEventClick={handleAddEventClick}
          onViewCalendar={handleViewCalendar}
        />

        {/* Ready to Post Section - Only show for authenticated users with ready content */}
        {user && readyTasks.length > 0 && (
          <div className="space-y-6">
            <div>
              <HeadlineLarge className="text-text-primary">
                Ready to Post
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary mt-1">
                Your content is ready to share with your audience
              </BodyMedium>
            </div>
            <ReadyToPostCard 
              tasks={readyTasks}
              onTaskUpdate={onTaskUpdate}
            />
          </div>
        )}
      </div>

      {/* Quick Action Modals */}
      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />

      <NewCampaignModal 
        open={showNewCampaignModal}
        onOpenChange={setShowNewCampaignModal}
        onCampaignCreated={handleCampaignCreatedInternal}
      />
    </>
  );
};
