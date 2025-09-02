
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Copy, Edit, ExternalLink, Trash2, Save, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Removed sonner import - using global toast replacement
import { supabase } from "@/integrations/supabase/client";
import { handleCopy } from "@/components/content/ContentViewerUtils";
import { ApproveButton } from "@/components/ui/approve-button";
import { PostToSocialButton } from "@/components/social/PostToSocialButton";

interface TaskItemActionsProps {
  task: any;
  hasContent: boolean;
  cleanContent: string;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  isEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TaskItemActions = ({ 
  task, 
  hasContent, 
  cleanContent, 
  onClick, 
  onTaskUpdate,
  isEditing = false,
  onSave,
  onCancel
}: TaskItemActionsProps) => {
  const [approvingTask, setApprovingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  const canApprove = ['scheduled', 'pending', 'draft', 'ready', 'review'].includes(task.status) && task.ai_output;
  const isApproved = ['approved', 'posted'].includes(task.status);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(task);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApprovingTask(true);
    
    console.log('🎯 TASK_ACTIONS: Starting approval for task', {
      taskId: task.id,
      currentStatus: task.status,
      postType: task.post_type
    });
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', task.id);

      if (error) {
        console.error('❌ TASK_ACTIONS: Database error during approval:', error);
        toast.error(`Failed to approve content: ${error.message}`);
      } else {
        console.log('✅ TASK_ACTIONS: Successfully updated task status to approved');
        if (onTaskUpdate) {
          console.log('🔄 TASK_ACTIONS: Calling onTaskUpdate to refresh data');
          onTaskUpdate();
        }
      }
    } catch (error) {
      console.error('❌ TASK_ACTIONS: Exception during approval:', error);
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
      <div className="flex items-center gap-2">
        {hasContent && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyContent}
            className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
        )}

        {isEditing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSave?.();
              }}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.();
              }}
              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEdit}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}

        {!isEditing && canApprove && (
          <ApproveButton
            taskId={task.id}
            isApproved={isApproved}
            onApprove={handleApprove}
            disabled={approvingTask}
            className="text-sm"
          />
        )}

        {!isEditing && isApproved && (task.post_type === 'facebook' || task.post_type === 'instagram') && (
          <div className="flex items-center">
            <PostToSocialButton
              task={task}
              onSuccess={onTaskUpdate}
              variant="ghost"
              size="sm"
              className="text-xs"
            />
          </div>
        )}

        {!isEditing && isApproved && task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              toast.info('Publishing integration coming soon');
            }}
            className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Publish
          </Button>
        )}

        {!isEditing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={deletingTask}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete this content</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
