import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface CRMMetrics {
  totalCustomers: number;
  totalCustomersGrowth: number;
  activeCampaigns: number;
  activeCampaignsGrowth: number;
  conversionRate: number;
  conversionRateGrowth: number;
  totalRevenue: number;
  totalRevenueGrowth: number;
}

export const useCRMDashboardMetrics = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['crm-dashboard-metrics', user?.id, tenant?.id],
    queryFn: async (): Promise<CRMMetrics> => {
      if (!user) throw new Error('User not authenticated');

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      // Fetch customers data
      const customersQuery = supabase.from('crm_customers').select('*');
      const campaignsQuery = supabase.from('crm_campaigns').select('*');
      
      // Apply tenant filtering
      if (tenant?.id) {
        customersQuery.eq('tenant_id', tenant.id);
        campaignsQuery.eq('tenant_id', tenant.id);
      } else {
        customersQuery.eq('user_id', user.id);
        campaignsQuery.eq('user_id', user.id);
      }

      const { data: allCustomers } = await customersQuery;
      
      // Fetch current month customers
      const currentMonthCustomersQuery = supabase.from('crm_customers').select('*')
        .gte('created_at', currentMonth.toISOString());
      if (tenant?.id) {
        currentMonthCustomersQuery.eq('tenant_id', tenant.id);
      } else {
        currentMonthCustomersQuery.eq('user_id', user.id);
      }
      const { data: currentMonthCustomers } = await currentMonthCustomersQuery;
      
      // Fetch previous month customers
      const previousMonthCustomersQuery = supabase.from('crm_customers').select('*')
        .gte('created_at', previousMonth.toISOString())
        .lt('created_at', currentMonth.toISOString());
      if (tenant?.id) {
        previousMonthCustomersQuery.eq('tenant_id', tenant.id);
      } else {
        previousMonthCustomersQuery.eq('user_id', user.id);
      }
      const { data: previousMonthCustomers } = await previousMonthCustomersQuery;

      const { data: allCampaigns } = await campaignsQuery;
      
      // Fetch current month campaigns
      const currentMonthCampaignsQuery = supabase.from('crm_campaigns').select('*')
        .gte('created_at', currentMonth.toISOString());
      if (tenant?.id) {
        currentMonthCampaignsQuery.eq('tenant_id', tenant.id);
      } else {
        currentMonthCampaignsQuery.eq('user_id', user.id);
      }
      const { data: currentMonthCampaigns } = await currentMonthCampaignsQuery;
      
      // Fetch previous month campaigns
      const previousMonthCampaignsQuery = supabase.from('crm_campaigns').select('*')
        .gte('created_at', previousMonth.toISOString())
        .lt('created_at', currentMonth.toISOString());
      if (tenant?.id) {
        previousMonthCampaignsQuery.eq('tenant_id', tenant.id);
      } else {
        previousMonthCampaignsQuery.eq('user_id', user.id);
      }
      const { data: previousMonthCampaigns } = await previousMonthCampaignsQuery;

      // Calculate metrics
      const totalCustomers = allCustomers?.length || 0;
      const currentCustomerCount = currentMonthCustomers?.length || 0;
      const previousCustomerCount = previousMonthCustomers?.length || 0;
      const totalCustomersGrowth = previousCustomerCount > 0 
        ? ((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 100 
        : 0;

      const activeCampaigns = allCampaigns?.filter(c => c.status === 'active' || c.status === 'sent').length || 0;
      const currentCampaignCount = currentMonthCampaigns?.length || 0;
      const previousCampaignCount = previousMonthCampaigns?.length || 0;
      const activeCampaignsGrowth = previousCampaignCount > 0 
        ? ((currentCampaignCount - previousCampaignCount) / previousCampaignCount) * 100 
        : 0;

      // Calculate revenue from customer total_spent and campaign metrics
      const customerRevenue = allCustomers?.reduce((sum, customer) => {
        return sum + (Number(customer.total_spent) || 0);
      }, 0) || 0;

      const campaignRevenue = allCampaigns?.reduce((sum, campaign) => {
        const metrics = campaign.metrics as any;
        const revenue = metrics?.revenue || 0;
        return sum + Number(revenue);
      }, 0) || 0;

      const totalRevenue = customerRevenue + campaignRevenue;

      // Calculate previous month revenue for growth
      const previousRevenueQuery = supabase.from('crm_customers')
        .select('total_spent')
        .gte('created_at', twoMonthsAgo.toISOString())
        .lt('created_at', previousMonth.toISOString());
      if (tenant?.id) {
        previousRevenueQuery.eq('tenant_id', tenant.id);
      } else {
        previousRevenueQuery.eq('user_id', user.id);
      }
      const { data: previousMonthCustomersRevenue } = await previousRevenueQuery;

      const previousRevenue = previousMonthCustomersRevenue?.reduce((sum, customer) => {
        return sum + (Number(customer.total_spent) || 0);
      }, 0) || 0;

      const totalRevenueGrowth = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;

      // Calculate conversion rate from campaign metrics
      const totalSent = allCampaigns?.reduce((sum, campaign) => {
        const metrics = campaign.metrics as any;
        return sum + (metrics?.sent || 0);
      }, 0) || 0;

      const totalOpened = allCampaigns?.reduce((sum, campaign) => {
        const metrics = campaign.metrics as any;
        return sum + (metrics?.opened || 0);
      }, 0) || 0;

      const conversionRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

      // Calculate previous month conversion rate
      const previousCampaigns = allCampaigns?.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= previousMonth && createdAt < currentMonth;
      }) || [];

      const previousTotalSent = previousCampaigns.reduce((sum, campaign) => {
        const metrics = campaign.metrics as any;
        return sum + (metrics?.sent || 0);
      }, 0);

      const previousTotalOpened = previousCampaigns.reduce((sum, campaign) => {
        const metrics = campaign.metrics as any;
        return sum + (metrics?.opened || 0);
      }, 0);

      const previousConversionRate = previousTotalSent > 0 ? (previousTotalOpened / previousTotalSent) * 100 : 0;
      const conversionRateGrowth = previousConversionRate > 0 
        ? ((conversionRate - previousConversionRate) / previousConversionRate) * 100 
        : 0;

      return {
        totalCustomers,
        totalCustomersGrowth,
        activeCampaigns,
        activeCampaignsGrowth,
        conversionRate: Number(conversionRate.toFixed(1)),
        conversionRateGrowth,
        totalRevenue,
        totalRevenueGrowth,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};