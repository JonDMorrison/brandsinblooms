
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduledPost {
  id: string;
  content_id: string;
  platform: string;
  publish_at: string;
  status: string;
  content?: {
    caption: string;
    media_url?: string;
  };
}

interface UseScheduledPostsReturn {
  scheduledPosts: ScheduledPost[];
  loading: boolean;
  schedulePost: (contentId: string, publishAt: Date, platform: string) => Promise<void>;
  reschedulePost: (scheduledId: string, newPublishAt: Date) => Promise<void>;
  unschedulePost: (scheduledId: string) => Promise<void>;
  deleteScheduledPost: (scheduledId: string) => Promise<void>;
  refreshScheduledPosts: () => Promise<void>;
}

export const useScheduledPosts = (): UseScheduledPostsReturn => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScheduledPosts = async () => {
    if (!user) return;

    try {
      const query = supabase
        .from('scheduled_posts')
        .select(`
          *,
          generated_content (
            caption,
            media_url
          )
        `)
        .neq('status', 'ARCHIVED')
        .order('publish_at', { ascending: true });

      if (tenant?.id) {
        // For tenant-based filtering, we'd need to join through user relationships
        // This is simplified for now
      } else {
        query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setScheduledPosts(data || []);
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      toast.error('Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  const schedulePost = async (contentId: string, publishAt: Date, platform: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .insert({
          content_id: contentId,
          user_id: user.id,
          platform: platform as any, // Cast to match enum
          publish_at: publishAt.toISOString(),
          status: 'QUEUED'
        });

      if (error) throw error;

      toast.success('Post scheduled successfully');
      await fetchScheduledPosts();
    } catch (error) {
      console.error('Error scheduling post:', error);
      toast.error('Failed to schedule post');
    }
  };

  const reschedulePost = async (scheduledId: string, newPublishAt: Date) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ 
          publish_at: newPublishAt.toISOString(),
          status: 'QUEUED'
        })
        .eq('id', scheduledId);

      if (error) throw error;

      toast.success('Post rescheduled successfully');
      await fetchScheduledPosts();
    } catch (error) {
      console.error('Error rescheduling post:', error);
      toast.error('Failed to reschedule post');
    }
  };

  const unschedulePost = async (scheduledId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', scheduledId);

      if (error) throw error;

      toast.success('Post unscheduled');
      await fetchScheduledPosts();
    } catch (error) {
      console.error('Error unscheduling post:', error);
      toast.error('Failed to unschedule post');
    }
  };

  const deleteScheduledPost = async (scheduledId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'ARCHIVED' })
        .eq('id', scheduledId);

      if (error) throw error;

      toast.success('Scheduled post deleted');
      await fetchScheduledPosts();
    } catch (error) {
      console.error('Error deleting scheduled post:', error);
      toast.error('Failed to delete scheduled post');
    }
  };

  const refreshScheduledPosts = async () => {
    await fetchScheduledPosts();
  };

  useEffect(() => {
    fetchScheduledPosts();
  }, [user, tenant]);

  return {
    scheduledPosts,
    loading,
    schedulePost,
    reschedulePost,
    unschedulePost,
    deleteScheduledPost,
    refreshScheduledPosts
  };
};
