
import { CalendarView } from "@/components/CalendarView";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { CalendarPlus, PlusCircle } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { toast } from "sonner";

const CalendarPage = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      
      console.log('Fetching campaigns and tasks...');
      
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      if (campaignsError) {
        console.error('Error fetching campaigns:', campaignsError);
        throw campaignsError;
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            week_number,
            start_date
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        throw tasksError;
      }

      console.log('Fetched campaigns:', campaignsData?.length || 0);
      console.log('Fetched tasks:', tasksData?.length || 0);

      setCampaigns(campaignsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    fetchData();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    fetchData();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-primary font-medium">Loading calendar...</p>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <p className="text-lg font-medium">Error loading calendar</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <div className="p-6 border-b border-green-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-garden-green-dark">Campaign Calendar</h1>
            <p className="text-garden-green font-medium">View and schedule your marketing campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowAddEventDialog(true)}
              className="flex items-center gap-2"
            >
              <CalendarPlus className="w-4 h-4" />
              Promote Event
            </Button>
            
            <Button
              onClick={() => setShowNewCampaignModal(true)}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>
      <div className="p-6 bg-white w-full">
        <CalendarView 
          campaigns={campaigns} 
          tasks={tasks}
          onDataUpdate={fetchData}
        />
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
        onCampaignCreated={handleCampaignCreated}
      />
    </ProtectedPageWrapper>
  );
};

export default CalendarPage;
