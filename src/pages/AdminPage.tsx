
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { UserMenu } from "@/components/UserMenu";
import { Shield, RefreshCw } from "lucide-react";
import { isSuperAdmin } from "@/utils/adminUtils";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { AdminStats } from "@/components/admin/AdminStats";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { TenantTable } from "@/components/admin/TenantTable";
import { TenantDrawer } from "@/components/admin/TenantDrawer";
import { Button } from "@/components/ui/button";
import { removeAllInertAttributes } from "@/utils/emergency-cleanup";

const AdminPage = () => {
  const { user } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentSearch, setCurrentSearch] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");

  const {
    tenants,
    stats,
    loading,
    error,
    fetchTenants,
    toggleTenantActive,
    extendTrial,
    refetch,
  } = useAdminTenants();

  // Emergency cleanup on mount to prevent unclickable elements
  useEffect(() => {
    removeAllInertAttributes();
  }, []);

  console.log("AdminPage data:", { tenants, stats, loading, error });

  // Only allow access to super admins - redirect to root instead of /app
  if (!user || !isSuperAdmin(user.email)) {
    return <Navigate to="/" replace />;
  }

  const handleFilterChange = (search: string, status: string) => {
    setCurrentSearch(search);
    setCurrentStatus(status);
    fetchTenants(search, status);
  };

  const handleStatFilterClick = (status: string) => {
    setCurrentStatus(status);
    fetchTenants(currentSearch, status);
  };

  const handleViewTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTenant(null);
  };

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-destructive" />
                <div>
                  <h1 className="text-3xl font-bold">Admin Console</h1>
                  <p className="text-muted-foreground">Tenant management and administration</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={refetch}
                  disabled={loading}
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="max-w-7xl mx-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive">Error: {error}</p>
            </div>
          )}

          {/* Stats */}
          <AdminStats stats={stats} onFilterClick={handleStatFilterClick} />

          {/* Filters */}
          <AdminFilters onFilterChange={handleFilterChange} loading={loading} />

          {/* Tenant Table */}
          <TenantTable
            tenants={tenants}
            loading={loading}
            onViewTenant={handleViewTenant}
            onExtendTrial={extendTrial}
            onToggleActive={toggleTenantActive}
          />
        </div>

        {/* Tenant Details Drawer */}
        <TenantDrawer
          tenant={selectedTenant}
          open={drawerOpen}
          onClose={handleCloseDrawer}
          onExtendTrial={extendTrial}
          onToggleActive={toggleTenantActive}
        />
      </div>
    </ProtectedPageWrapper>
  );
};

export default AdminPage;
