
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface BasicUserData {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  campaignCount: number;
  taskCount: number;
}

export const useAdminData = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalCampaigns: 0,
    totalTasks: 0,
    activeSubscriptions: 0,
    freeTrialUsers: 0,
    paidUsers: 0,
  });
  const [users, setUsers] = useState<BasicUserData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      console.log("Fetching admin data...");

      // Get basic counts from available tables
      const [
        { count: totalUsers },
        { count: totalCampaigns }, 
        { count: totalTasks },
        { data: subscriptions }
      ] = await Promise.all([
        supabase.from('company_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('content_tasks').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*')
      ]);

      console.log("Fetched subscriptions:", subscriptions);

      // Calculate subscription metrics
      const activeSubscriptions = subscriptions?.filter(sub => 
        new Date(sub.end_date) > new Date()
      ).length || 0;

      const freeTrialUsers = subscriptions?.filter(sub => 
        sub.plan === 'free_trial' && new Date(sub.end_date) > new Date()
      ).length || 0;

      const paidUsers = subscriptions?.filter(sub => 
        sub.plan !== 'free_trial' && new Date(sub.end_date) > new Date()
      ).length || 0;

      console.log("Active subscriptions:", activeSubscriptions);
      console.log("Free trial users:", freeTrialUsers);
      console.log("Paid users:", paidUsers);

      setMetrics({
        totalUsers: totalUsers || 0,
        totalCampaigns: totalCampaigns || 0,
        totalTasks: totalTasks || 0,
        activeSubscriptions,
        freeTrialUsers,
        paidUsers,
      });

      // For basic users, we'll use the same data as detailed but simplified
      setUsers([]); // We'll populate this from company profiles if needed

    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return { metrics, users, loading, refetch: fetchAdminData };
};
