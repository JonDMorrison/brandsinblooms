import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

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
    console.log(`[useAdminUsers] Starting deletion process for user: ${userId}`);
    
    try {
      // Get current user info for logging
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error(`[useAdminUsers] Error getting current user:`, userError);
        throw new Error('Failed to verify user authentication');
      }

      if (!currentUser?.user?.email) {
        console.error(`[useAdminUsers] No authenticated user found`);
        throw new Error('You must be logged in to delete users');
      }

      console.log(`[useAdminUsers] Current user: ${currentUser.user.email}`);
      console.log(`[useAdminUsers] Calling admin_delete_user RPC function...`);
      
      const { data, error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId
      });

      console.log(`[useAdminUsers] RPC call completed. Data:`, data, 'Error:', error);

      if (error) {
        console.error(`[useAdminUsers] RPC error:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Provide specific error messages
        if (error.message.includes('Access denied')) {
          throw new Error('Access denied. Only super administrators can delete users.');
        } else if (error.message.includes('does not exist')) {
          throw new Error('User not found or already deleted.');
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      console.log(`[useAdminUsers] User deleted successfully. Result:`, data);
      
      // Refresh the user list
      console.log(`[useAdminUsers] Refreshing user list...`);
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error(`[useAdminUsers] Error in deleteUser:`, error);
      
      // Re-throw the error so the UI can handle it
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred while deleting the user');
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, refetch: fetchUsers, deleteUser };
};
