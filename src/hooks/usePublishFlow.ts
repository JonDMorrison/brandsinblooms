
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

      // Create generated content record
      const { data: generatedContent, error: contentError } = await supabase
        .from('generated_content')
        .insert({
          user_id: user.id,
          caption: task.ai_output || '',
          status: 'DRAFT'
        })
        .select()
        .single();

      if (contentError) throw contentError;

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
