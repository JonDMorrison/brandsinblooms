
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  campaignCount: number;
  taskCount: number;
}

interface SubscriptionData {
  plan: string;
  end_date: string;
}

export const useAdminData = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalCampaigns: 0,
    totalTasks: 0,
    activeSubscriptions: 0,
    freeTrialUsers: 0,
    paidUsers: 0
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch basic metrics
      const [
        { count: usersCount },
        { count: campaignsCount },
        { count: tasksCount },
        { data: subscriptions }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('content_tasks').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*')
      ]);

      // Calculate subscription metrics
      const activeSubscriptions = subscriptions?.filter((sub: SubscriptionData) => 
        new Date(sub.end_date) > new Date()
      ).length || 0;

      const freeTrialUsers = subscriptions?.filter((sub: SubscriptionData) => 
        sub.plan === 'free_trial'
      ).length || 0;

      const paidUsers = subscriptions?.filter((sub: SubscriptionData) => 
        sub.plan !== 'free_trial'
      ).length || 0;

      setMetrics({
        totalUsers: usersCount || 0,
        totalCampaigns: campaignsCount || 0,
        totalTasks: tasksCount || 0,
        activeSubscriptions,
        freeTrialUsers,
        paidUsers
      });

      // Fetch detailed user data with their campaigns and tasks
      const { data: detailedUsers } = await supabase
        .from('users')
        .select(`
          id,
          email,
          created_at,
          subscriptions (
            plan,
            end_date
          )
        `)
        .order('created_at', { ascending: false });

      if (detailedUsers) {
        const usersWithStats = await Promise.all(
          detailedUsers.map(async (user: any) => {
            // Get campaign count for user (assuming campaigns are user-specific)
            const { count: campaignCount } = await supabase
              .from('campaigns')
              .select('*', { count: 'exact', head: true });

            // Get task count for user
            const { count: taskCount } = await supabase
              .from('content_tasks')
              .select('*', { count: 'exact', head: true });

            const subscription = user.subscriptions?.[0] as SubscriptionData | undefined;
            const isActive = subscription && new Date(subscription.end_date) > new Date();

            return {
              id: user.id,
              email: user.email,
              created_at: user.created_at,
              plan: subscription?.plan || 'No Plan',
              status: isActive ? 'Active' : 'Inactive',
              campaignCount: campaignCount || 0,
              taskCount: taskCount || 0
            };
          })
        );

        setUsers(usersWithStats);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return { metrics, users, loading, refetch: fetchAdminData };
};
