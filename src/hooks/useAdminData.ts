
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface AdminMetrics {
  totalUsers: number;
  totalProfiles: number;
  trialUsers: number;
  paidUsers: number;
  currentMRR: number;
  potentialMRR: number;
  conversionRate: number;
  uniqueUsers: number;
  duplicateAccounts: number;
}

export const useAdminData = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalProfiles: 0,
    trialUsers: 0,
    paidUsers: 0,
    currentMRR: 0,
    potentialMRR: 0,
    conversionRate: 0,
    uniqueUsers: 0,
    duplicateAccounts: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      console.log("Fetching admin metrics using new function...");

      // Use the new admin function to get accurate user data
      const { data: adminData, error: adminError } = await supabase.rpc('get_admin_user_data');

      if (adminError) {
        console.error('Error fetching admin data:', adminError);
        throw adminError;
      }

      console.log("Admin data from function:", adminData);

      // Calculate metrics based on ALL accounts (not just unique users)
      const totalAccounts = adminData?.length || 0;
      
      // Calculate unique users
      const uniqueEmails = new Set(adminData?.map(user => user.email) || []);
      const uniqueUsers = uniqueEmails.size;
      const duplicateAccounts = totalAccounts - uniqueUsers;

      // Calculate subscription metrics from all accounts
      const activeTrialAccounts = adminData?.filter(user => 
        user.subscription_plan === 'free_trial' && user.subscription_status === 'active'
      ).length || 0;

      const activePaidAccounts = adminData?.filter(user => 
        user.subscription_plan !== 'free_trial' && user.subscription_status === 'active'
      ).length || 0;

      // Calculate MRR based on active paid subscriptions
      let currentMRR = 0;
      adminData?.forEach(user => {
        if (user.subscription_plan !== 'free_trial' && user.subscription_status === 'active') {
          // Estimate monthly revenue based on plan
          if (user.subscription_plan === 'sprout') {
            currentMRR += 99; // Assume $99/month for sprout
          } else if (user.subscription_plan === 'bloom') {
            currentMRR += 249; // Assume $249/month for bloom
          }
        }
      });

      // Calculate potential MRR if all trial accounts converted to Sprout plan
      const potentialMRR = activeTrialAccounts * 99;

      // Calculate conversion rate based on unique users
      const conversionRate = uniqueUsers > 0 ? Math.round((activePaidAccounts / uniqueUsers) * 100) : 0;

      setMetrics({
        totalUsers: totalAccounts,
        totalProfiles: totalAccounts, 
        trialUsers: activeTrialAccounts,
        paidUsers: activePaidAccounts,
        currentMRR,
        potentialMRR,
        conversionRate,
        uniqueUsers,
        duplicateAccounts,
      });

      console.log("Calculated metrics:", {
        totalAccounts,
        uniqueUsers,
        duplicateAccounts,
        activeTrialAccounts,
        activePaidAccounts,
        currentMRR,
        potentialMRR,
        conversionRate
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return { metrics, loading, refetch: fetchAdminData };
};
