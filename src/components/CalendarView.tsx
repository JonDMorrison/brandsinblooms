
import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Grid, Calendar, CheckSquare, PlusCircle, CalendarPlus } from "lucide-react";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CampaignDetailsModal } from "./calendar/CampaignDetailsModal";
import { BulkOperationsBar } from "./calendar/BulkOperationsBar";
import { PublishingScheduleView } from "./calendar/PublishingScheduleView";
import { CampaignTemplateManager } from "./calendar/CampaignTemplateManager";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  
  // Add state for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Update local campaigns when props change
  useEffect(() => {
    if (Array.isArray(campaigns)) {
      setLocalCampaigns(campaigns);
    }
  }, [campaigns]);

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

  const handleCreateCampaign = (date: Date) => {
    console.log('Create campaign for date:', date);
    // TODO: Implement campaign creation
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

  const handleTemplateApply = async (template: any) => {
    if (!selectedCampaign) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          theme: template.theme,
          description: template.description
        })
        .eq('id', selectedCampaign.id.toString());

      if (error) throw error;

      handleCampaignUpdate({
        ...selectedCampaign,
        theme: template.theme,
        description: template.description
      });
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Failed to apply template');
    }
  };

  const clearSelection = () => {
    setSelectedCampaigns([]);
    setSelectionMode(false);
  };

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    if (onDataUpdate) onDataUpdate();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    if (onDataUpdate) onDataUpdate();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  return (
    <div className="w-full max-w-none space-y-6 bg-white overflow-hidden">
      {/* Header with Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
              <CalendarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                Campaign Calendar
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Plan, organize, and manage your year-long content strategy
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Action Buttons */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewCampaignModal(true)}
                className="flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Create Campaign
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddEventDialog(true)}
                className="flex items-center gap-2"
              >
                <CalendarPlus className="w-4 h-4" />
                Promote Event
              </Button>
              
              <CampaignTemplateManager
                onTemplateApply={handleTemplateApply}
                selectedCampaign={selectedCampaign || undefined}
              />
              
              <Button
                size="sm"
                variant={selectionMode ? "default" : "outline"}
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) clearSelection();
                }}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectionMode ? 'Exit Selection' : 'Select Multiple'}
              </Button>
            </div>
          </div>
        </div>
      </div>

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
            onCampaignClick={handleCampaignClick}
            onCreateCampaign={handleCreateCampaign}
            selectionMode={selectionMode}
            selectedCampaigns={selectedCampaigns}
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

      {/* Bulk Operations Bar */}
      <BulkOperationsBar
        selectedCampaigns={selectedCampaigns}
        onClearSelection={clearSelection}
        onOperationComplete={() => {
          clearSelection();
          if (onDataUpdate) onDataUpdate();
        }}
      />

      {/* Quick Action Modals */}
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
    </div>
  );
};
