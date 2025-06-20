
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
      // 🔧 HYBRID: Support both tenant-based and user-based filtering
      if (!activeCampaign?.id || !user?.id) {
        console.log('useCurrentCampaignSection: Missing requirements - activeCampaign:', !!activeCampaign?.id, 'user:', !!user?.id);
        setTasks([]);
        setLoading(false);
        return;
      }

      console.log('useCurrentCampaignSection: Starting fetchTasks for campaign:', {
        campaignId: activeCampaign.id,
        campaignTitle: activeCampaign.title,
        isPreviewCampaign: activeCampaign.title?.startsWith('PREVIEW'),
        tenantId: tenant?.id || 'none',
        currentUserId: user.id,
        isDevelopment,
        usesTenantModel: !!tenant?.id
      });
      
      setLoading(true);

      try {
        // 🔧 FIXED: Properly include preview status for development
        const statusFilter = ['generating', 'review', 'ready', 'approved', 'posted'];
        if (isDevelopment) {
          statusFilter.push('preview');
          console.log('useCurrentCampaignSection: Development mode - including preview status');
        }

        // Fetch tasks for this specific campaign with hybrid security model
        console.log('useCurrentCampaignSection: Executing query for campaign_id:', activeCampaign.id);
        
        let query = supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns!inner (
              title,
              tenant_id,
              user_id
            )
          `)
          .eq('campaign_id', activeCampaign.id)
          .in('status', statusFilter)
          .order('created_at', { ascending: false });

        // 🔧 HYBRID: Apply appropriate filtering based on available data
        if (tenant?.id) {
          // If user has tenant, use tenant-based filtering (new multi-tenant model)
          query = query.eq('tenant_id', tenant.id);
          console.log('useCurrentCampaignSection: Using tenant-based filtering for tenant:', tenant.id);
        } else {
          // If no tenant, fall back to user-based filtering (legacy single-user model)
          query = query.eq('user_id', user.id);
          console.log('useCurrentCampaignSection: Using user-based filtering for user:', user.id);
        }

        const { data, error } = await query;

        console.log('useCurrentCampaignSection: Query result:', { data, error });

        if (error) {
          console.error('useCurrentCampaignSection: Error fetching tasks:', error);
          setTasks([]);
        } else {
          console.log('useCurrentCampaignSection: Raw tasks response:', data);
          
          // 🔧 HYBRID: Security check based on available model
          const securityCheckedTasks = data?.filter(task => {
            if (tenant?.id) {
              // Tenant-based security: Verify task belongs to current tenant
              const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
              console.log('useCurrentCampaignSection: Tenant security check:', {
                taskId: task.id,
                taskType: task.post_type,
                status: task.status,
                campaignsData: task.campaigns,
                belongsToTenant,
                isPreview: task.status === 'preview'
              });
              return belongsToTenant;
            } else {
              // User-based security: Verify task belongs to current user
              const belongsToUser = task.campaigns && (task.campaigns.user_id === user.id || task.user_id === user.id);
              console.log('useCurrentCampaignSection: User security check:', {
                taskId: task.id,
                taskType: task.post_type,
                status: task.status,
                campaignsData: task.campaigns,
                belongsToUser,
                isPreview: task.status === 'preview'
              });
              return belongsToUser;
            }
          }) || [];
          
          console.log('useCurrentCampaignSection: Final filtered tasks:', securityCheckedTasks.length, 'out of', data?.length || 0, '(isDevelopment:', isDevelopment, ', tenant:', !!tenant?.id, ')');
          
          if (securityCheckedTasks.length > 0) {
            console.log('useCurrentCampaignSection: Sample task data:', {
              id: securityCheckedTasks[0].id,
              post_type: securityCheckedTasks[0].post_type,
              status: securityCheckedTasks[0].status,
              hasAiOutput: !!securityCheckedTasks[0].ai_output,
              aiOutputPreview: securityCheckedTasks[0].ai_output?.substring(0, 50) || 'No content',
              isPreview: securityCheckedTasks[0].status === 'preview'
            });
          }
          
          console.log('useCurrentCampaignSection: Setting tasks state with:', securityCheckedTasks);
          setTasks(securityCheckedTasks);
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
  }, [activeCampaign?.id, user?.id, tenant?.id, isDevelopment]); // 🔧 HYBRID: Dependencies work for both models

  const handleTaskClick = (task: any) => {
    // 🔧 HYBRID: Security check based on available model
    if (!user || !task.campaigns) {
      console.error('useCurrentCampaignSection: Invalid task or user data');
      return;
    }

    let hasAccess = false;
    if (tenant?.id) {
      // Tenant-based access control
      hasAccess = task.campaigns.tenant_id === tenant.id;
    } else {
      // User-based access control
      hasAccess = task.campaigns.user_id === user.id || task.user_id === user.id;
    }

    if (!hasAccess) {
      console.error('useCurrentCampaignSection: Attempted to access task without proper permissions');
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
    isDevelopment,
    usesTenantModel: !!tenant?.id
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
