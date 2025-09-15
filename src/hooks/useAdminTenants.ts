import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminTenant {
  tenant_id: string;
  company_name: string;
  website: string;
  city: string;
  region: string;
  country: string;
  onboarding_completed_at: string | null;
  tenant_created_at: string;
  primary_contact_email: string;
  primary_contact_name: string;
  primary_contact_last_login: string | null;
  plan: string;
  subscription_status: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  last_activity_at: string | null;
  is_trialing: boolean;
  is_paid_active: boolean;
  trial_not_expired: boolean;
  is_active: boolean;
}

interface AdminStats {
  total_tenants: number;
  active_trials: number;
  paid_active: number;
  inactive_tenants: number;
}

export const useAdminTenants = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total_tenants: 0,
    active_trials: 0,
    paid_active: 0,
    inactive_tenants: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchTenants = async (
    search?: string,
    status?: string,
    page?: number,
    limit?: number
  ) => {
    try {
      setLoading(true);
      setError(null);

      const actualPage = page !== undefined ? page : currentPage;
      const actualLimit = limit !== undefined ? limit : pageSize;
      const offset = (actualPage - 1) * actualLimit;
      
      console.log('fetchTenants called with:', { search, status, page, limit, actualPage, actualLimit, offset });
      
      // Get total count from the admin function instead of direct table access
      const { data: statsData, error: statsError } = await supabase.rpc('admin_get_stats');
      
      if (statsError) {
        console.error('Error fetching stats for count:', statsError);
      } else if (statsData && statsData.length > 0) {
        const totalFromStats = Number(statsData[0].total_tenants);
        console.log('Total count from admin_get_stats:', totalFromStats);
        setTotalCount(totalFromStats);
      }

      const { data: tenantsData, error: tenantsError } = await supabase.rpc(
        'admin_list_tenants',
        {
          p_search: search || null,
          p_status: status || null,
          p_limit: actualLimit,
          p_offset: offset,
        }
      );

      if (tenantsError) throw tenantsError;

      console.log('Fetched tenants data:', tenantsData?.length, 'records');
      setTenants(tenantsData || []);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
      setError(err.message);
      toast({
        title: "Error",
        description: "Failed to load tenant data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: statsData, error: statsError } = await supabase.rpc('admin_get_stats');

      if (statsError) throw statsError;

      if (statsData && statsData.length > 0) {
        setStats({
          total_tenants: Number(statsData[0].total_tenants),
          active_trials: Number(statsData[0].active_trials),
          paid_active: Number(statsData[0].paid_active),
          inactive_tenants: Number(statsData[0].inactive_tenants),
        });
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  };

  const toggleTenantActive = async (tenantId: string, active: boolean) => {
    try {
      const { error } = await supabase.rpc('admin_toggle_tenant_active', {
        p_tenant_id: tenantId,
        p_active: active,
      });

      if (error) throw error;

      // Update local state optimistically
      setTenants(prev => prev.map(tenant => 
        tenant.tenant_id === tenantId 
          ? { ...tenant, is_active: active }
          : tenant
      ));

      toast({
        title: "Success",
        description: `Tenant ${active ? 'activated' : 'deactivated'} successfully`,
      });

      // Refresh stats
      fetchStats();
    } catch (err: any) {
      console.error('Error toggling tenant:', err);
      toast({
        title: "Error",
        description: "Failed to update tenant status",
        variant: "destructive",
      });
    }
  };

  const extendTrial = async (tenantId: string, days: number) => {
    try {
      const { error } = await supabase.rpc('admin_extend_trial', {
        p_tenant_id: tenantId,
        p_days: days,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Trial extended by ${days} days`,
      });

      // Refresh tenant data
      fetchTenants();
      fetchStats();
    } catch (err: any) {
      console.error('Error extending trial:', err);
      toast({
        title: "Error",
        description: "Failed to extend trial",
        variant: "destructive",
      });
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };
  
  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  useEffect(() => {
    fetchTenants();
    fetchStats();
  }, []);

  return {
    tenants,
    stats,
    loading,
    error,
    currentPage,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    fetchTenants,
    fetchStats,
    toggleTenantActive,
    extendTrial,
    goToPage,
    changePageSize,
    refetch: () => {
      fetchTenants();
      fetchStats();
    },
  };
};