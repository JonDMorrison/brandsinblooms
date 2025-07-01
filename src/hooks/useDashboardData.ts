
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export const useDashboardData = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['dashboard-data', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

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

      // Fetch tasks - more selective query for performance
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
          campaign_id,
          campaigns!inner (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('status', ['draft', 'generated', 'approved', 'review', 'scheduled'])
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery.eq('user_id', user.id);
      }

      const { data: tasks } = await taskQuery;

      // Fetch scheduled posts with their content task details and mode
      const scheduledPostsQuery = supabase
        .from('scheduled_posts')
        .select(`
          id,
          content_id,
          platform,
          publish_at,
          status,
          mode,
          tenant_id,
          content_tasks!inner (
            id,
            ai_output,
            post_type,
            attachments,
            campaign_id,
            tenant_id,
            created_by_user_id
          )
        `)
        .in('status', ['QUEUED', 'PUBLISHED']);

      // Apply proper filtering for scheduled posts using the new tenant_id column
      if (tenant?.id) {
        scheduledPostsQuery.eq('tenant_id', tenant.id);
      } else {
        scheduledPostsQuery.eq('content_tasks.created_by_user_id', user.id);
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

      console.log('📊 Dashboard data loaded:', {
        tasksCount: allTasks.length,
        draftsCount: drafts.length,
        scheduledCount: scheduledTasks.length,
        scheduledPosts: scheduledPosts?.length || 0,
        connections: connections?.length || 0
      });

      return {
        currentCampaign,
        tasks: allTasks,
        drafts,
        scheduledTasks,
        scheduledByDate,
        scheduledPosts: scheduledPosts || [],
        socialConnections: connections || []
      };
    },
    enabled: !!user,
    staleTime: 30000, // Data stays fresh for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
