
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
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { NativeSelect } from "@/components/ui/NativeSelect";
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
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    fetchTenants,
    toggleTenantActive,
    extendTrial,
    goToPage,
    changePageSize,
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
    goToPage(1); // Reset to first page when filters change
    fetchTenants(search, status, 1);
  };

  const handleStatFilterClick = (status: string) => {
    setCurrentStatus(status);
    goToPage(1); // Reset to first page when filters change
    fetchTenants(currentSearch, status, 1);
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

          {/* Pagination Controls */}
          {!loading && tenants.length > 0 && (
            <div className="flex items-center justify-between px-4 py-4 bg-card rounded-lg border mt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <NativeSelect
                    value={pageSize.toString()}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value);
                      changePageSize(newSize);
                      fetchTenants(currentSearch, currentStatus, 1, newSize);
                    }}
                    className="w-16"
                    options={[
                      { value: "10", label: "10" },
                      { value: "25", label: "25" },
                      { value: "50", label: "50" },
                      { value: "100", label: "100" },
                    ]}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount} tenants
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Previous button clicked, currentPage:', currentPage, 'totalPages:', totalPages, 'totalCount:', totalCount);
                    if (currentPage > 1) {
                      const newPage = currentPage - 1;
                      console.log('Going to previous page:', newPage);
                      goToPage(newPage);
                      fetchTenants(currentSearch, currentStatus, newPage);
                    }
                  }}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages} (Total: {totalCount})
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Next button clicked, currentPage:', currentPage, 'totalPages:', totalPages, 'totalCount:', totalCount);
                    if (currentPage < totalPages) {
                      const newPage = currentPage + 1;
                      console.log('Going to next page:', newPage);
                      goToPage(newPage);
                      fetchTenants(currentSearch, currentStatus, newPage);
                    }
                  }}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
