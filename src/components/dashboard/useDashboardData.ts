
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useDashboardData = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('Dashboard: Fetching campaigns and tasks for user:', user.id);

      // Fetch campaigns with error handling
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      if (campaignsError) {
        console.error('Dashboard: Error fetching campaigns:', campaignsError);
        throw new Error(`Failed to load campaigns: ${campaignsError.message}`);
      }

      console.log('Dashboard: Loaded campaigns:', campaignsData?.length || 0);
      setCampaigns(campaignsData || []);

      // Fetch content tasks with campaign info
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
        console.error('Dashboard: Error fetching tasks:', tasksError);
        throw new Error(`Failed to load content tasks: ${tasksError.message}`);
      }

      console.log('Dashboard: Loaded tasks:', tasksData?.length || 0);
      setTasks(tasksData || []);

    } catch (error: any) {
      console.error('Dashboard: Error in fetchData:', error);
      setError(error.message || 'Failed to load dashboard data');
      toast.error(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleTaskUpdate = async () => {
    console.log('Dashboard: Task update triggered, refreshing data');
    await fetchData();
  };

  const handleCampaignCreated = async () => {
    console.log('Dashboard: Campaign created, refreshing data');
    await fetchData();
  };

  return {
    campaigns,
    tasks,
    loading,
    error,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch: fetchData
  };
};
