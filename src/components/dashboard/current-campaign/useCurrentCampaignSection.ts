
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

export const useCurrentCampaignSection = (activeCampaign: any) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  useEffect(() => {
    const fetchTasks = async () => {
      // 🔧 FIXED: Add better dependency checking to prevent unnecessary re-runs
      if (!activeCampaign?.id || !user?.id || !tenant?.id) {
        console.log('useCurrentCampaignSection: Missing requirements - activeCampaign:', !!activeCampaign?.id, 'user:', !!user?.id, 'tenant:', !!tenant?.id);
        setTasks([]);
        setLoading(false);
        return;
      }

      console.log('useCurrentCampaignSection: Starting fetchTasks for campaign:', {
        campaignId: activeCampaign.id,
        campaignTitle: activeCampaign.title,
        isPreviewCampaign: activeCampaign.title?.startsWith('PREVIEW'),
        tenantId: tenant.id,
        currentUserId: user.id,
        isDevelopment
      });
      
      setLoading(true);

      try {
        // 🔧 FIXED: Properly include preview status for development
        const statusFilter = ['generating', 'review', 'ready', 'approved', 'posted'];
        if (isDevelopment) {
          statusFilter.push('preview');
          console.log('useCurrentCampaignSection: Development mode - including preview status');
        }

        // Fetch tasks for this specific campaign with tenant security
        console.log('useCurrentCampaignSection: Executing query for campaign_id:', activeCampaign.id);
        
        const { data, error } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns!inner (
              title,
              tenant_id
            )
          `)
          .eq('campaign_id', activeCampaign.id)
          .eq('tenant_id', tenant.id)  // SECURITY: Filter by current tenant
          .in('status', statusFilter)
          .order('created_at', { ascending: false });

        console.log('useCurrentCampaignSection: Query result:', { data, error });

        if (error) {
          console.error('useCurrentCampaignSection: Error fetching tasks:', error);
          setTasks([]);
        } else {
          console.log('useCurrentCampaignSection: Raw tasks response:', data);
          
          // Additional security check: Verify all tasks belong to current tenant
          const tenantTasks = data?.filter(task => {
            const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
            console.log('useCurrentCampaignSection: Task security check:', {
              taskId: task.id,
              taskType: task.post_type,
              status: task.status,
              campaignsData: task.campaigns,
              belongsToTenant,
              isPreview: task.status === 'preview',
              isPreviewCampaign: task.campaigns?.title?.startsWith('PREVIEW')
            });
            return belongsToTenant;
          }) || [];
          
          console.log('useCurrentCampaignSection: Final filtered tasks:', tenantTasks.length, 'out of', data?.length || 0, '(isDevelopment:', isDevelopment, ')');
          
          if (tenantTasks.length > 0) {
            console.log('useCurrentCampaignSection: Sample task data:', {
              id: tenantTasks[0].id,
              post_type: tenantTasks[0].post_type,
              status: tenantTasks[0].status,
              hasAiOutput: !!tenantTasks[0].ai_output,
              aiOutputPreview: tenantTasks[0].ai_output?.substring(0, 50) || 'No content',
              isPreview: tenantTasks[0].status === 'preview'
            });
          }
          
          console.log('useCurrentCampaignSection: Setting tasks state with:', tenantTasks);
          setTasks(tenantTasks);
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
  }, [activeCampaign?.id, user?.id, tenant?.id, isDevelopment]); // 🔧 FIXED: More specific dependencies

  const handleTaskClick = (task: any) => {
    // Security check: Verify task belongs to current tenant before opening
    if (!user || !tenant || !task.campaigns || task.campaigns.tenant_id !== tenant.id) {
      console.error('useCurrentCampaignSection: Attempted to access task not owned by current tenant');
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
    showContentViewer,
    isDevelopment
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
