
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
      console.log('CurrentCampaignSection: Campaign details:', {
        id: activeCampaign.id,
        title: activeCampaign.title,
        user_id: activeCampaign.user_id,
        currentUserId: user.id
      });
      
      setLoading(true);

      try {
        // Simplified security check - verify campaign belongs to current user
        if (activeCampaign.user_id && activeCampaign.user_id !== user.id) {
          console.error('CurrentCampaignSection: Campaign does not belong to current user');
          setTasks([]);
          setLoading(false);
          return;
        }

        // Fetch tasks with a simplified query that focuses on the essential data
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
          .order('created_at', { ascending: false });

        if (error) {
          console.error('CurrentCampaignSection: Error fetching tasks:', error);
          setTasks([]);
        } else {
          console.log('CurrentCampaignSection: Raw tasks response:', data);
          
          // Filter tasks to ensure they belong to the current user
          const userTasks = data?.filter(task => {
            const belongsToUser = task.campaigns && task.campaigns.user_id === user.id;
            console.log('CurrentCampaignSection: Task filter check:', {
              taskId: task.id,
              taskType: task.post_type,
              campaigns: task.campaigns,
              belongsToUser
            });
            return belongsToUser;
          }) || [];
          
          console.log('CurrentCampaignSection: Filtered tasks for user:', userTasks.length, 'out of', data?.length || 0);
          
          if (userTasks.length > 0) {
            console.log('CurrentCampaignSection: Sample task:', {
              id: userTasks[0].id,
              post_type: userTasks[0].post_type,
              status: userTasks[0].status,
              hasAiOutput: !!userTasks[0].ai_output,
              aiOutputLength: userTasks[0].ai_output?.length || 0
            });
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
    // Security check: Verify task belongs to current user before opening
    if (!user || !task.campaigns || task.campaigns.user_id !== user.id) {
      console.error('CurrentCampaignSection: Attempted to access task not owned by current user');
      return;
    }
    
    console.log('CurrentCampaignSection: Opening task:', task.id, task.post_type);
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
