
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTasks = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            week_number,
            start_date,
            user_id
          )
        `)
        .eq('campaigns.user_id', userId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    const { error } = await supabase
      .from('content_tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    const { error } = await supabase
      .from('content_tasks')
      .update({ status: 'completed' })
      .eq('id', taskId);
    
    if (error) throw error;
  }, []);

  return {
    tasks,
    loading,
    fetchTasks,
    deleteTask,
    completeTask
  };
};
