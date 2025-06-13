
import { useState, useEffect } from "react";
import { Palette, Calendar as CalendarIcon, Grid, Timeline, CheckSquare } from "lucide-react";
import { WeeklyThemeGenerator } from "./theme-generation/WeeklyThemeGenerator";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CampaignDetailsModal } from "./calendar/CampaignDetailsModal";
import { BulkOperationsBar } from "./calendar/BulkOperationsBar";
import { ContentPillarManager } from "./calendar/ContentPillarManager";
import { PublishingScheduleView } from "./calendar/PublishingScheduleView";
import { CampaignTemplateManager } from "./calendar/CampaignTemplateManager";
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
  const [selectedPillar, setSelectedPillar] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<"calendar" | "schedule">("calendar");
  const [selectionMode, setSelectionMode] = useState(false);

  // Update local campaigns when props change
  useEffect(() => {
    if (Array.isArray(campaigns)) {
      setLocalCampaigns(campaigns);
    }
  }, [campaigns]);

  // Check if campaigns need AI-generated themes - add safety check
  const campaignsNeedingThemes = Array.isArray(localCampaigns) ? localCampaigns.filter(campaign => 
    !campaign?.theme || campaign.theme.includes("Summer Heat Solutions") || campaign.theme === campaign.title
  ) : [];

  // Filter campaigns by selected pillar
  const filteredCampaigns = selectedPillar 
    ? localCampaigns.filter(campaign => 
        campaign.theme?.toLowerCase().includes(selectedPillar.toLowerCase()) ||
        campaign.description?.toLowerCase().includes(selectedPillar.toLowerCase())
      )
    : localCampaigns;

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

  const handleThemesGenerated = () => {
    if (onDataUpdate) {
      onDataUpdate();
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

  const handleTemplateApply = async (template: any) => {
    if (!selectedCampaign) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          theme: template.theme,
          description: template.description
        })
        .eq('id', selectedCampaign.id);

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
      {/* Header with Theme Generator */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4">
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
              
              <div className="flex items-center gap-2">
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
            
            {campaignsNeedingThemes.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full">
                  <Palette className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-purple-700 whitespace-nowrap">
                    {campaignsNeedingThemes.length} {campaignsNeedingThemes.length === 1 ? 'campaign needs' : 'campaigns need'} themes
                  </span>
                </div>
                <WeeklyThemeGenerator onThemesGenerated={handleThemesGenerated} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Pillar Filter */}
      <ContentPillarManager
        selectedPillar={selectedPillar}
        onPillarSelect={setSelectedPillar}
      />

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "calendar" | "schedule")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Grid className="w-4 h-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Timeline className="w-4 h-4" />
            Publishing Schedule
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="mt-6">
          <CalendarGrid
            campaigns={filteredCampaigns}
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
