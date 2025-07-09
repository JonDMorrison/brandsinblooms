
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PublishFlowHook {
  approveDraft: (taskId: string) => Promise<string | null>;
  scheduleDraft: (contentId: string, publishAt: Date, platform: string) => Promise<void>;
  unscheduleContent: (scheduledId: string) => Promise<void>;
  loading: boolean;
}

export const usePublishFlow = (): PublishFlowHook => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const approveDraft = async (taskId: string): Promise<string | null> => {
    if (!user) return null;
    
    setLoading(true);
    try {
      // Get the draft content
      const { data: task, error: taskError } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      // Extract image data from task attachments or image_url field
      let mediaUrl: string | undefined;
      const attachments = task.attachments as any;
      
      console.log('🎯 APPROVE_DRAFT: Task data:', {
        taskId,
        hasAttachments: !!attachments,
        hasImage: !!attachments?.image,
        imageUrl: attachments?.image?.url || task.image_url,
        status: task.status
      });

      if (attachments?.image?.url) {
        mediaUrl = attachments.image.url;
        console.log('📸 APPROVE_DRAFT: Using image from attachments:', mediaUrl);
      } else if (task.image_url) {
        mediaUrl = task.image_url;
        console.log('📸 APPROVE_DRAFT: Using image from image_url field:', mediaUrl);
      }

      // Create generated content record with image
      const { data: generatedContent, error: contentError } = await supabase
        .from('generated_content')
        .insert({
          user_id: user.id,
          caption: task.ai_output || '',
          media_url: mediaUrl,
          status: 'DRAFT'
        })
        .select()
        .single();

      if (contentError) throw contentError;

      console.log('✅ APPROVE_DRAFT: Created generated content:', {
        contentId: generatedContent.id,
        hasMediaUrl: !!generatedContent.media_url,
        mediaUrl: generatedContent.media_url
      });

      // Update content task status
      const { error: updateError } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast.success('Content approved and ready for publishing');
      return generatedContent.id;
    } catch (error) {
      console.error('Error approving draft:', error);
      toast.error('Failed to approve content');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const scheduleDraft = async (contentId: string, publishAt: Date, platform: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Get the generated content to verify image data
      const { data: content, error: contentFetchError } = await supabase
        .from('generated_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (contentFetchError) throw contentFetchError;

      console.log('📅 SCHEDULE_DRAFT: Generated content data:', {
        contentId,
        hasMediaUrl: !!content.media_url,
        mediaUrl: content.media_url,
        caption: content.caption?.substring(0, 50) + '...'
      });

      const { error } = await supabase
        .from('scheduled_posts')
        .insert({
          content_id: contentId,
          user_id: user.id,
          platform: platform as any,
          publish_at: publishAt.toISOString(),
          status: 'QUEUED'
        });

      if (error) throw error;

      // Update content status
      await supabase
        .from('generated_content')
        .update({ status: 'SCHEDULED' })
        .eq('id', contentId);

      console.log('✅ SCHEDULE_DRAFT: Successfully scheduled post with image preserved');

      toast.success('Content scheduled for publishing', {
        action: {
          label: 'Undo',
          onClick: () => unscheduleContent(contentId)
        }
      });
    } catch (error) {
      console.error('Error scheduling content:', error);
      toast.error('Failed to schedule content');
    } finally {
      setLoading(false);
    }
  };

  const unscheduleContent = async (contentId: string) => {
    try {
      // Remove from scheduled posts
      const { error: deleteError } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('content_id', contentId);

      if (deleteError) throw deleteError;

      // Update content status back to draft
      await supabase
        .from('generated_content')
        .update({ status: 'DRAFT' })
        .eq('id', contentId);

      toast.success('Content unscheduled');
    } catch (error) {
      console.error('Error unscheduling content:', error);
      toast.error('Failed to unschedule content');
    }
  };

  return {
    approveDraft,
    scheduleDraft,
    unscheduleContent,
    loading
  };
};
