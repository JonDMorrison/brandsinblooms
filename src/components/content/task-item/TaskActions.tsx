
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit, MoreHorizontal, Copy, Trash2, Save, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApproveButton } from "@/components/ui/approve-button";
import { PostToSocialButton } from "@/components/social/PostToSocialButton";
import { PostToCRMButton } from "@/components/crm/PostToCRMButton";
// Removed sonner import - using global toast replacement
import { supabase } from "@/integrations/supabase/client";

interface TaskActionsProps {
  task: any;
  onTaskUpdate?: () => void;
  onEdit: () => void;
  isEditing?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TaskActions = ({ 
  task, 
  onTaskUpdate, 
  onEdit, 
  isEditing = false, 
  onSave, 
  onCancel 
}: TaskActionsProps) => {
  const [deletingTask, setDeletingTask] = useState(false);

  const canApprove = ['scheduled', 'pending', 'draft', 'ready', 'review'].includes(task.status) && task.ai_output;
  const isApproved = ['approved', 'scheduled', 'published'].includes(task.status);

  const handleApprove = async () => {
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', task.id);

      if (error) {
        toast.error(`Failed to approve content: ${error.message}`);
      } else {
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      toast.error('Failed to approve content');
    }
  };

  const handleCopy = () => {
    if (task.ai_output) {
      const textToCopy = task.ai_output.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      navigator.clipboard.writeText(textToCopy);
      toast.success('Content copied to clipboard');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    setDeletingTask(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        toast.error('Failed to delete content');
      } else {
        toast.success('Content deleted successfully');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      toast.error('Failed to delete content');
    } finally {
      setDeletingTask(false);
    }
  };

  const handleSave = () => {
    console.log('[TASK_ACTIONS] Save button clicked - always executing save and close');
    if (onSave) {
      onSave();
    }
  };

  return (
    <div className="flex items-center gap-1">
      {isEditing ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              console.log('[TASK_ACTIONS] Cancel button clicked');
              onCancel?.();
            }}
            className="h-8 px-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
          size="sm"
          className="h-8 px-2 text-xs"
        />
      )}

      {!isEditing && isApproved && (task.post_type === 'facebook' || task.post_type === 'instagram') && (
        <PostToSocialButton
          task={task}
          onSuccess={onTaskUpdate}
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
        />
      )}

      {!isEditing && isApproved && task.post_type === 'newsletter' && (
        <PostToCRMButton
          task={task}
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
        />
      )}

      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="w-3 h-3 mr-2" />
              Copy Content
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete} 
              disabled={deletingTask}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
