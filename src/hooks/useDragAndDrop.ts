
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement
import { format } from 'date-fns';

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

export const useDragAndDrop = (onTaskUpdate: () => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (task: Task) => {
    setIsDragging(true);
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedTask(null);
  };

  const handleDrop = async (targetDate: Date) => {
    if (!draggedTask) return;

    const newDateString = format(targetDate, 'yyyy-MM-dd');
    
    // Don't update if dropping on the same date
    if (draggedTask.scheduled_date === newDateString) {
      handleDragEnd();
      return;
    }

    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ scheduled_date: newDateString })
        .eq('id', draggedTask.id);

      if (error) throw error;

      toast.success(`Content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`);
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task date:', error);
      toast.error('Failed to reschedule content');
    } finally {
      handleDragEnd();
    }
  };

  return {
    isDragging,
    draggedTask,
    handleDragStart,
    handleDragEnd,
    handleDrop
  };
};
