import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface CRMRealStats {
  totalCustomers: number;
  totalCampaigns: number;
  activeCampaigns: number;
  avgOpenRate: number;
  avgClickRate: number;
  totalRevenue: number;
  conversionRate: number;
  recentCustomers: number; // last 30 days
}

export const useCRMRealStats = () => {
  const [stats, setStats] = useState<CRMRealStats>({
    totalCustomers: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    totalRevenue: 0,
    conversionRate: 0,
    recentCustomers: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchRealStats = useCallback(async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from('crm_customers')
        .select('created_at, total_spent')
        .eq('tenant_id', tenant.id);

      if (customersError) throw customersError;

      // Calculate customer stats
      const totalCustomers = customers?.length || 0;
      const totalRevenue = customers?.reduce((sum, customer) => 
        sum + (customer.total_spent || 0), 0) || 0;

      // Recent customers (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCustomers = customers?.filter(customer => 
        new Date(customer.created_at) >= thirtyDaysAgo
      ).length || 0;

      // Fetch campaigns (mock for now - would be real campaigns table)
      // In real app, you'd have a campaigns table with status, open_rate, click_rate columns
      const totalCampaigns = Math.floor(totalCustomers / 10); // Mock: ~1 campaign per 10 customers
      const activeCampaigns = Math.max(1, Math.floor(totalCampaigns * 0.3)); // Mock: 30% active

      // Mock campaign performance based on industry averages but with some variation
      const avgOpenRate = totalCampaigns > 0 ? 20 + Math.random() * 10 : 0; // 20-30%
      const avgClickRate = totalCampaigns > 0 ? 2 + Math.random() * 4 : 0; // 2-6%
      const conversionRate = totalCampaigns > 0 ? 1 + Math.random() * 3 : 0; // 1-4%

      setStats({
        totalCustomers,
        totalCampaigns,
        activeCampaigns,
        avgOpenRate: parseFloat(avgOpenRate.toFixed(1)),
        avgClickRate: parseFloat(avgClickRate.toFixed(1)),
        totalRevenue,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        recentCustomers,
      });

    } catch (error) {
      console.error('Error fetching CRM real stats:', error);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  }, [user, tenant]);

  useEffect(() => {
    fetchRealStats();
  }, [fetchRealStats]);

  return { stats, loading, refetch: fetchRealStats };
};
