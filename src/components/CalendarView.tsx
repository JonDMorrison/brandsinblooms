
import { useState, useEffect } from "react";
import { Grid, Calendar } from "lucide-react";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CampaignDetailsModal } from "./calendar/CampaignDetailsModal";
import { BulkOperationsBar } from "./calendar/BulkOperationsBar";
import { PublishingScheduleView } from "./calendar/PublishingScheduleView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskSelection } from "@/hooks/useTaskSelection";
import { useEnhancedDragAndDrop } from "@/hooks/useEnhancedDragAndDrop";
import { ContentTaskItem } from "@/components/content/ContentTaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  campaigns?: {
    title: string;
  };
}

interface CalendarViewProps {
  campaigns: Campaign[];
  tasks?: Task[];
  onDataUpdate?: () => void;
}

export const CalendarView = ({ campaigns = [], tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState<Campaign[]>(campaigns);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Campaign[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<"calendar" | "schedule">("calendar");
  const [selectionMode, setSelectionMode] = useState(false);
  
  // Task viewing
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Task selection and drag & drop
  const {
    selectedTasks,
    selectionMode: taskSelectionMode,
    toggleTaskSelection,
    clearSelection: clearTaskSelection,
    isTaskSelected
  } = useTaskSelection();

  const {
    isDragging,
    draggedTasks,
    dragPreview,
    handleDragStart,
    handleDragEnd,
    handleDrop
  } = useEnhancedDragAndDrop(() => {
    if (onDataUpdate) {
      onDataUpdate();
    }
  });

  // Update local campaigns when props change
  useEffect(() => {
    if (Array.isArray(campaigns)) {
      setLocalCampaigns(campaigns);
    }
  }, [campaigns]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTaskSelection();
        setSelectedCampaigns([]);
        setSelectionMode(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clearTaskSelection]);

  const handleCampaignClick = (campaign: Campaign) => {
    if (selectionMode) {
      const isSelected = selectedCampaigns.some(c => c.id === campaign.id);
      if (isSelected) {
        setSelectedCampaigns(selectedCampaigns.filter(c => c.id !== campaign.id));
      } else {
        setSelectedCampaigns([...selectedCampaigns, campaign]);
      }
    } else {
      setSelectedCampaign(campaign);
      setIsModalOpen(true);
    }
  };

  const handleTaskClick = (task: Task) => {
    if (!taskSelectionMode) {
      setSelectedTask(task);
      setIsTaskModalOpen(true);
    }
  };

  const handleCampaignUpdate = (updatedCampaign: Campaign) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === updatedCampaign.id ? updatedCampaign : campaign
      )
    );
    if (onDataUpdate) {
      onDataUpdate();
    }
  };

  const clearSelection = () => {
    setSelectedCampaigns([]);
    setSelectionMode(false);
    clearTaskSelection();
  };

  const handleTaskDragStart = (tasksToMove: Task[]) => {
    // Clear any existing task selection when starting drag
    if (!taskSelectionMode) {
      clearTaskSelection();
    }
    handleDragStart(tasksToMove);
  };

  return (
    <div className="w-full max-w-none space-y-6 bg-white overflow-hidden" data-calendar-section="true">
      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "calendar" | "schedule")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Grid className="w-4 h-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Publishing Schedule
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="mt-6">
          <CalendarGrid
            campaigns={localCampaigns}
            tasks={tasks}
            onCampaignClick={handleCampaignClick}
            onTaskClick={handleTaskClick}
            selectionMode={selectionMode}
            selectedCampaigns={selectedCampaigns}
            selectedTasks={selectedTasks}
            isDragging={isDragging}
            draggedTasks={draggedTasks}
            dragPreview={dragPreview}
            onTaskSelection={toggleTaskSelection}
            onDragStart={handleTaskDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            isTaskSelected={isTaskSelected}
            taskSelectionMode={taskSelectionMode}
          />
        </TabsContent>
        
        <TabsContent value="schedule" className="mt-6">
          <PublishingScheduleView />
        </TabsContent>
      </Tabs>

      {/* Campaign Details Modal */}
      <CampaignDetailsModal
        campaign={selectedCampaign}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={handleCampaignUpdate}
      />

      {/* Task Content Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white z-[100] border border-gray-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">
                {selectedTask?.post_type === 'facebook' && '📘'}
                {selectedTask?.post_type === 'instagram' && '📷'}
                {selectedTask?.post_type === 'email' && '📧'}
                {selectedTask?.post_type === 'newsletter' && '📰'}
                {selectedTask?.post_type === 'video' && '🎥'}
                {(!selectedTask?.post_type || !['facebook', 'instagram', 'email', 'newsletter', 'video'].includes(selectedTask.post_type)) && '📝'}
              </span>
              {selectedTask?.post_type && (
                <span className="capitalize">{selectedTask.post_type} Content</span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="mt-4">
              <ContentTaskItem 
                task={selectedTask} 
                onTaskUpdate={() => {
                  if (onDataUpdate) onDataUpdate();
                  setIsTaskModalOpen(false);
                }} 
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Operations Bar */}
      <BulkOperationsBar
        selectedCampaigns={selectedCampaigns}
        onClearSelection={clearSelection}
        onOperationComplete={() => {
          clearSelection();
          if (onDataUpdate) onDataUpdate();
        }}
      />

      {/* Task Selection Info */}
      {taskSelectionMode && selectedTasks.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <span className="font-medium">
            {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
          </span>
          <button 
            onClick={clearTaskSelection}
            className="text-blue-200 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
