
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
      console.log("Fetching real admin data...");

      // Get all company profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('company_profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Get all subscriptions
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subscriptionsError) {
        console.error('Error fetching subscriptions:', subscriptionsError);
        throw subscriptionsError;
      }

      console.log("Profiles found:", profiles?.length || 0);
      console.log("Subscriptions found:", subscriptions?.length || 0);

      const totalProfiles = profiles?.length || 0;
      
      // Calculate subscription metrics
      const activeTrialUsers = subscriptions?.filter(sub => 
        sub.plan === 'free_trial' && new Date(sub.end_date) > new Date()
      ).length || 0;

      const activePaidUsers = subscriptions?.filter(sub => 
        sub.plan !== 'free_trial' && new Date(sub.end_date) > new Date()
      ).length || 0;

      // Calculate MRR based on active paid subscriptions
      let currentMRR = 0;
      subscriptions?.forEach(sub => {
        if (sub.plan !== 'free_trial' && new Date(sub.end_date) > new Date()) {
          // Estimate monthly revenue based on plan
          if (sub.plan === 'sprout') {
            currentMRR += sub.billing_interval === 'annual' ? 79 : 99; // $79/month annual, $99 monthly
          } else if (sub.plan === 'bloom') {
            currentMRR += sub.billing_interval === 'annual' ? 199 : 249; // $199/month annual, $249 monthly
          }
        }
      });

      // Calculate potential MRR if all trial users converted to Sprout plan
      const potentialMRR = activeTrialUsers * 99; // Assume $99/month Sprout plan

      const conversionRate = totalProfiles > 0 ? Math.round((activePaidUsers / totalProfiles) * 100) : 0;

      setMetrics({
        totalUsers: totalProfiles, // Use profiles as the main user count
        totalProfiles,
        trialUsers: activeTrialUsers,
        paidUsers: activePaidUsers,
        currentMRR,
        potentialMRR,
        conversionRate,
      });

      console.log("Calculated metrics:", {
        totalProfiles,
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
