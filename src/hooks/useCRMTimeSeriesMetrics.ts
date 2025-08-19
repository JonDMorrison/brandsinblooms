import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

type TimeFilter = '7d' | '30d' | 'all';

interface TimeSeriesDataPoint {
  date: string;
  revenue: number;
  conversions: number;
  customers: number;
}

interface TimeSeriesMetrics {
  data: TimeSeriesDataPoint[];
  totalRevenue: number;
  totalConversions: number;
  totalCustomers: number;
  revenueGrowth: number;
  conversionGrowth: number;
  customerGrowth: number;
}

export const useCRMTimeSeriesMetrics = (timeFilter: TimeFilter = '30d') => {
  const [metrics, setMetrics] = useState<TimeSeriesMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchTimeSeriesMetrics = async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (timeFilter) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(2020, 0, 1); // Far past date for 'all'
      }

      // Fetch customers created within the time range
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('created_at, total_spent')
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Generate mock time series data (in real app, this would come from analytics)
      const generateTimeSeriesData = (): TimeSeriesDataPoint[] => {
        const data: TimeSeriesDataPoint[] = [];
        const days = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
        
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dayCustomers = customers?.filter(c => 
            new Date(c.created_at).toDateString() === date.toDateString()
          ).length || 0;
          
          data.push({
            date: date.toISOString().split('T')[0],
            revenue: Math.floor(Math.random() * 5000) + dayCustomers * 100,
            conversions: Math.floor(Math.random() * 50) + dayCustomers,
            customers: dayCustomers,
          });
        }
        
        return data;
      };

      const timeSeriesData = generateTimeSeriesData();
      
      // Calculate totals and growth
      const totalRevenue = timeSeriesData.reduce((sum, point) => sum + point.revenue, 0);
      const totalConversions = timeSeriesData.reduce((sum, point) => sum + point.conversions, 0);
      const totalCustomers = timeSeriesData.reduce((sum, point) => sum + point.customers, 0);

      // Mock growth percentages (in real app, compare with previous period)
      const revenueGrowth = Math.random() * 20 - 5; // -5% to +15%
      const conversionGrowth = Math.random() * 15 - 3; // -3% to +12%
      const customerGrowth = Math.random() * 25; // 0% to +25%

      setMetrics({
        data: timeSeriesData,
        totalRevenue,
        totalConversions,
        totalCustomers,
        revenueGrowth,
        conversionGrowth,
        customerGrowth,
      });

    } catch (error) {
      console.error('Error fetching time series metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeSeriesMetrics();
  }, [user, tenant, timeFilter]);

  return { metrics, loading, refetch: fetchTimeSeriesMetrics };
};