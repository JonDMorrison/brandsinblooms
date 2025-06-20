import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useCurrentCampaignSection = (activeCampaign: any) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  useEffect(() => {
    const fetchTasks = async () => {
      console.log('useCurrentCampaignSection: Starting fetchTasks');
      console.log('useCurrentCampaignSection: activeCampaign:', activeCampaign);
      console.log('useCurrentCampaignSection: user:', user?.id);

      if (!activeCampaign || !user) {
        console.log('useCurrentCampaignSection: Missing requirements - activeCampaign:', !!activeCampaign, 'user:', !!user);
        setTasks([]);
        setLoading(false);
        return;
      }

      console.log('useCurrentCampaignSection: Fetching tasks for campaign:', {
        campaignId: activeCampaign.id,
        campaignTitle: activeCampaign.title,
        campaignUserId: activeCampaign.user_id,
        currentUserId: user.id,
        isDeveloper
      });
      
      setLoading(true);

      try {
        // Security check - verify campaign belongs to current user
        if (activeCampaign.user_id && activeCampaign.user_id !== user.id) {
          console.error('useCurrentCampaignSection: Campaign does not belong to current user');
          setTasks([]);
          setLoading(false);
          return;
        }

        // Build status filter - include 'preview' for developer
        const statusFilter = ['planned', 'review', 'approved', 'posted', 'generated'];
        if (isDeveloper) {
          statusFilter.push('preview');
        }

        // Fetch tasks for this specific campaign
        console.log('useCurrentCampaignSection: Executing query for campaign_id:', activeCampaign.id);
        
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
          .in('status', statusFilter)
          .order('created_at', { ascending: false });

        console.log('useCurrentCampaignSection: Query result:', { data, error });

        if (error) {
          console.error('useCurrentCampaignSection: Error fetching tasks:', error);
          setTasks([]);
        } else {
          console.log('useCurrentCampaignSection: Raw tasks response:', data);
          
          // Filter tasks to ensure they belong to the current user (double-check security)
          const userTasks = data?.filter(task => {
            const belongsToUser = task.campaigns && task.campaigns.user_id === user.id;
            console.log('useCurrentCampaignSection: Task security check:', {
              taskId: task.id,
              taskType: task.post_type,
              campaignsData: task.campaigns,
              belongsToUser,
              isPreview: task.status === 'preview'
            });
            return belongsToUser;
          }) || [];
          
          console.log('useCurrentCampaignSection: Final filtered tasks:', userTasks.length, 'out of', data?.length || 0);
          
          if (userTasks.length > 0) {
            console.log('useCurrentCampaignSection: Sample task data:', {
              id: userTasks[0].id,
              post_type: userTasks[0].post_type,
              status: userTasks[0].status,
              hasAiOutput: !!userTasks[0].ai_output,
              aiOutputPreview: userTasks[0].ai_output?.substring(0, 50) || 'No content'
            });
          }
          
          console.log('useCurrentCampaignSection: Setting tasks state with:', userTasks);
          setTasks(userTasks);
        }
      } catch (error) {
        console.error('useCurrentCampaignSection: Error in fetchTasks:', error);
        setTasks([]);
      } finally {
        setLoading(false);
        console.log('useCurrentCampaignSection: Fetch completed');
      }
    };

    fetchTasks();
  }, [activeCampaign, user, isDeveloper]);

  const handleTaskClick = (task: any) => {
    // Security check: Verify task belongs to current user before opening
    if (!user || !task.campaigns || task.campaigns.user_id !== user.id) {
      console.error('useCurrentCampaignSection: Attempted to access task not owned by current user');
      return;
    }
    
    console.log('useCurrentCampaignSection: Opening task:', task.id, task.post_type);
    setSelectedTask(task);
    setShowContentViewer(true);
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
  };

  console.log('useCurrentCampaignSection: Hook returning:', {
    tasksCount: tasks.length,
    loading,
    selectedTask: selectedTask?.id,
    showContentViewer
  });

  return {
    tasks,
    loading,
    selectedTask,
    showContentViewer,
    handleTaskClick,
    handleContentViewerClose
  };
};
