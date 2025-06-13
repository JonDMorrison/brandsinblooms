
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

export const useEnhancedDragAndDrop = (onTaskUpdate: () => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTasks, setDraggedTasks] = useState<Task[]>([]);
  const [dragPreview, setDragPreview] = useState<string>('');

  const handleDragStart = (tasks: Task[]) => {
    setIsDragging(true);
    setDraggedTasks(tasks);
    
    if (tasks.length === 1) {
      setDragPreview(`${tasks[0].post_type} content`);
    } else {
      setDragPreview(`${tasks.length} content items`);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedTasks([]);
    setDragPreview('');
  };

  const handleDrop = async (targetDate: Date) => {
    if (draggedTasks.length === 0) return;

    const newDateString = format(targetDate, 'yyyy-MM-dd');
    
    // Prevent scheduling in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      toast.error('Cannot schedule content in the past');
      handleDragEnd();
      return;
    }

    // Check if any tasks are already on this date
    const tasksAlreadyOnDate = draggedTasks.filter(task => task.scheduled_date === newDateString);
    if (tasksAlreadyOnDate.length === draggedTasks.length) {
      toast.info('Content is already scheduled for this date');
      handleDragEnd();
      return;
    }

    try {
      // Update all tasks in a batch
      const { error } = await supabase
        .from('content_tasks')
        .update({ scheduled_date: newDateString })
        .in('id', draggedTasks.map(task => task.id));

      if (error) throw error;

      if (draggedTasks.length === 1) {
        toast.success(`Content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`);
      } else {
        toast.success(`${draggedTasks.length} items rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`);
      }
      
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task dates:', error);
      toast.error('Failed to reschedule content');
    } finally {
      handleDragEnd();
    }
  };

  return {
    isDragging,
    draggedTasks,
    dragPreview,
    handleDragStart,
    handleDragEnd,
    handleDrop
  };
};
