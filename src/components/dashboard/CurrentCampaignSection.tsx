
import { useState, useEffect } from "react";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { AutoCampaignCreator } from "./current-campaign/AutoCampaignCreator";
import { NoCampaignState } from "./current-campaign/NoCampaignState";
import { QuickActionsSection } from "./current-campaign/QuickActionsSection";
import { ContentPreviewSection } from "./ContentPreviewSection";
import { AppleCard, AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { supabase } from "@/integrations/supabase/client";
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
  const [hasContent, setHasContent] = useState(false);

  const { isAutoCreating } = AutoCampaignCreator({
    activeCampaign,
    currentWeekNumber,
    onCampaignCreated,
    onTaskUpdate
  });

  // Check if campaign has content
  useEffect(() => {
    const checkForContent = async () => {
      if (!activeCampaign?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('id, ai_output')
          .eq('campaign_id', activeCampaign.id);

        if (!error && data) {
          const contentExists = data.some(task => task.ai_output && task.ai_output.trim() !== '');
          setHasContent(contentExists);
        }
      } catch (error) {
        console.error('Error checking for content:', error);
      }
    };

    checkForContent();
  }, [activeCampaign?.id, totalTasksCount]);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <AppleCard variant="default" surface="secondary">
        <AppleCardHeader className="pb-4">
          <HeadlineLarge className="text-text-primary">
            Current Campaign
          </HeadlineLarge>
          <BodyMedium className="text-text-secondary">
            Week {currentWeekNumber} • {totalTasksCount > 0 ? `${completedTasksCount} of ${totalTasksCount} tasks completed` : 'No tasks yet'}
          </BodyMedium>
        </AppleCardHeader>
      </AppleCard>
      
      {/* Campaign Content */}
      {activeCampaign ? (
        <div className="space-y-6">
          <CampaignCard 
            campaign={activeCampaign} 
            onTaskUpdate={onTaskUpdate}
            onCampaignUpdate={onTaskUpdate}
          />
          
          {/* AI Content Preview */}
          <ContentPreviewSection
            campaign={activeCampaign}
            onTaskUpdate={onTaskUpdate}
          />
        </div>
      ) : (
        <NoCampaignState
          currentWeekNumber={currentWeekNumber}
          isAutoCreating={isAutoCreating}
          onCreateCampaign={() => setShowNewCampaignDialog(true)}
        />
      )}

      {/* Quick Actions */}
      <QuickActionsSection
        onNewCampaignClick={() => setShowNewCampaignDialog(true)}
        onAddEventClick={() => setShowAddEventDialog(true)}
        onViewCalendar={() => {}}
      />

      {/* Dialogs */}
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
