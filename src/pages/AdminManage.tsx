import { useEffect, useMemo, useState } from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { AdminCSVImport } from "@/components/admin/AdminCSVImport";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Database,
  Mail,
  RefreshCw,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { format, isValid, subDays } from "date-fns";

type AdminManageTenant = {
  id: string;
  name: string | null;
  company_name?: string | null;
  created_at: string | null;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const getTenantLabel = (tenant: AdminManageTenant) =>
  tenant.company_name || tenant.name || "Unnamed Tenant";

const parseCreatedAt = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return isValid(date) ? date : null;
};

export default function AdminManage() {
  const navigate = useNavigate();
  const {
    isMasterAdmin,
    isLoading,
    activeTenantId,
    setActiveTenantId,
    availableTenants,
    refreshTenants,
  } = useAdmin();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [workspaceTab, setWorkspaceTab] = useState<"import" | "actions">(
    "import",
  );

  const tenants = availableTenants as AdminManageTenant[];
  const selectedTenant = tenants.find((tenant) => tenant.id === activeTenantId);

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tenants;
    }

    return tenants.filter((tenant) => {
      const label = getTenantLabel(tenant).toLowerCase();
      return label.includes(query) || tenant.id.toLowerCase().includes(query);
    });
  }, [search, tenants]);

  const recentTenantCount = useMemo(() => {
    const threshold = subDays(new Date(), 30);

    return tenants.filter((tenant) => {
      const createdAt = parseCreatedAt(tenant.created_at);
      return createdAt ? createdAt >= threshold : false;
    }).length;
  }, [tenants]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const pagedTenants = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return filteredTenants.slice(offset, offset + pageSize);
  }, [filteredTenants, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSelectTenant = (tenantId: string) => {
    setActiveTenantId(tenantId);
    setWorkspaceTab("import");
  };

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  if (isLoading) {
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
            Loading master admin workspace...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isMasterAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
      <Stack spacing={3}>
        <JoyCard
          sx={{
            borderColor: "warning.200",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-warning-mainChannel) / 0.14) 0%, #FFFFFF 58%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 100%)",
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
                  color="warning"
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
                  <Typography level="h2">Admin Manage</Typography>
                  <Typography level="body-sm" color="neutral">
                    Select a tenant context and run scoped admin operations
                    without leaving the dashboard shell.
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <JoyStatusChip
                      status={selectedTenant ? "active" : "inactive"}
                      tone={selectedTenant ? "success" : "neutral"}
                      label={
                        selectedTenant
                          ? `Managing ${getTenantLabel(selectedTenant)}`
                          : "No tenant selected"
                      }
                    />
                    <JoyStatusChip
                      status="workspace"
                      tone="info"
                      label={`${filteredTenants.length} visible tenants`}
                    />
                  </Stack>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <JoyButton
                  bloomVariant="outline"
                  onClick={() => void refreshTenants()}
                  startDecorator={<RefreshCw className="h-4 w-4" />}
                >
                  Refresh Tenants
                </JoyButton>
                {selectedTenant ? (
                  <JoyButton
                    bloomVariant="ghost"
                    onClick={() => setActiveTenantId(null)}
                  >
                    Clear Selection
                  </JoyButton>
                ) : null}
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <Grid container spacing={2}>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Users size={20} />}
              iconColor="neutral"
              label="Manageable tenants"
              value={tenants.length}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Building2 size={20} />}
              iconColor="primary"
              label="Filtered results"
              value={filteredTenants.length}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<CalendarDays size={20} />}
              iconColor="warning"
              label="Added in 30 days"
              value={recentTenantCount}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Settings2 size={20} />}
              iconColor="success"
              label="Active context"
              value={selectedTenant ? 1 : 0}
            />
          </Grid>
        </Grid>

        <JoyCard>
          <JoyCardHeader
            title="Tenant Context"
            description="Search the tenant roster, then select the workspace you want to operate on."
          />
          <JoyCardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <JoySearchInput
                  placeholder="Search by tenant name or ID..."
                  value={search}
                  onValueChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  sx={{ flex: 1, minWidth: { xs: "100%", md: 320 } }}
                />
                <JoyButton
                  bloomVariant="ghost"
                  onClick={clearSearch}
                  disabled={!search}
                >
                  Clear Search
                </JoyButton>
              </Stack>

              {filteredTenants.length === 0 ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ p: 4, borderRadius: "var(--joy-radius-xl)" }}
                >
                  <Stack spacing={0.75} alignItems="center">
                    <Building2 className="h-5 w-5" />
                    <Typography level="title-sm">
                      No tenants match the current search
                    </Typography>
                    <Typography
                      level="body-sm"
                      color="neutral"
                      textAlign="center"
                    >
                      Clear the search term or refresh the roster to restore the
                      full management list.
                    </Typography>
                  </Stack>
                </Sheet>
              ) : (
                <>
                  <JoyTable stickyHeader containerSx={{ minWidth: 860 }}>
                    <JoyTableHead>
                      <JoyTableRow>
                        <JoyTableHeaderCell>Tenant</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Tenant ID</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Created</JoyTableHeaderCell>
                        <JoyTableHeaderCell>Context</JoyTableHeaderCell>
                        <JoyTableHeaderCell align="right">
                          Actions
                        </JoyTableHeaderCell>
                      </JoyTableRow>
                    </JoyTableHead>
                    <JoyTableBody>
                      {pagedTenants.map((tenant) => {
                        const isSelected = tenant.id === activeTenantId;
                        const createdAt = parseCreatedAt(tenant.created_at);

                        return (
                          <JoyTableRow
                            key={tenant.id}
                            clickable
                            onClick={() => handleSelectTenant(tenant.id)}
                          >
                            <JoyTableCell>
                              <Stack spacing={0.35}>
                                <Typography
                                  level="body-sm"
                                  sx={{
                                    fontWeight: "var(--joy-fontWeight-lg)",
                                  }}
                                >
                                  {getTenantLabel(tenant)}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  Master-admin workspace target
                                </Typography>
                              </Stack>
                            </JoyTableCell>
                            <JoyTableCell sx={{ fontFamily: "monospace" }}>
                              {tenant.id}
                            </JoyTableCell>
                            <JoyTableCell>
                              {createdAt
                                ? format(createdAt, "MMM d, yyyy")
                                : "—"}
                            </JoyTableCell>
                            <JoyTableCell>
                              <JoyStatusChip
                                status={isSelected ? "selected" : "available"}
                                tone={isSelected ? "success" : "neutral"}
                                label={isSelected ? "Selected" : "Available"}
                              />
                            </JoyTableCell>
                            <JoyTableCell
                              sx={{ textAlign: "right" }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                justifyContent="flex-end"
                              >
                                <JoyButton
                                  size="sm"
                                  bloomVariant={
                                    isSelected ? "outline" : "default"
                                  }
                                  disabled={isSelected}
                                  onClick={() => handleSelectTenant(tenant.id)}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </JoyButton>
                                <JoyButton
                                  size="sm"
                                  bloomVariant="ghost"
                                  onClick={() =>
                                    navigate(
                                      `/admin/tenants/${tenant.id}/email`,
                                    )
                                  }
                                >
                                  Email
                                </JoyButton>
                              </Stack>
                            </JoyTableCell>
                          </JoyTableRow>
                        );
                      })}
                    </JoyTableBody>
                  </JoyTable>

                  <JoyTablePagination
                    page={page}
                    pageSize={pageSize}
                    totalCount={filteredTenants.length}
                    onPageChange={setPage}
                    onPageSizeChange={(nextPageSize) => {
                      setPageSize(
                        PAGE_SIZE_OPTIONS.includes(nextPageSize)
                          ? nextPageSize
                          : 10,
                      );
                      setPage(1);
                    }}
                  />
                </>
              )}
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {selectedTenant ? (
          <Tabs
            value={workspaceTab}
            onChange={(_event, value) =>
              setWorkspaceTab((value as "import" | "actions") ?? "import")
            }
          >
            <TabList
              sx={{
                borderRadius: "var(--joy-radius-lg)",
                backgroundColor: "neutral.50",
                p: 0.5,
                gap: 0.5,
              }}
            >
              <Tab disableIndicator value="import">
                Data Import
              </Tab>
              <Tab disableIndicator value="actions">
                Workspace Actions
              </Tab>
            </TabList>

            <TabPanel value="import" sx={{ px: 0, pt: 2.5 }}>
              <AdminCSVImport />
            </TabPanel>

            <TabPanel value="actions" sx={{ px: 0, pt: 2.5 }}>
              <Grid container spacing={2}>
                <Grid xs={12} md={4}>
                  <JoyCard sx={{ height: "100%" }}>
                    <JoyCardHeader
                      title="Email Management"
                      description="Open the tenant-specific email governance workspace for domains, suppression, and controls."
                      startDecorator={<Mail className="h-5 w-5" />}
                    />
                    <JoyCardContent>
                      <JoyButton
                        fullWidth
                        onClick={() =>
                          navigate(`/admin/tenants/${selectedTenant.id}/email`)
                        }
                        endDecorator={<ArrowRight className="h-4 w-4" />}
                      >
                        Open Email Workspace
                      </JoyButton>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
                <Grid xs={12} md={4}>
                  <JoyCard sx={{ height: "100%" }}>
                    <JoyCardHeader
                      title="Tenant Directory"
                      description="Return to the full tenant operations table for plan changes, outreach, impersonation, and trial controls."
                      startDecorator={<Users className="h-5 w-5" />}
                    />
                    <JoyCardContent>
                      <JoyButton
                        fullWidth
                        bloomVariant="outline"
                        onClick={() => navigate("/admin/tenants")}
                        endDecorator={<ArrowRight className="h-4 w-4" />}
                      >
                        Open Tenant Operations
                      </JoyButton>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
                <Grid xs={12} md={4}>
                  <JoyCard sx={{ height: "100%" }}>
                    <JoyCardHeader
                      title="Audit Trail"
                      description="Review internal governance and admin activity when a tenant change needs verification or rollback context."
                      startDecorator={<Database className="h-5 w-5" />}
                    />
                    <JoyCardContent>
                      <JoyButton
                        fullWidth
                        bloomVariant="outline"
                        onClick={() => navigate("/admin/audit-logs")}
                        endDecorator={<ArrowRight className="h-4 w-4" />}
                      >
                        Open Audit Logs
                      </JoyButton>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
              </Grid>
            </TabPanel>
          </Tabs>
        ) : (
          <JoyCard>
            <JoyCardHeader
              title="Management Workspace"
              description="Select a tenant above to unlock scoped import and operational tools."
            />
            <JoyCardContent>
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 4, borderRadius: "var(--joy-radius-xl)" }}
              >
                <Stack spacing={0.75} alignItems="center">
                  <Shield className="h-5 w-5" />
                  <Typography level="title-sm">
                    Tenant context required
                  </Typography>
                  <Typography
                    level="body-sm"
                    color="neutral"
                    textAlign="center"
                  >
                    Pick a tenant from the management table to enable CSV import
                    and tenant-specific admin actions.
                  </Typography>
                </Stack>
              </Sheet>
            </JoyCardContent>
          </JoyCard>
        )}
      </Stack>
    </PageContainer>
  );
}
