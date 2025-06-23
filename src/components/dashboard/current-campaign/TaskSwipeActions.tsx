
import React from 'react';
import { Edit, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Conditional imports for swipeable list
let TrailingActions: any = null;
let SwipeAction: any = null;

try {
  const swipeableModule = require('react-swipeable-list');
  TrailingActions = swipeableModule.TrailingActions;
  SwipeAction = swipeableModule.SwipeAction;
} catch (e) {
  // Fallback components if react-swipeable-list is not available
  TrailingActions = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  SwipeAction = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  );
}

interface TaskSwipeActionsProps {
  task: any;
  onEdit: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskSwipeActions = ({ task, onEdit, onTaskUpdate }: TaskSwipeActionsProps) => {
  const handleCopy = async () => {
    if (task.ai_output) {
      const textToCopy = task.ai_output.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Content copied to clipboard');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('content_tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete content');
      } else {
        toast.success('Content deleted successfully');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete content');
    }
  };

  return (
    <TrailingActions>
      <SwipeAction onClick={() => onEdit(task)}>
        <div className="flex items-center justify-center h-full bg-blue-500 text-white px-4">
          <Edit className="w-5 h-5" />
        </div>
      </SwipeAction>
      <SwipeAction onClick={handleCopy}>
        <div className="flex items-center justify-center h-full bg-green-500 text-white px-4">
          <Copy className="w-5 h-5" />
        </div>
      </SwipeAction>
      <SwipeAction onClick={handleDelete}>
        <div className="flex items-center justify-center h-full bg-red-500 text-white px-4">
          <Trash2 className="w-5 h-5" />
        </div>
      </SwipeAction>
    </TrailingActions>
  );
};
