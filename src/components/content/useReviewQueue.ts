
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useReviewQueue = (onTaskUpdate?: () => void) => {
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const fetchPendingTasks = useCallback(async () => {
    try {
      setError(null);
      console.log('ReviewQueue: Fetching pending tasks');
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title
          )
        `)
        .eq('status', 'draft')
        .not('ai_output', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ReviewQueue: Error fetching pending tasks:', error);
        throw new Error(`Failed to load pending tasks: ${error.message}`);
      }

      console.log('ReviewQueue: Loaded pending tasks:', data?.length || 0);
      setPendingTasks(data || []);
    } catch (error: any) {
      console.error('ReviewQueue: Error in fetchPendingTasks:', error);
      setError(error.message || 'Failed to load pending tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApprove = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      console.log('ReviewQueue: Approving task:', taskId);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', taskId);

      if (error) {
        console.error('ReviewQueue: Error approving task:', error);
        throw new Error(`Failed to approve content: ${error.message}`);
      }

      toast.success('Content approved successfully!');
      await fetchPendingTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error: any) {
      console.error('ReviewQueue: Error in handleApprove:', error);
      toast.error(error.message || 'Failed to approve content');
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
  }, [fetchPendingTasks]);

  return {
    pendingTasks,
    loading,
    error,
    approvingTasks,
    handleApprove,
    handleRetry,
    fetchPendingTasks
  };
};
