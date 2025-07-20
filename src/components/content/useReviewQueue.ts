
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
// Removed sonner import - using global toast replacement
import { ContentTask } from "@/types/content";

export const useReviewQueue = (onTaskUpdate?: () => void) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [pendingTasks, setPendingTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState(new Set<string>());
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchPendingTasks = async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Build status filter for content that needs review - NOT approved content
      const statusFilter = ['review', 'generated', 'pending', 'draft'];
      if (isDeveloper) {
        statusFilter.push('preview');
      }
      
      console.log('🔍 REVIEW_QUEUE: Fetching tasks with statuses:', statusFilter);
      
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
        .in('status', statusFilter) // Only fetch non-approved content
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
        
        console.log('📊 REVIEW_QUEUE: Found', userTasks.length, 'tasks for review:', 
          userTasks.map(t => ({ id: t.id, status: t.status, type: t.post_type }))
        );
        
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
    
    // Add explicit confirmation for approval
    const confirmed = window.confirm(
      'Are you sure you want to approve this content? It will be moved to the "Ready to Post" section.'
    );
    
    if (!confirmed) return;
    
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      console.log('🎯 REVIEW_QUEUE: Approving task:', taskId);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' }) // Explicit approval
        .eq('id', taskId);

      if (error) throw error;

      console.log('✅ REVIEW_QUEUE: Task approved successfully');
      await fetchPendingTasks(); // Refresh the list
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

  // Set up real-time subscription with proper cleanup
  useEffect(() => {
    if (!user || !tenant || isSubscribedRef.current) return;

    const setupSubscription = async () => {
      try {
        // Clean up existing channel if it exists
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        // Create new channel with error handling
        const channel = supabase
          .channel(`content_tasks_changes_${tenant.id}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'content_tasks',
              filter: `tenant_id=eq.${tenant.id}`
            }, 
            (payload) => {
              console.log('Content tasks changed, refetching...', payload);
              fetchPendingTasks();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              isSubscribedRef.current = true;
              console.log('Successfully subscribed to content_tasks changes');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('Channel subscription error');
              isSubscribedRef.current = false;
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        // Don't fail the entire component if realtime fails
      }
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
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
