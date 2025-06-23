
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Edit, ExternalLink, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleCopy } from "@/components/content/ContentViewerUtils";
import { ApproveButton } from "@/components/ui/approve-button";

interface TaskItemActionsProps {
  task: any;
  hasContent: boolean;
  cleanContent: string;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskItemActions = ({ 
  task, 
  hasContent, 
  cleanContent, 
  onClick, 
  onTaskUpdate 
}: TaskItemActionsProps) => {
  const [approvingTask, setApprovingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  const canApprove = ['scheduled', 'pending', 'draft', 'ready', 'review', 'posted'].includes(task.status) && task.ai_output;
  const isApproved = task.status === 'posted';

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(task);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApprovingTask(true);
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .eq('id', task.id);

      if (error) {
        console.error('Error approving task:', error);
        toast.error('Failed to approve content');
      } else {
        toast.success('Content approved and moved to Ready to Post!');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApprovingTask(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  const handleCopyContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasContent) {
      // Copy the clean text without HTML tags for clipboard
      const textToCopy = cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      handleCopy(textToCopy);
      toast.success('Content copied to clipboard');
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
        {hasContent && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyContent}
            className="flex-1 min-w-[80px]"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleEdit}
          className="flex-1 min-w-[80px] border-blue-300 text-blue-600 hover:bg-blue-50"
        >
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>

        {canApprove && (
          <ApproveButton
            isApproved={isApproved}
            onApprove={handleApprove}
            disabled={approvingTask}
            className="flex-1 min-w-[80px]"
          />
        )}

        {task.status === 'posted' && task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              toast.info('Publishing integration coming soon');
            }}
            className="flex-1 min-w-[80px]"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Publish
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={deletingTask}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 min-w-[40px]"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete this content</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
