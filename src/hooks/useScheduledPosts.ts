import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/utils/toast";
import { applyTenantUserScope } from "@/utils/tenantScope";

interface ScheduledPost {
  id: string;
  content_id: string;
  platform: string;
  publish_at: string;
  status: string;
  error_message?: string;
  content?: {
    caption: string;
    media_url?: string;
  };
}

interface UseScheduledPostsReturn {
  scheduledPosts: ScheduledPost[];
  loading: boolean;
  schedulePost: (
    contentId: string,
    publishAt: Date,
    platform: string,
  ) => Promise<void>;
  reschedulePost: (scheduledId: string, newPublishAt: Date) => Promise<void>;
  unschedulePost: (scheduledId: string) => Promise<void>;
  deleteScheduledPost: (scheduledId: string) => Promise<void>;
  refreshScheduledPosts: () => Promise<void>;
}

export const useScheduledPosts = (): UseScheduledPostsReturn => {
  const { user } = useAuth();
  const { tenant, requiresTenantSelection } = useTenant();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setScheduledPosts([]);
    setLoading(Boolean(user));
  }, [requiresTenantSelection, tenant?.id, user?.id]);

  const fetchScheduledPosts = async () => {
    if (!user || requiresTenantSelection) {
      setScheduledPosts([]);
      setLoading(false);
      return;
    }

    try {
      // Build query - dual-join both content_tasks AND generated_content to support old & new schemas
      let query = supabase
        .from("scheduled_posts")
        .select(
          `
          *,
          content_tasks!scheduled_posts_task_id_fkey (
            ai_output,
            image_url
          ),
          generated_content!scheduled_posts_content_id_fkey (
            caption,
            media_url
          )
        `,
        )
        .in("status", ["QUEUED", "PUBLISHED", "ERROR"])
        .order("publish_at", { ascending: true });

      // Filter by tenant or user
      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { data, error } = await query;

      if (error) throw error;

      // Normalize data: prioritize content_tasks, fallback to generated_content for legacy posts
      const normalizedData = (data || []).map((post: any) => ({
        ...post,
        content: post.content_tasks
          ? {
              caption: post.content_tasks.ai_output,
              media_url: post.content_tasks.image_url,
            }
          : post.generated_content
            ? {
                caption: post.generated_content.caption,
                media_url: post.generated_content.media_url,
              }
            : null,
      }));

      setScheduledPosts(normalizedData);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      toast.error("Failed to load scheduled posts");
    } finally {
      setLoading(false);
    }
  };

  const schedulePost = async (
    contentId: string,
    publishAt: Date,
    platform: string,
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("scheduled_posts").insert({
        content_id: contentId,
        user_id: user.id,
        ...(tenant?.id ? { tenant_id: tenant.id } : {}),
        platform: platform as any, // Cast to match enum
        publish_at: publishAt.toISOString(),
        status: "QUEUED",
      });

      if (error) throw error;

      toast.success("Post scheduled successfully");
      await fetchScheduledPosts();
    } catch (error) {
      console.error("Error scheduling post:", error);
      toast.error("Failed to schedule post");
    }
  };

  const reschedulePost = async (scheduledId: string, newPublishAt: Date) => {
    if (!user) return;

    try {
      let query = supabase
        .from("scheduled_posts")
        .update({
          publish_at: newPublishAt.toISOString(),
          status: "QUEUED",
        })
        .eq("id", scheduledId);

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { error } = await query;

      if (error) throw error;

      toast.success("Post rescheduled successfully");
      await fetchScheduledPosts();
    } catch (error) {
      console.error("Error rescheduling post:", error);
      toast.error("Failed to reschedule post");
    }
  };

  const unschedulePost = async (scheduledId: string) => {
    if (!user) return;

    try {
      let query = supabase
        .from("scheduled_posts")
        .delete()
        .eq("id", scheduledId);

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { error } = await query;

      if (error) throw error;

      toast.success("Post unscheduled");
      await fetchScheduledPosts();
    } catch (error) {
      console.error("Error unscheduling post:", error);
      toast.error("Failed to unschedule post");
    }
  };

  const deleteScheduledPost = async (scheduledId: string) => {
    if (!user) return;

    try {
      // Instead of ARCHIVED, we'll just delete the record
      let query = supabase
        .from("scheduled_posts")
        .delete()
        .eq("id", scheduledId);

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { error } = await query;

      if (error) throw error;

      toast.success("Scheduled post deleted");
      await fetchScheduledPosts();
    } catch (error) {
      console.error("Error deleting scheduled post:", error);
      toast.error("Failed to delete scheduled post");
    }
  };

  const refreshScheduledPosts = async () => {
    await fetchScheduledPosts();
  };

  useEffect(() => {
    fetchScheduledPosts();
  }, [requiresTenantSelection, user, tenant]);

  return {
    scheduledPosts,
    loading,
    schedulePost,
    reschedulePost,
    unschedulePost,
    deleteScheduledPost,
    refreshScheduledPosts,
  };
};
