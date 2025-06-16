
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
    
    // Only prevent dropping in the past, allow moving FROM past TO future
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

    // Check if we're moving past content to future
    const pastTasks = draggedTasks.filter(task => {
      const taskDate = new Date(task.scheduled_date);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate < today;
    });

    try {
      // Show immediate feedback
      toast.promise(
        supabase
          .from('content_tasks')
          .update({ scheduled_date: newDateString })
          .in('id', draggedTasks.map(task => task.id)),
        {
          loading: `Rescheduling ${draggedTasks.length} item${draggedTasks.length !== 1 ? 's' : ''}...`,
          success: () => {
            if (draggedTasks.length === 1) {
              const successMessage = pastTasks.length > 0 
                ? `Past content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`
                : `Content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`;
              return successMessage;
            } else {
              const successMessage = pastTasks.length > 0
                ? `${draggedTasks.length} items (including past content) rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`
                : `${draggedTasks.length} items rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`;
              return successMessage;
            }
          },
          error: 'Failed to reschedule content'
        }
      );
      
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
