
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';
import { format } from 'date-fns';
import { UnifiedCalendarEvent } from './useUnifiedCalendarData';

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
  const [draggedItem, setDraggedItem] = useState<UnifiedCalendarEvent | Task | null>(null);

  const handleDragStart = (item: UnifiedCalendarEvent | Task) => {
    setIsDragging(true);
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItem(null);
  };

  const handleDrop = async (targetDate: Date) => {
    if (!draggedItem) return;

    const newDateString = format(targetDate, 'yyyy-MM-dd');
    
    try {
      // Handle unified calendar events
      if ('type' in draggedItem) {
        const event = draggedItem as UnifiedCalendarEvent;
        
        // Don't update if dropping on the same date
        const currentDateString = format(event.date, 'yyyy-MM-dd');
        if (currentDateString === newDateString) {
          handleDragEnd();
          return;
        }

        switch (event.type) {
          case 'task':
            await supabase
              .from('content_tasks')
              .update({ scheduled_date: newDateString })
              .eq('id', event.id);
            break;

          case 'scheduled_post':
            // Update publish_at while preserving time
            const currentDate = new Date(event.meta.publish_at);
            const targetDateTime = new Date(targetDate);
            targetDateTime.setHours(currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds());
            
            await supabase
              .from('scheduled_posts')
              .update({ publish_at: targetDateTime.toISOString() })
              .eq('id', event.id);
            break;

          case 'newsletter':
            // Update scheduled_at for newsletters
            await supabase
              .from('crm_campaigns')
              .update({ scheduled_at: newDateString })
              .eq('id', event.id);
            break;

          case 'event':
            // Update campaign start_date
            await supabase
              .from('campaigns')
              .update({ start_date: newDateString })
              .eq('id', event.id);
            break;

          case 'holiday':
            // Holidays can't be rescheduled
            toast.info('Holidays cannot be rescheduled');
            handleDragEnd();
            return;
        }

        toast.success(`${event.type} rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`);
      } else {
        // Handle legacy task format
        const task = draggedItem as Task;
        
        if (task.scheduled_date === newDateString) {
          handleDragEnd();
          return;
        }

        await supabase
          .from('content_tasks')
          .update({ scheduled_date: newDateString })
          .eq('id', task.id);

        toast.success(`Content rescheduled to ${format(targetDate, 'MMMM d, yyyy')}`);
      }

      onTaskUpdate();
    } catch (error) {
      console.error('Error updating item date:', error);
      toast.error('Failed to reschedule item');
    } finally {
      handleDragEnd();
    }
  };

  return {
    isDragging,
    draggedTask: draggedItem, // Keep legacy name for compatibility
    draggedItem,
    handleDragStart,
    handleDragEnd,
    handleDrop
  };
};
