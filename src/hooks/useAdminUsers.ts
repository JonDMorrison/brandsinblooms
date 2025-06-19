
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
  is_duplicate?: boolean;
  account_number?: number;
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log("Fetching admin user data using database function...");
      
      // Use the new admin function to get user data with emails
      const { data, error } = await supabase.rpc('get_admin_user_data');

      if (error) {
        console.error('Error fetching admin user data:', error);
        throw error;
      }

      console.log("Raw admin user data:", data);

      // Transform the data to match AdminUserData interface
      const transformedUsers: AdminUserData[] = data?.map(user => ({
        id: user.user_id,
        email: user.email || 'No email',
        created_at: user.created_at,
        company_name: user.company_name || 'Not set',
        company_overview: user.company_overview || '',
        location_info: user.location_info || '',
        plan: user.subscription_plan || 'No Plan',
        status: user.subscription_status || 'Inactive',
        trial_end_date: user.subscription_end_date,
        last_login: undefined, // Not available from this function
        tokens_balance: user.tokens_balance || 0,
        onboarding_completed: !!user.onboarding_completed_at
      })) || [];

      // Instead of removing duplicates, identify them and add metadata
      const emailCounts = transformedUsers.reduce((acc, user) => {
        acc[user.email] = (acc[user.email] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const emailCounters = {} as Record<string, number>;

      const usersWithDuplicateInfo = transformedUsers.map(user => {
        const hasDuplicates = emailCounts[user.email] > 1;
        if (hasDuplicates) {
          emailCounters[user.email] = (emailCounters[user.email] || 0) + 1;
          return {
            ...user,
            is_duplicate: true,
            account_number: emailCounters[user.email]
          };
        }
        return {
          ...user,
          is_duplicate: false,
          account_number: 1
        };
      });

      // Sort by email first, then by creation date (newest first within same email)
      const sortedUsers = usersWithDuplicateInfo.sort((a, b) => {
        if (a.email !== b.email) {
          return a.email.localeCompare(b.email);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setUsers(sortedUsers);
      console.log("All users with duplicate info:", sortedUsers);

    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast.error('Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      console.log('Deleting user:', userId);
      
      const { data, error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId
      });

      if (error) {
        console.error('Error deleting user:', error);
        throw error;
      }

      console.log('User deleted successfully:', data);
      toast.success('User deleted successfully');
      
      // Refresh the user list
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, refetch: fetchUsers, deleteUser };
};
