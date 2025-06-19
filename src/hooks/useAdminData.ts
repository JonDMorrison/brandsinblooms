
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminMetrics {
  totalUsers: number;
  totalProfiles: number;
  trialUsers: number;
  paidUsers: number;
  currentMRR: number;
  potentialMRR: number;
  conversionRate: number;
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

      // Remove duplicates based on email to get unique users
      const uniqueUsers = adminData?.reduce((acc, current) => {
        const existingUser = acc.find(user => user.email === current.email);
        if (!existingUser) {
          acc.push(current);
        }
        return acc;
      }, []) || [];

      const totalUsers = uniqueUsers.length;
      
      // Calculate subscription metrics from unique users
      const activeTrialUsers = uniqueUsers.filter(user => 
        user.subscription_plan === 'free_trial' && user.subscription_status === 'active'
      ).length;

      const activePaidUsers = uniqueUsers.filter(user => 
        user.subscription_plan !== 'free_trial' && user.subscription_status === 'active'
      ).length;

      // Calculate MRR based on active paid subscriptions
      let currentMRR = 0;
      uniqueUsers.forEach(user => {
        if (user.subscription_plan !== 'free_trial' && user.subscription_status === 'active') {
          // Estimate monthly revenue based on plan
          if (user.subscription_plan === 'sprout') {
            currentMRR += 99; // Assume $99/month for sprout
          } else if (user.subscription_plan === 'bloom') {
            currentMRR += 249; // Assume $249/month for bloom
          }
        }
      });

      // Calculate potential MRR if all trial users converted to Sprout plan
      const potentialMRR = activeTrialUsers * 99;

      const conversionRate = totalUsers > 0 ? Math.round((activePaidUsers / totalUsers) * 100) : 0;

      setMetrics({
        totalUsers,
        totalProfiles: totalUsers, // Same as total users now
        trialUsers: activeTrialUsers,
        paidUsers: activePaidUsers,
        currentMRR,
        potentialMRR,
        conversionRate,
      });

      console.log("Calculated metrics:", {
        totalUsers,
        activeTrialUsers,
        activePaidUsers,
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
