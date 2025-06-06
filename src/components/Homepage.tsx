
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ensureCampaignHasTasks } from "./homepage/CampaignAutoManager";
import { CampaignCard } from "./homepage/CampaignCard";
import { TaskList } from "./homepage/TaskList";
import { NewCampaignDialog } from "./homepage/NewCampaignDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSeasonalContent } from "./homepage/SeasonalContent";
import { getCurrentWeekNumber } from "./homepage/homepageUtils";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-garden-green-dark mb-2">
              Welcome to Your Marketing Hub
            </h1>
            <p className="text-garden-green">
              Plan, generate, and manage your content with ease
            </p>
          </div>
          
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

  const seasonalContent = getSeasonalContent();
  const weekNumber = getCurrentWeekNumber();
  const currentCampaign = campaigns.find(c => c.week_number === weekNumber) || campaigns[0];

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-garden-green-dark mb-2">
            Welcome to Your Marketing Hub
          </h1>
          <p className="text-garden-green">
            Plan, generate, and manage your content with ease
          </p>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-garden-green-dark">
            Current Campaign
          </h2>
          <Button onClick={() => setOpenNewCampaign(true)} className="bg-garden-green hover:bg-garden-green-dark text-white">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {currentCampaign ? (
          <CampaignCard campaign={currentCampaign} seasonalContent={seasonalContent} />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No campaigns found</p>
            <p className="text-gray-400">Create a new campaign to get started</p>
          </div>
        )}

        <h2 className="text-2xl font-semibold text-garden-green-dark">
          Content Tasks
        </h2>
        <TaskList tasks={tasks} onTaskUpdate={handleTaskUpdate} />
      </div>

      <NewCampaignDialog open={openNewCampaign} onOpenChange={setOpenNewCampaign} onCreate={handleCampaignCreate} />
    </div>
  );
};
