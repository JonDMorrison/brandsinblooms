
import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TaskActions } from './task-item/TaskActions';
import { cleanContentForDisplay } from '@/utils/contentUtils';

interface InlineEditableContentProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const InlineEditableContent = ({ task, onTaskUpdate }: InlineEditableContentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task?.ai_output) {
      setEditedContent(task.ai_output);
    }
  }, [task]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editedContent.trim()) {
      toast.error('Content cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: editedContent })
        .eq('id', task.id);

      if (error) {
        toast.error('Failed to save content');
      } else {
        toast.success('Content saved successfully!');
        setIsEditing(false);
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      toast.error('Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(task?.ai_output || '');
    setIsEditing(false);
  };

  if (!task) return null;

  return (
    <div className="space-y-4">
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[200px] resize-none"
            placeholder={`Edit your ${task.post_type} content...`}
            disabled={isSaving}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {task.ai_output ? 
                cleanContentForDisplay(task.ai_output, task.post_type).replace(/<[^>]*>/g, '') :
                'No content available'
              }
            </div>
          </div>
        </div>
      )}

      <TaskActions
        task={task}
        onTaskUpdate={onTaskUpdate}
        onEdit={handleEdit}
        isEditing={isEditing}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};
