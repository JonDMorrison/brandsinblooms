
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ensureCampaignHasTasks } from "./homepage/CampaignAutoManager";
import { NewCampaignDialog } from "./homepage/NewCampaignDialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "./homepage/homepageUtils";
import { HomepageHeader } from "./homepage/HomepageHeader";
import { HomepageActions } from "./homepage/HomepageActions";
import { HomepageMainContent } from "./homepage/HomepageMainContent";
import { HomepageSidebar } from "./homepage/HomepageSidebar";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

export const Homepage = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNewCampaign, setOpenNewCampaign] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        toast.error('Failed to load campaigns');
      } else {
        setCampaigns(data || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to load tasks');
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignCreate = async (newCampaign: Omit<Campaign, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([newCampaign])
        .select()

      if (error) {
        console.error('Error creating campaign:', error);
        toast.error('Failed to create campaign');
      } else {
        setCampaigns(prevCampaigns => [data[0], ...prevCampaigns]);
        toast.success('Campaign created successfully');
        setOpenNewCampaign(false);
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleTaskUpdate = () => {
    fetchTasks();
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchTasks();
    }
  }, [user]);

  useEffect(() => {
    if (campaigns.length > 0 && user) {
      ensureCampaignHasTasks(campaigns, user.id, handleTaskUpdate);
    }
  }, [campaigns, user]);

  const handleThemesGenerated = () => {
    fetchCampaigns();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <HomepageHeader 
            onNewCampaignClick={() => setOpenNewCampaign(true)} 
            onImportComplete={fetchCampaigns} 
          />
          
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-primary font-medium text-lg">Loading your campaigns and content...</p>
              <p className="text-gray-500 text-sm mt-2">Setting up your marketing workspace</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const weekNumber = getCurrentWeekNumber();
  
  // Always prioritize finding a campaign for the current week
  let currentCampaign = campaigns.find(c => c.week_number === weekNumber);
  
  // If no campaign exists for current week, we should indicate this clearly
  // rather than falling back to week 1
  if (!currentCampaign && campaigns.length > 0) {
    console.log(`No campaign found for current week ${weekNumber}, available weeks:`, 
      campaigns.map(c => c.week_number));
  }

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <HomepageHeader 
          onNewCampaignClick={() => setOpenNewCampaign(true)} 
          onImportComplete={fetchCampaigns} 
        />

        <HomepageActions 
          onNewCampaignClick={() => setOpenNewCampaign(true)} 
          onImportComplete={fetchCampaigns} 
        />

        <div className="grid lg:grid-cols-3 gap-6">
          <HomepageMainContent 
            currentCampaign={currentCampaign}
            onTaskUpdate={handleTaskUpdate}
          />
          
          <HomepageSidebar onThemesGenerated={handleThemesGenerated} />
        </div>
      </div>

      <NewCampaignDialog 
        open={openNewCampaign} 
        onOpenChange={setOpenNewCampaign} 
        onCreate={handleCampaignCreate} 
      />
    </div>
  );
};
