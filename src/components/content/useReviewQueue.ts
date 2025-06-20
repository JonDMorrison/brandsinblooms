import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { ContentTask } from "@/types/content";

export const useReviewQueue = (onTaskUpdate?: () => void) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [pendingTasks, setPendingTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState(new Set<string>());
  const channelRef = useRef<any>(null);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchPendingTasks = async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Build status filter - include 'preview' for developer
      const statusFilter = ['pending', 'generated', 'review'];
      if (isDeveloper) {
        statusFilter.push('preview');
      }
      
      const { data, error: fetchError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            id,
            title,
            week_number,
            start_date,
            tenant_id
          )
        `)
        .eq('tenant_id', tenant.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching pending tasks:', fetchError);
        setError('Failed to load pending content');
      } else {
        // Filter and map to ContentTask type with proper campaign data
        const userTasks = (data?.filter(task => 
          task.campaigns?.tenant_id === tenant.id
        ).map(task => ({
          ...task,
          campaigns: task.campaigns ? {
            id: task.campaigns.id,
            title: task.campaigns.title,
            week_number: task.campaigns.week_number,
            start_date: task.campaigns.start_date,
            tenant_id: task.campaigns.tenant_id
          } : undefined
        })) || []) as ContentTask[];
        
        console.log('Review Queue: Found', userTasks.length, 'tasks including', 
          userTasks.filter(t => t.status === 'preview').length, 'preview tasks (dev only)');
        
        setPendingTasks(userTasks);
      }
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      setError('Failed to load pending content');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Content approved and ready to post!');
      await fetchPendingTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApprovingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleRetry = () => {
    setLoading(true);
    fetchPendingTasks();
  };

  useEffect(() => {
    fetchPendingTasks();
  }, [user, tenant, isDeveloper]);

  // Set up real-time subscription only once
  useEffect(() => {
    if (!user || !tenant) return;

    // Clean up existing channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel
    const channel = supabase
      .channel('content_tasks_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'content_tasks' 
        }, 
        () => {
          console.log('Content tasks changed, refetching...');
          fetchPendingTasks();
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, tenant]);

  return {
    pendingTasks,
    loading,
    error,
    approvingTasks,
    handleApprove,
    handleRetry
  };
};
