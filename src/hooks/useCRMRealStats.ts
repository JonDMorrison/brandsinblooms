import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import {
  EMPTY_CRM_DASHBOARD_SNAPSHOT,
  useCrmDashboardSnapshot,
} from '@/hooks/useCrmDashboardSnapshot';

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
  const { user } = useAuth();
  const { tenant } = useTenant();

  const snapshotQuery = useCrmDashboardSnapshot(
    {
      tenantId: tenant?.id,
      userId: user?.id,
    },
    {
      enabled: Boolean(user?.id && tenant?.id),
    },
  );

  const snapshot = snapshotQuery.data ?? EMPTY_CRM_DASHBOARD_SNAPSHOT;

  const stats: CRMRealStats = {
    totalCustomers: snapshot.totalCustomers,
    totalCampaigns: snapshot.totalCampaigns,
    activeCampaigns: snapshot.activeCampaigns,
    avgOpenRate: Number(snapshot.avgOpenRate.toFixed(1)),
    avgClickRate: Number(snapshot.avgClickRate.toFixed(1)),
    totalRevenue: snapshot.totalCustomerRevenue,
    conversionRate: Number(snapshot.overallConversionRate.toFixed(1)),
    recentCustomers: snapshot.recentCustomers30d,
  };

  return {
    stats,
    loading: snapshotQuery.isLoading,
    error: snapshotQuery.error,
    refetch: snapshotQuery.refetch,
  };
};
