
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

interface SubscriptionData {
  plan: string;
  start_date: string;
  end_date: string;
  billing_interval: string;
}

interface ProfileWithSubscription {
  user_id: string;
  created_at: string;
  company_name?: string;
  company_overview?: string;
  location_info?: string;
  tokens_balance?: number;
  onboarding_completed_at?: string;
  subscriptions: SubscriptionData[];
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log("Fetching users from company_profiles and subscriptions...");
      
      // Get company profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('company_profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Get subscriptions separately
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subscriptionsError) {
        console.error('Error fetching subscriptions:', subscriptionsError);
        throw subscriptionsError;
      }

      console.log("Fetched profiles:", profiles);
      console.log("Fetched subscriptions:", subscriptions);

      // Transform the data to match AdminUserData interface
      const transformedUsers: AdminUserData[] = profiles?.map(profile => {
        // Find matching subscription for this user
        const userSubscription = subscriptions?.find(sub => sub.user_id === profile.user_id);
        const isActive = userSubscription && new Date(userSubscription.end_date) > new Date();

        return {
          id: profile.user_id,
          email: 'Email not available', // We can't access auth.users from frontend
          created_at: profile.created_at,
          company_name: profile.company_name || 'Not set',
          company_overview: profile.company_overview || '',
          location_info: profile.location_info || '',
          plan: userSubscription?.plan || 'No Plan',
          status: isActive ? 'Active' : 'Inactive',
          trial_end_date: userSubscription?.end_date,
          last_login: undefined, // Not available from profiles
          tokens_balance: profile.tokens_balance || 0,
          onboarding_completed: !!profile.onboarding_completed_at
        };
      }) || [];

      setUsers(transformedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      console.log("Transformed users:", transformedUsers);

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
