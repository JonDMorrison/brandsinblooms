
import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from "@/utils/toastUtils";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Only update editedContent when not editing and no unsaved changes
  useEffect(() => {
    if (task?.ai_output && !isEditing && !hasUnsavedChanges) {
      console.log('[INLINE_EDIT] Setting content from task:', task.ai_output.substring(0, 50) + '...');
      setEditedContent(task.ai_output);
    }
  }, [task?.ai_output, isEditing, hasUnsavedChanges]);

  const handleEdit = () => {
    console.log('[INLINE_EDIT] Edit button clicked');
    setIsEditing(true);
  };

  const handleSave = async () => {
    console.log('[SAVE] Starting save operation', {
      taskId: task?.id,
      hasContent: !!editedContent,
      contentLength: editedContent?.length,
      isAuthenticated: !!(await supabase.auth.getUser()).data.user
    });

    // Enhanced validation
    if (!task?.id) {
      console.error('[SAVE] No task ID available');
      toast.error('Cannot save: Missing task information');
      return;
    }

    if (!editedContent.trim()) {
      console.error('[SAVE] Empty content');
      toast.error('Content cannot be empty');
      return;
    }

    // Handle content comparison more intelligently for different post types
    const originalContent = task.ai_output || '';
    let hasChanges = editedContent !== originalContent;
    
    // For newsletters, compare normalized content to avoid false negatives
    if (task.post_type === 'newsletter') {
      const normalizeNewsletter = (content: string) => {
        return content
          .replace(/\r\n/g, '\n')  // Normalize line endings
          .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
          .trim();
      };
      
      hasChanges = normalizeNewsletter(editedContent) !== normalizeNewsletter(originalContent);
    }

    if (!hasChanges) {
      console.log('[SAVE] No changes detected');
      toast.success('No changes to save');
      setHasUnsavedChanges(false);
      setIsEditing(false); // Exit edit mode when no changes
      return;
    }

    setIsSaving(true);
    try {
      // Verify user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('[SAVE] Authentication error:', authError);
        toast.error('Please log in to save changes');
        return;
      }

      console.log('[SAVE] Updating content_tasks', {
        taskId: task.id,
        userId: user.id,
        newContentLength: editedContent.length
      });

      const { data, error } = await supabase
        .from('content_tasks')
        .update({ ai_output: editedContent })
        .eq('id', task.id)
        .select();

      console.log('[SAVE] Database response:', { data, error });

      if (error) {
        console.error('[SAVE] Database error:', error);
        toast.error(`Failed to save: ${error.message}`);
      } else {
        console.log('[SAVE] Save successful');
        toast.success('Content saved successfully!');
        setIsEditing(false);
        setHasUnsavedChanges(false); // Clear unsaved changes flag
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('[SAVE] Unexpected error:', error);
      toast.error(`Failed to save content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(task?.ai_output || '');
    setIsEditing(false);
    setHasUnsavedChanges(false); // Clear unsaved changes flag
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

    // All other content types (including newsletters) use magazine display
    return (
      <MagazineContentDisplay
        content={task.ai_output}
        postType={task.post_type}
        contentTaskId={task.id}
        campaignTitle={task.campaigns?.theme || task.campaigns?.title}
        task={task}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with prominent TaskActions on the right */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
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
              onChange={(e) => {
                setEditedContent(e.target.value);
                setHasUnsavedChanges(e.target.value !== task?.ai_output);
              }}
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
