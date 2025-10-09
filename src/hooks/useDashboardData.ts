
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { memoryCache, apiDeduplicator } from '@/utils/performanceOptimizations';

export const useDashboardData = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['dashboard-data', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const cacheKey = `dashboard-${user.id}-${tenant?.id || 'no-tenant'}`;
      
      // Check cache first
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Use deduplication for API calls
      return apiDeduplicator.dedupe(cacheKey, async () => {
        // Fetch current campaign
        const campaignQuery = supabase
          .from('campaigns')
          .select('id, title, start_date, week_number, user_id, tenant_id, created_by_user_id')
          .order('created_at', { ascending: false })
          .limit(1);

        if (tenant?.id) {
          campaignQuery.eq('tenant_id', tenant.id);
        } else {
          campaignQuery.eq('user_id', user.id);
        }

        const { data: campaigns } = await campaignQuery;
        const currentCampaign = campaigns?.[0] || null;

      // Fetch tasks - ensure proper user filtering
      const taskQuery = supabase
        .from('content_tasks')
        .select(`
          id,
          status,
          ai_output,
          post_type,
          scheduled_date,
          created_at,
          attachments,
          image_url,
          campaign_id,
          campaigns (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('status', ['draft', 'generated', 'approved', 'review', 'scheduled', 'published'])
        .order('created_at', { ascending: false });

      // Always filter by user ownership - never show other users' content
      if (tenant?.id) {
        taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery.eq('user_id', user.id);
      }

      const { data: tasks } = await taskQuery;

      // Fetch scheduled posts - no join needed, we'll match by task_id
      const scheduledPostsQuery = supabase
        .from('scheduled_posts')
        .select(`
          id,
          content_id,
          task_id,
          platform,
          publish_at,
          status,
          mode,
          tenant_id
        `)
        .in('status', ['QUEUED', 'PUBLISHED']);

      // Apply proper filtering for scheduled posts
      if (tenant?.id) {
        scheduledPostsQuery.eq('tenant_id', tenant.id);
      }

      const { data: scheduledPosts } = await scheduledPostsQuery;

      // Fetch social connections
      const { data: connections } = await supabase
        .from('social_connections')
        .select('id, platform, platform_account_name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Separate tasks by status
      const allTasks = tasks || [];
      const drafts = allTasks.filter(task => ['draft', 'generated', 'approved', 'review'].includes(task.status));
      const scheduledTasks = allTasks.filter(task => task.status === 'scheduled');
      const publishedTasks = allTasks.filter(task => task.status === 'published');

      // Group scheduled tasks by date for the ribbon
      const scheduledByDate = scheduledTasks.reduce((acc, task) => {
        if (task.scheduled_date) {
          const dateKey = new Date(task.scheduled_date).toISOString().split('T')[0];
          if (!acc[dateKey]) acc[dateKey] = [];
          
          // Find matching scheduled post for additional metadata including mode
          const scheduledPost = scheduledPosts?.find(sp => sp.content_id === task.id);
          
          acc[dateKey].push({
            ...task,
            scheduledMeta: scheduledPost ? {
              platform: scheduledPost.platform,
              publish_at: scheduledPost.publish_at,
              status: scheduledPost.status,
              mode: scheduledPost.mode || 'AUTO'
            } : null
          });
        }
        return acc;
      }, {} as Record<string, any[]>);

        const result = {
          currentCampaign,
          tasks: allTasks,
          drafts,
          scheduledTasks,
          publishedTasks,
          scheduledByDate,
          scheduledPosts: scheduledPosts || [],
          socialConnections: connections || []
        };

        // Cache the result for 2 minutes
        memoryCache.set(cacheKey, result, 120000);
        
        return result;
      });
    },
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
