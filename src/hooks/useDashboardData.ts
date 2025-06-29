
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
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (tenant?.id) {
        campaignQuery.eq('tenant_id', tenant.id);
      } else {
        campaignQuery.eq('user_id', user.id);
      }

      const { data: campaigns } = await campaignQuery;
      const currentCampaign = campaigns?.[0] || null;

      // Fetch tasks
      const taskQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('status', ['draft', 'generated', 'approved', 'review'])
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery.eq('user_id', user.id);
      }

      const { data: tasks } = await taskQuery;

      // Fetch social connections
      const { data: connections } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      return {
        currentCampaign,
        tasks: tasks || [],
        socialConnections: connections || []
      };
    },
    enabled: !!user,
    staleTime: 30000, // Data stays fresh for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
