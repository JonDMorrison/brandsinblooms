
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

      if (error && !error.isOffline) {
        console.error('ReviewQueue: Error fetching pending tasks:', error);
        throw new Error(`Failed to load pending tasks: ${error.message}`);
      }

      const tasks = data || getCachedData() || [];
      console.log('ReviewQueue: Loaded pending tasks:', tasks.length);
      setPendingTasks(tasks);
      if (data) setCachedData(tasks);
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
