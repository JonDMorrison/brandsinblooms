
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

export const useCurrentCampaignSection = (activeCampaign: any, tasks: any[]) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;
  const usesTenantModel = !!tenant?.id;
  const tasksCount = tasks?.length || 0;

  useEffect(() => {
    // Set loading to false since we're receiving tasks as props
    setLoading(false);
  }, [tasks]);

  const handleTaskClick = (task: any) => {
    // Security check based on available model
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
    tasksCount,
    loading,
    selectedTask: selectedTask?.id,
    showContentViewer,
    isDevelopment,
    usesTenantModel
  });

  return {
    tasksCount,
    loading,
    selectedTask,
    showContentViewer,
    isDevelopment,
    usesTenantModel,
    handleTaskClick,
    handleContentViewerClose
  };
};
