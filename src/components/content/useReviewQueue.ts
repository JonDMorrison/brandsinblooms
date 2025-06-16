
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ContentTask } from "@/types/content";

export const useReviewQueue = (onTaskUpdate?: () => void) => {
  const { user } = useAuth();
  const [pendingTasks, setPendingTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState(new Set<string>());
  const channelRef = useRef<any>(null);

  const fetchPendingTasks = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id
          )
        `)
        .in('status', ['pending', 'generated'])
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching pending tasks:', fetchError);
        setError('Failed to load pending content');
      } else {
        // Filter to only show tasks for current user's campaigns and cast to ContentTask type
        const userTasks = (data?.filter(task => 
          task.campaigns?.user_id === user.id
        ) || []) as ContentTask[];
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
        .update({ status: 'posted' })
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
  }, [user]);

  // Set up real-time subscription only once
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  return {
    pendingTasks,
    loading,
    error,
    approvingTasks,
    handleApprove,
    handleRetry
  };
};
