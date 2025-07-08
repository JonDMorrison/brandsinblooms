import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface Campaign {
  id: string;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
  user_id?: string;
  tenant_id?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
    week_number: number;
    start_date: string;
    user_id: string;
    tenant_id: string;
  };
}

export const useCalendarData = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      // Only show loading spinner for initial load or explicit refresh
      if (!initialLoaded || isRefresh) {
        setLoading(true);
      }
      
      console.log('useCalendarData: Fetching fresh data after cleanup');
      console.log('useCalendarData: User ID:', user.id, 'Tenant ID:', tenant?.id);
      
      // Build campaigns query based on tenant vs user model
      let campaignsQuery = supabase
        .from('campaigns')
        .select('*')
        .is('deleted_at', null)
        .order('start_date', { ascending: true });

      if (tenant?.id) {
        campaignsQuery = campaignsQuery.eq('tenant_id', tenant.id);
      } else {
        campaignsQuery = campaignsQuery.eq('user_id', user.id);
      }

      const { data: campaignsData, error: campaignsError } = await campaignsQuery;

      if (campaignsError) {
        throw campaignsError;
      }

      // Build tasks query with inner join
      let tasksQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            week_number,
            start_date,
            user_id,
            tenant_id
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (tenant?.id) {
        tasksQuery = tasksQuery.eq('campaigns.tenant_id', tenant.id);
      } else {
        tasksQuery = tasksQuery.eq('campaigns.user_id', user.id);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;

      if (tasksError) {
        throw tasksError;
      }

      // Security verification
      const userCampaigns = campaignsData?.filter(campaign => 
        tenant?.id ? campaign.tenant_id === tenant.id : campaign.user_id === user.id
      ) || [];
      
      const userTasks = tasksData?.filter(task => 
        task.campaigns && (
          tenant?.id ? task.campaigns.tenant_id === tenant.id : task.campaigns.user_id === user.id
        )
      ) || [];

      console.log('useCalendarData: Fetched campaigns:', userCampaigns.map(c => ({
        id: c.id, 
        title: c.title, 
        theme: c.theme, 
        week_number: c.week_number, 
        start_date: c.start_date
      })));
      
      setCampaigns(userCampaigns);
      setTasks(userTasks);
      
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [user, tenant, initialLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions for data updates
  useEffect(() => {
    if (!user) return;

    const campaignSubscription = supabase
      .channel('calendar-campaigns-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'campaigns' },
        () => fetchData(false) // Silent refresh for real-time updates
      )
      .subscribe();

    const taskSubscription = supabase
      .channel('calendar-content-tasks-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'content_tasks' },
        () => fetchData(false) // Silent refresh for real-time updates
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignSubscription);
      supabase.removeChannel(taskSubscription);
    };
  }, [user, fetchData]);

  const refreshData = useCallback(() => {
    fetchData(true); // Explicit refresh shows loading
  }, [fetchData]);

  // Memoized stats
  const stats = useMemo(() => {
    const currentWeek = Math.ceil(((new Date()).getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const upcomingCampaigns = campaigns.filter(c => c.week_number >= currentWeek).length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    
    return {
      upcomingCampaigns,
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  }, [campaigns, tasks]);

  return {
    campaigns,
    tasks,
    loading,
    error,
    stats,
    refetch: refreshData
  };
};