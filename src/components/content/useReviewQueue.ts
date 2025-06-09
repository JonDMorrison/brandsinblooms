
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CACHE_KEY = 'review_queue_cache';

const getCachedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Use cache if less than 30 minutes old
      if (Date.now() - timestamp < 1800000) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error reading review queue cache:', error);
  }
  return null;
};

const setCachedData = (data: any) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error setting review queue cache:', error);
  }
};

const isNetworkError = (error: any) => {
  return !navigator.onLine || 
         error?.message?.includes('Failed to fetch') ||
         error?.message?.includes('Network Error') ||
         error?.message?.includes('ERR_INTERNET_DISCONNECTED');
};

export const useReviewQueue = (onTaskUpdate?: () => void) => {
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const fetchPendingTasks = useCallback(async () => {
    try {
      setError(null);
      console.log('ReviewQueue: Fetching pending tasks');
      
      // Check if we're offline
      if (!navigator.onLine) {
        const cachedData = getCachedData();
        if (cachedData) {
          setPendingTasks(cachedData);
          toast.info('Loaded cached review queue - you are offline');
        } else {
          setError('No internet connection and no cached data available');
        }
        setLoading(false);
        return;
      }
      
      const { data, error: fetchError } = await supabase
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

      if (fetchError) {
        console.error('ReviewQueue: Error fetching pending tasks:', fetchError);
        
        // Check if it's a network error
        if (isNetworkError(fetchError)) {
          const cachedData = getCachedData();
          if (cachedData) {
            setPendingTasks(cachedData);
            toast.warning('Using cached review queue due to connection issues');
          } else {
            setError('Network error and no cached data available');
          }
        } else {
          throw new Error(`Failed to load pending tasks: ${fetchError.message}`);
        }
      } else {
        const tasks = data || [];
        console.log('ReviewQueue: Loaded pending tasks:', tasks.length);
        setPendingTasks(tasks);
        setCachedData(tasks);
      }
    } catch (error: any) {
      console.error('ReviewQueue: Error in fetchPendingTasks:', error);
      
      // Try to load cached data as fallback
      const cachedData = getCachedData();
      if (cachedData) {
        setPendingTasks(cachedData);
        toast.warning('Using cached review queue due to connection issues');
      } else {
        setError(error.message || 'Failed to load pending tasks');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApprove = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!navigator.onLine) {
      toast.error('Cannot approve content while offline');
      return;
    }
    
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

      // Remove from pending tasks immediately for better UX
      setPendingTasks(prev => prev.filter(task => task.id !== taskId));
      
      toast.success('Content approved and moved to Ready to Post!', {
        description: 'You can now publish this content from the Ready to Post section.',
        duration: 4000,
      });
      
      if (onTaskUpdate) onTaskUpdate();
    } catch (error: any) {
      console.error('ReviewQueue: Error in handleApprove:', error);
      toast.error(error.message || 'Failed to approve content');
      // Refresh to restore state on error
      await fetchPendingTasks();
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

  // Set up real-time subscription for new draft content
  useEffect(() => {
    const channel = supabase
      .channel('review-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_tasks',
          filter: 'status=eq.draft'
        },
        (payload) => {
          console.log('Real-time update for review queue:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new.status === 'draft' && payload.new.ai_output) {
              setPendingTasks(prev => {
                const filtered = prev.filter(task => task.id !== payload.new.id);
                return [payload.new, ...filtered];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setPendingTasks(prev => prev.filter(task => task.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    fetchPendingTasks();

    return () => {
      supabase.removeChannel(channel);
    };
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
