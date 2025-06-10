
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { getPostTypeIcon } from "@/components/homepage/ready-to-post/postTypeUtils";

interface ReviewQueueItemProps {
  task: any;
  onApprove: (taskId: string, event: React.MouseEvent) => void;
  onClick: (task: any) => void;
  isApproving: boolean;
  onTaskUpdate?: () => void;
}

export const ReviewQueueItem = ({ task, onApprove, onClick, isApproving, onTaskUpdate }: ReviewQueueItemProps) => {
  const [deletingTask, setDeletingTask] = useState(false);

  const stripHtmlAndFormat = (content: string) => {
    if (!content) return '';
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    setDeletingTask(true);
    
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
    } finally {
      setDeletingTask(false);
    }
  };

  return (
    <div
      key={task.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group"
      onClick={() => onClick(task)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getPostTypeIcon(task.post_type)}
          <Badge className="bg-orange-100 text-orange-800">
            {task.post_type}
          </Badge>
          {task.campaigns?.title && (
            <span className="text-sm text-gray-600">
              {task.campaigns.title}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={(e) => onApprove(task.id, e)}
            disabled={isApproving}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deletingTask}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete this content</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <p className="text-sm text-gray-700 line-clamp-2">
        {stripHtmlAndFormat(task.ai_output)}
      </p>
    </div>
  );
};
