import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useCrmDashboardSnapshot } from '@/hooks/useCrmDashboardSnapshot';

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

  const snapshotQuery = useCrmDashboardSnapshot(
    {
      tenantId: tenant?.id,
      userId: user?.id,
    },
    {
      enabled: Boolean(user?.id),
    },
  );

  const calculateGrowth = (currentValue: number, previousValue: number) => {
    if (previousValue <= 0) {
      return 0;
    }

    return ((currentValue - previousValue) / previousValue) * 100;
  };

  const data: CRMMetrics | undefined = snapshotQuery.data
    ? {
        totalCustomers: snapshotQuery.data.totalCustomers,
        totalCustomersGrowth: calculateGrowth(
          snapshotQuery.data.currentMonthCustomers,
          snapshotQuery.data.previousMonthCustomers,
        ),
        activeCampaigns: snapshotQuery.data.activeCampaigns,
        activeCampaignsGrowth: calculateGrowth(
          snapshotQuery.data.currentMonthCampaigns,
          snapshotQuery.data.previousMonthCampaigns,
        ),
        conversionRate: Number(
          snapshotQuery.data.currentMonthConversionRate.toFixed(1),
        ),
        conversionRateGrowth: calculateGrowth(
          snapshotQuery.data.currentMonthConversionRate,
          snapshotQuery.data.previousMonthConversionRate,
        ),
        totalRevenue: snapshotQuery.data.totalCustomerRevenue,
        totalRevenueGrowth: calculateGrowth(
          snapshotQuery.data.currentMonthCustomerRevenue,
          snapshotQuery.data.previousMonthCustomerRevenue,
        ),
      }
    : undefined;

  return {
    data,
    error: snapshotQuery.error,
    isFetching: snapshotQuery.isFetching,
    isLoading: snapshotQuery.isLoading,
    refetch: snapshotQuery.refetch,
  };
};