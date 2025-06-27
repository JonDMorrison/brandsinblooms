
import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TaskActions } from './task-item/TaskActions';
import { SocialMediaPostPreview } from './task-item/SocialMediaPostPreview';
import { MagazineContentDisplay } from './task-item/MagazineContentDisplay';
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

  // Helper function to render appropriate display component based on post type
  const renderDisplayComponent = () => {
    if (!task.ai_output) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-gray-400 italic text-sm">
            No content available
          </div>
        </div>
      );
    }

    // Social media posts get special preview treatment
    if (task.post_type === 'instagram' || task.post_type === 'facebook') {
      return (
        <SocialMediaPostPreview
          content={task.ai_output}
          postType={task.post_type as 'instagram' | 'facebook'}
          contentTaskId={task.id}
          campaignTitle={task.campaigns?.theme || task.campaigns?.title}
        />
      );
    }

    // All other content types use magazine display
    return (
      <MagazineContentDisplay
        content={task.ai_output}
        postType={task.post_type}
        contentTaskId={task.id}
        campaignTitle={task.campaigns?.theme || task.campaigns?.title}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with prominent TaskActions on the right */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {task.post_type} Content
          </h3>
          <p className="text-sm text-gray-600">
            {isEditing ? 'Edit your content below' : 'Review and manage your content'}
          </p>
        </div>
        
        {/* Prominent TaskActions positioned at top right */}
        <div className="flex-shrink-0">
          <TaskActions
            task={task}
            onTaskUpdate={onTaskUpdate}
            onEdit={handleEdit}
            isEditing={isEditing}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Content Area */}
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
          renderDisplayComponent()
        )}
      </div>
    </div>
  );
};
