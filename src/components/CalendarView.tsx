import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Grid, Calendar, CheckSquare } from "lucide-react";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CampaignDetailsModal } from "./calendar/CampaignDetailsModal";
import { BulkOperationsBar } from "./calendar/BulkOperationsBar";
import { PublishingScheduleView } from "./calendar/PublishingScheduleView";
import { CampaignTemplateManager } from "./calendar/CampaignTemplateManager";
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

  return (
    <div className="w-full max-w-none space-y-6 bg-white overflow-hidden">
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
    </div>
  );
};
