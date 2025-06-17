
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useCurrentCampaignSection = (activeCampaign: any) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!activeCampaign || !user) {
        console.log('CurrentCampaignSection: Skipping fetch - activeCampaign:', !!activeCampaign, 'user:', !!user);
        setTasks([]);
        setLoading(false);
        return;
      }

      console.log('CurrentCampaignSection: Fetching tasks for campaign:', activeCampaign.id, 'user:', user.id);
      setLoading(true);

      try {
        // SECURITY FIX: First verify the campaign belongs to the current user
        if (activeCampaign.user_id !== user.id) {
          console.error('CurrentCampaignSection: Campaign does not belong to current user');
          setTasks([]);
          setLoading(false);
          return;
        }

        // SECURITY FIX: Use inner join to ensure we only get tasks for user's campaigns
        const { data, error } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns!inner (
              title,
              user_id
            )
          `)
          .eq('campaign_id', activeCampaign.id)
          .eq('campaigns.user_id', user.id)  // CRITICAL: Verify campaign ownership
          .order('created_at', { ascending: false });

        if (error) {
          console.error('CurrentCampaignSection: Error fetching tasks:', error);
          setTasks([]);
        } else {
          console.log('CurrentCampaignSection: Successfully fetched', data?.length || 0, 'tasks for user', user.id);
          
          // Additional security verification
          const userTasks = data?.filter(task => 
            task.campaigns && task.campaigns.user_id === user.id
          ) || [];
          
          if (userTasks.length !== data?.length) {
            console.warn('CurrentCampaignSection: Security alert - some tasks did not belong to current user');
          }
          
          setTasks(userTasks);
        }
      } catch (error) {
        console.error('CurrentCampaignSection: Error in fetchTasks:', error);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [activeCampaign, user]);

  const handleTaskClick = (task: any) => {
    // SECURITY CHECK: Verify task belongs to current user before opening
    if (!user || !task.campaigns || task.campaigns.user_id !== user.id) {
      console.error('CurrentCampaignSection: Attempted to access task not owned by current user');
      return;
    }
    
    setSelectedTask(task);
    setShowContentViewer(true);
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
  };

  return {
    tasks,
    loading,
    selectedTask,
    showContentViewer,
    handleTaskClick,
    handleContentViewerClose
  };
};
