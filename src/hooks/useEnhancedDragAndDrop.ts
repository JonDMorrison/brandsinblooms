
import { useState, useCallback } from 'react';
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

  const handleDragStart = useCallback((tasks: Task[]) => {
    setIsDragging(true);
    setDraggedTasks(tasks);
    
    if (tasks.length === 1) {
      setDragPreview(`${tasks[0].post_type} content`);
    } else {
      setDragPreview(`${tasks.length} content items`);
    }

    // Add visual feedback to the document
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedTasks([]);
    setDragPreview('');
    
    // Clean up visual feedback
    document.body.style.cursor = '';
    document.body.classList.remove('dragging');
  }, []);

  const handleDrop = useCallback(async (targetDate: Date) => {
    if (draggedTasks.length === 0) return;

    const newDateString = format(targetDate, 'yyyy-MM-dd');
    
    // Check if any tasks are already on this date
    const tasksAlreadyOnDate = draggedTasks.filter(task => task.scheduled_date === newDateString);
    if (tasksAlreadyOnDate.length === draggedTasks.length) {
      toast.info('Content is already scheduled for this date');
      handleDragEnd();
      return;
    }

    try {
      // Execute the update operation as a Promise
      const updateOperation = async () => {
        const { error } = await supabase
          .from('content_tasks')
          .update({ scheduled_date: newDateString })
          .in('id', draggedTasks.map(task => task.id));
        
        if (error) throw error;
        return { success: true };
      };

      // Show immediate feedback with proper promise handling
      await toast.promise(updateOperation(), {
        loading: `Rescheduling ${draggedTasks.length} item${draggedTasks.length !== 1 ? 's' : ''}...`,
        success: () => {
          if (draggedTasks.length === 1) {
            return `Content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`;
          } else {
            return `${draggedTasks.length} items rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`;
          }
        },
        error: 'Failed to reschedule content'
      });
      
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task dates:', error);
    } finally {
      handleDragEnd();
    }
  }, [draggedTasks, handleDragEnd, onTaskUpdate]);

  return {
    isDragging,
    draggedTasks,
    dragPreview,
    handleDragStart,
    handleDragEnd,
    handleDrop
  };
};
