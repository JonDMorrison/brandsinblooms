
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminUserData {
  id: string;
  email: string;
  created_at: string;
  company_name?: string;
  company_overview?: string;
  location_info?: string;
  plan: string;
  status: string;
  trial_end_date?: string;
  last_login?: string;
  tokens_balance?: number;
  onboarding_completed?: boolean;
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get all users with their profiles and subscription data
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error fetching auth users:', authError);
        throw authError;
      }

      // Get company profiles and subscriptions for all users
      const userIds = authUsers.users.map(user => user.id);
      
      const [profilesResult, subscriptionsResult] = await Promise.all([
        supabase
          .from('company_profiles')
          .select('*')
          .in('user_id', userIds),
        supabase
          .from('subscriptions')
          .select('*')
          .in('user_id', userIds)
      ]);

      if (profilesResult.error) {
        console.error('Error fetching profiles:', profilesResult.error);
      }

      if (subscriptionsResult.error) {
        console.error('Error fetching subscriptions:', subscriptionsResult.error);
      }

      // Combine the data
      const combinedUsers: AdminUserData[] = authUsers.users.map(authUser => {
        const profile = profilesResult.data?.find(p => p.user_id === authUser.id);
        const subscription = subscriptionsResult.data?.find(s => s.user_id === authUser.id);
        
        const isActive = subscription && new Date(subscription.end_date) > new Date();

        return {
          id: authUser.id,
          email: authUser.email || 'No email',
          created_at: authUser.created_at,
          company_name: profile?.company_name || 'Not set',
          company_overview: profile?.company_overview || '',
          location_info: profile?.location_info || '',
          plan: subscription?.plan || 'No Plan',
          status: isActive ? 'Active' : 'Inactive',
          trial_end_date: subscription?.end_date,
          last_login: authUser.last_sign_in_at,
          tokens_balance: profile?.tokens_balance || 0,
          onboarding_completed: !!profile?.onboarding_completed_at
        };
      });

      setUsers(combinedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast.error('Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, refetch: fetchUsers };
};
