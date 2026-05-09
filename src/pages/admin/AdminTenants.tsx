import { useEffect, useState } from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { AdminStats } from "@/components/admin/AdminStats";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { TenantTable, type AdminTenant } from "@/components/admin/TenantTable";
import { TenantDrawer } from "@/components/admin/TenantDrawer";
import { ChangePlanModal } from "@/components/admin/ChangePlanModal";
import { TenantOutreachModal } from "@/components/admin/TenantOutreachModal";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyTablePagination } from "@/components/joy/JoyTable";
import { ADMIN_SESSION_BACKUP_STORAGE_KEY } from "@/hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { removeAllInertAttributes } from "@/utils/emergency-cleanup";

interface ImpersonateUserResponse {
  success?: boolean;
  token_hash?: string | null;
  type?: string;
  redirect_to?: string;
  target_email?: string;
  target_user_id?: string;
  error?: string | null;
}

const AdminPage = () => {
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentSearch, setCurrentSearch] = useState("");
  const [currentStatus, setCurrentStatus] = useState("");
  const [changePlanTenant, setChangePlanTenant] = useState<AdminTenant | null>(
    null,
  );
  const [outreachTenant, setOutreachTenant] = useState<AdminTenant | null>(
    null,
  );

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
    fetchStats,
    toggleTenantActive,
    extendTrial,
    goToPage,
    changePageSize,
  } = useAdminTenants();

  const hasActiveFilters = Boolean(currentSearch || currentStatus);
  const statusFilterLabel =
    currentStatus === "active"
      ? "Active"
      : currentStatus === "trialing"
        ? "Trialing"
        : currentStatus === "canceled"
          ? "Suspended / Inactive"
          : null;

  const handleRefresh = () => {
    void fetchTenants(currentSearch, currentStatus, currentPage, pageSize);
    void fetchStats();
  };

  // Emergency cleanup on mount to prevent unclickable elements
  useEffect(() => {
    removeAllInertAttributes();
  }, []);

  if (isAdminLoading) {
    return (
      <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
        <Stack
          minHeight="40vh"
          alignItems="center"
          justifyContent="center"
          spacing={2}
        >
          <CircularProgress size="md" />
          <Typography level="body-sm" color="neutral">
            Checking admin access...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
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

  const handleViewTenant = (tenant: AdminTenant) => {
    setSelectedTenant(tenant);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTenant(null);
  };

  const handleEmailManagement = (tenantId: string) => {
    navigate(`/admin/tenants/${tenantId}/email`);
  };

  const handleImpersonate = async (tenant: AdminTenant) => {
    if (!tenant.primary_contact_email) {
      sonnerToast.error("No contact email for this tenant");
      return;
    }

    try {
      const { data, error } =
        await supabase.functions.invoke<ImpersonateUserResponse>(
          "admin-impersonate-user",
          {
            body: {
              target_user_email: tenant.primary_contact_email,
              target_tenant_id: tenant.tenant_id,
              redirect_origin: window.location.origin,
            },
          },
        );

      if (
        error ||
        data?.error ||
        !data?.success ||
        !data?.token_hash ||
        !data?.type ||
        !data?.target_email
      ) {
        sonnerToast.error(
          data?.error || error?.message || "Impersonation failed",
        );
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        sonnerToast.error(
          sessionError?.message ||
            "Unable to back up the current admin session.",
        );
        return;
      }

      sessionStorage.setItem(
        ADMIN_SESSION_BACKUP_STORAGE_KEY,
        JSON.stringify(session),
      );

      const callbackParams = new URLSearchParams({
        token_hash: data.token_hash,
        type: data.type,
        target_email: data.target_email,
      });
      const callbackUrl = `${window.location.origin}/admin/impersonate/callback?${callbackParams.toString()}`;
      const impersonationWindow = window.open(callbackUrl, "_blank");

      if (!impersonationWindow) {
        sonnerToast.error(
          "Popup blocked by browser. Please allow popups for this site and try again.",
        );
        return;
      }

      sonnerToast.info(
        `Impersonation session opened in a new tab for ${tenant.company_name || tenant.primary_contact_email}.`,
        { duration: 8000 },
      );
    } catch (error: unknown) {
      sonnerToast.error(
        error instanceof Error ? error.message : "Impersonation failed",
      );
    }
  };

  return (
    <>
      <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
        <Stack spacing={3}>
          <JoyCard
            sx={{
              borderColor: "primary.200",
              background:
                "linear-gradient(135deg, rgba(var(--joy-palette-primary-mainChannel) / 0.12) 0%, #FFFFFF 54%, rgba(var(--joy-palette-warning-mainChannel) / 0.12) 100%)",
            }}
          >
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", lg: "center" }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Sheet
                    variant="soft"
                    color="primary"
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Shield className="h-6 w-6" />
                  </Sheet>
                  <Stack spacing={0.75}>
                    <Typography level="h2">Tenant Operations</Typography>
                    <Typography level="body-sm" color="neutral">
                      Review the full tenant roster, manage trial and plan
                      states, and open detailed admin workflows without leaving
                      the Joy shell.
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <JoyStatusChip
                        status={hasActiveFilters ? "filtered" : "all"}
                        tone={hasActiveFilters ? "info" : "neutral"}
                        label={
                          hasActiveFilters ? "Filtered roster" : "All tenants"
                        }
                      />
                      <JoyStatusChip
                        status="page"
                        tone="neutral"
                        label={`Page ${currentPage}${totalPages ? ` of ${totalPages}` : ""}`}
                      />
                      <JoyStatusChip
                        status="results"
                        tone="primary"
                        label={`${tenants.length} tenants on this page`}
                      />
                    </Stack>
                  </Stack>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  alignItems="center"
                >
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() => navigate("/admin/audit-logs")}
                    startDecorator={<ClipboardList className="h-4 w-4" />}
                  >
                    Audit Logs
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={() => navigate("/admin/reports")}
                    startDecorator={<FileText className="h-4 w-4" />}
                  >
                    Reports
                  </JoyButton>
                  <JoyButton
                    bloomVariant="outline"
                    onClick={handleRefresh}
                    disabled={loading}
                    loading={loading}
                    loadingPosition="start"
                    size="sm"
                    startDecorator={<RefreshCw className="h-4 w-4" />}
                  >
                    Refresh
                  </JoyButton>
                </Stack>
              </Stack>
            </JoyCardContent>
          </JoyCard>

          {error ? (
            <JoyCard variant="soft" color="danger">
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <AlertTriangle className="h-5 w-5" />
                    <Stack spacing={0.35}>
                      <Typography level="title-sm" color="danger">
                        Tenant data failed to load
                      </Typography>
                      <Typography level="body-sm" color="danger">
                        {error}
                      </Typography>
                    </Stack>
                  </Stack>
                  <JoyButton
                    bloomVariant="outline"
                    color="danger"
                    onClick={handleRefresh}
                  >
                    Retry
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          ) : null}

          <AdminStats stats={stats} onFilterClick={handleStatFilterClick} />

          <AdminFilters onFilterChange={handleFilterChange} loading={loading} />

          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", lg: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.25}>
                <Typography level="title-md">Tenant Roster</Typography>
                <Typography level="body-sm" color="neutral">
                  {loading
                    ? "Refreshing tenant data for the current page."
                    : hasActiveFilters
                      ? "Filters are active. Clear them to return to the full tenant roster."
                      : "Open any tenant to review subscription, contact, and governance details."}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {statusFilterLabel ? (
                  <JoyStatusChip
                    status="status-filter"
                    tone="warning"
                    label={`Status: ${statusFilterLabel}`}
                  />
                ) : null}
                {currentSearch ? (
                  <JoyStatusChip
                    status="search"
                    tone="info"
                    label={`Search: ${currentSearch}`}
                  />
                ) : null}
              </Stack>
            </Stack>

            <TenantTable
              tenants={tenants}
              loading={loading}
              pageSize={pageSize}
              onViewTenant={handleViewTenant}
              onExtendTrial={extendTrial}
              onToggleActive={toggleTenantActive}
              onEmailManagement={handleEmailManagement}
              onChangePlan={setChangePlanTenant}
              onOutreach={setOutreachTenant}
              onImpersonate={handleImpersonate}
            />

            {!loading && tenants.length > 0 ? (
              <JoyTablePagination
                page={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                disabled={loading}
                onPageChange={(nextPage) => {
                  goToPage(nextPage);
                  fetchTenants(currentSearch, currentStatus, nextPage);
                }}
                onPageSizeChange={(nextPageSize) => {
                  changePageSize(nextPageSize);
                  fetchTenants(currentSearch, currentStatus, 1, nextPageSize);
                }}
              />
            ) : null}
          </Stack>
        </Stack>
      </PageContainer>

      <TenantDrawer
        tenant={selectedTenant}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onExtendTrial={extendTrial}
        onToggleActive={toggleTenantActive}
        onChangePlan={setChangePlanTenant}
      />

      {changePlanTenant && (
        <ChangePlanModal
          open={!!changePlanTenant}
          onClose={() => setChangePlanTenant(null)}
          tenantId={changePlanTenant.tenant_id}
          tenantName={changePlanTenant.company_name || "Unnamed Company"}
          contactEmail={changePlanTenant.primary_contact_email}
          currentPlan={changePlanTenant.plan}
          onSuccess={handleRefresh}
        />
      )}

      {outreachTenant && (
        <TenantOutreachModal
          open={!!outreachTenant}
          onClose={() => setOutreachTenant(null)}
          tenantId={outreachTenant.tenant_id}
          companyName={outreachTenant.company_name || "Unnamed Company"}
          contactEmail={outreachTenant.primary_contact_email}
          contactFirstName={
            outreachTenant.primary_contact_name?.split(" ")[0] || ""
          }
        />
      )}
    </>
  );
};

export default AdminPage;
