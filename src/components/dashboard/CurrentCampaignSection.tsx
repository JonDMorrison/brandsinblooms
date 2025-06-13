
import { useState } from "react";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { AutoCampaignCreator } from "./current-campaign/AutoCampaignCreator";
import { NoCampaignState } from "./current-campaign/NoCampaignState";
import { QuickActionsSection } from "./current-campaign/QuickActionsSection";
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

  const { isAutoCreating } = AutoCampaignCreator({
    activeCampaign,
    currentWeekNumber,
    onCampaignCreated,
    onTaskUpdate
  });

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
  };

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
        <NoCampaignState
          currentWeekNumber={currentWeekNumber}
          isAutoCreating={isAutoCreating}
          onCreateCampaign={() => setShowNewCampaignDialog(true)}
        />
      )}

      <QuickActionsSection
        onNewCampaignClick={() => setShowNewCampaignDialog(true)}
        onAddEventClick={() => setShowAddEventDialog(true)}
        onViewCalendar={() => {}}
      />

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
