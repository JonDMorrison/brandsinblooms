import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Grid from "@mui/joy/Grid";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  FileText,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
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
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";

interface InternalAuditRow {
  id: string;
  tenant_id: string | null;
  company_name: string | null;
  actor_type: string;
  actor_id: string | null;
  actor_email: string | null;
  action_type: string;
  affected_table: string;
  affected_record_id: string | null;
  previous_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  automation_precedence_mode: string | null;
  expires_at: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

interface AuditListResponse {
  data: InternalAuditRow[];
  count: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 25;

function toPretty(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminAuditLogsPage() {
  const navigate = useNavigate();
  const { data: isSuperAdmin, isLoading: adminLoading } = useIsSuperAdmin();

  const [rows, setRows] = useState<InternalAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);

  const [tenantIdFilter, setTenantIdFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const totalPages = useMemo(() => {
    if (count <= 0) return 1;
    return Math.ceil(count / PAGE_SIZE);
  }, [count]);

  const activeFilterCount = useMemo(
    () =>
      [tenantIdFilter, actionFilter, fromFilter, toFilter].filter(Boolean)
        .length + (actorTypeFilter !== "all" ? 1 : 0),
    [actionFilter, actorTypeFilter, fromFilter, tenantIdFilter, toFilter],
  );

  const uniqueActorTypes = useMemo(
    () => new Set(rows.map((row) => row.actor_type)).size,
    [rows],
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = {
        p_tenant_id: tenantIdFilter.trim() || null,
        p_action_type: actionFilter.trim() || null,
        p_actor_type: actorTypeFilter === "all" ? null : actorTypeFilter,
        p_from: fromFilter ? new Date(fromFilter).toISOString() : null,
        p_to: toFilter ? new Date(toFilter).toISOString() : null,
        p_page: page,
        p_page_size: PAGE_SIZE,
      };

      const { data, error } = await (supabase as any).rpc(
        "admin_list_email_governance_internal_audit_log",
        params,
      );

      if (error) throw error;

      const response = (data ?? {
        data: [],
        count: 0,
        page,
        page_size: PAGE_SIZE,
      }) as AuditListResponse;

      setRows(Array.isArray(response.data) ? response.data : []);
      setCount(Number(response.count ?? 0));
    } catch (error) {
      console.error("Failed to load internal governance audit logs", error);
      setRows([]);
      setCount(0);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load internal governance audit logs",
      );
    } finally {
      setLoading(false);
    }
  }, [
    actionFilter,
    actorTypeFilter,
    fromFilter,
    page,
    tenantIdFilter,
    toFilter,
  ]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchLogs();
    }
  }, [fetchLogs, isSuperAdmin]);

  const clearFilters = () => {
    setTenantIdFilter("");
    setActionFilter("");
    setActorTypeFilter("all");
    setFromFilter("");
    setToFilter("");
    setPage(0);
  };

  if (adminLoading) {
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
            Loading audit logs...
          </Typography>
        </Stack>
      </PageContainer>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageContainer fullWidth sx={{ px: 0, py: 0 }}>
      <Stack spacing={3}>
        <JoyCard
          sx={{
            borderColor: "primary.200",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-primary-mainChannel) / 0.12) 0%, #FFFFFF 58%, rgba(var(--joy-palette-warning-mainChannel) / 0.1) 100%)",
          }}
        >
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              alignItems={{ xs: "flex-start", lg: "center" }}
              justifyContent="space-between"
              spacing={2}
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
                  <FileText className="h-6 w-6" />
                </Sheet>
                <Stack spacing={0.75}>
                  <Typography level="h2">Governance Audit Logs</Typography>
                  <Typography level="body-sm" color="neutral">
                    Internal forensic trail for super-admin actions, automation
                    precedence changes, and governance override updates.
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <JoyStatusChip
                      status={activeFilterCount > 0 ? "filtered" : "all"}
                      tone={activeFilterCount > 0 ? "info" : "neutral"}
                      label={
                        activeFilterCount > 0
                          ? `${activeFilterCount} active filters`
                          : "No filters"
                      }
                    />
                    <JoyStatusChip
                      status="page"
                      tone="neutral"
                      label={`Page ${page + 1} of ${totalPages}`}
                    />
                  </Stack>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <JoyButton
                  bloomVariant="outline"
                  onClick={() => navigate("/admin")}
                  startDecorator={<ArrowLeft className="h-4 w-4" />}
                >
                  Back
                </JoyButton>
                <JoyButton
                  bloomVariant="outline"
                  onClick={() => void fetchLogs()}
                  disabled={loading}
                  loading={loading}
                  loadingPosition="start"
                  startDecorator={<RefreshCw className="h-4 w-4" />}
                >
                  Refresh
                </JoyButton>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        <Grid container spacing={2}>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<FileText size={20} />}
              iconColor="neutral"
              label="Matched events"
              value={count}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Clock3 size={20} />}
              iconColor="primary"
              label="Rows on page"
              value={rows.length}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Shield size={20} />}
              iconColor="warning"
              label="Actor types"
              value={uniqueActorTypes}
            />
          </Grid>
          <Grid xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={<Search size={20} />}
              iconColor="success"
              label="Active filters"
              value={activeFilterCount}
            />
          </Grid>
        </Grid>

        <JoyCard>
          <JoyCardHeader
            title="Filters"
            description="Filter by tenant, action type, actor, and time range. Results refresh automatically as filters change."
          />
          <JoyCardContent>
            <Grid container spacing={2}>
              <Grid xs={12} md={4} lg={2}>
                <JoyInput
                  id="tenant-filter"
                  label="Tenant ID"
                  value={tenantIdFilter}
                  onChange={(event) => {
                    setPage(0);
                    setTenantIdFilter(event.target.value);
                  }}
                  placeholder="Optional UUID"
                />
              </Grid>
              <Grid xs={12} md={8} lg={4}>
                <JoySearchInput
                  value={actionFilter}
                  placeholder="Search action type or affected table..."
                  onValueChange={(value) => {
                    setPage(0);
                    setActionFilter(value);
                  }}
                />
              </Grid>
              <Grid xs={12} md={4} lg={2}>
                <JoySelect
                  id="actor-filter"
                  label="Actor Type"
                  value={actorTypeFilter}
                  onValueChange={(value) => {
                    setPage(0);
                    setActorTypeFilter(value);
                  }}
                  options={[
                    { value: "all", label: "All" },
                    { value: "admin", label: "Admin" },
                    { value: "system", label: "System" },
                    { value: "automation", label: "Automation" },
                    { value: "service", label: "Service" },
                    { value: "unknown", label: "Unknown" },
                  ]}
                />
              </Grid>
              <Grid xs={12} md={6} lg={2}>
                <JoyInput
                  id="from-filter"
                  label="From"
                  type="datetime-local"
                  value={fromFilter}
                  onChange={(event) => {
                    setPage(0);
                    setFromFilter(event.target.value);
                  }}
                />
              </Grid>
              <Grid xs={12} md={6} lg={2}>
                <JoyInput
                  id="to-filter"
                  label="To"
                  type="datetime-local"
                  value={toFilter}
                  onChange={(event) => {
                    setPage(0);
                    setToFilter(event.target.value);
                  }}
                />
              </Grid>
              <Grid xs={12} lg={2}>
                <Stack
                  direction={{ xs: "column", sm: "row", lg: "column" }}
                  justifyContent="flex-end"
                  spacing={1}
                  sx={{ height: "100%" }}
                >
                  <JoyButton
                    onClick={() => void fetchLogs()}
                    disabled={loading}
                    fullWidth
                  >
                    Apply
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                    fullWidth
                  >
                    Clear
                  </JoyButton>
                </Stack>
              </Grid>
            </Grid>
          </JoyCardContent>
        </JoyCard>

        {errorMessage ? (
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
                      Failed to load audit events
                    </Typography>
                    <Typography level="body-sm" color="danger">
                      {errorMessage}
                    </Typography>
                  </Stack>
                </Stack>
                <JoyButton
                  bloomVariant="outline"
                  color="danger"
                  onClick={() => void fetchLogs()}
                >
                  Retry
                </JoyButton>
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        <JoyCard>
          <JoyCardHeader
            title="Events"
            description={`Showing ${rows.length} records on page ${page + 1} out of ${count} matched events.`}
          />
          <JoyCardContent>
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "var(--joy-radius-lg)" }}
            >
              <JoyTable stickyHeader containerSx={{ minWidth: 1860 }}>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell>Occurred</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Action</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Tenant</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Actor</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Precedence</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Expires</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Reason</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Previous</JoyTableHeaderCell>
                    <JoyTableHeaderCell>New</JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <JoyTableRow key={index}>
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <JoyTableCell key={cellIndex}>
                            <Skeleton sx={{ height: 20, width: "100%" }} />
                          </JoyTableCell>
                        ))}
                      </JoyTableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={9} sx={{ py: 5 }}>
                        <Stack spacing={0.75} alignItems="center">
                          <FileText
                            className="h-5 w-5"
                            style={{ color: "var(--joy-palette-neutral-400)" }}
                          />
                          <Typography level="title-sm">
                            No audit logs found
                          </Typography>
                          <Typography
                            level="body-sm"
                            color="neutral"
                            textAlign="center"
                          >
                            Try broadening the current filters or refreshing the
                            log query.
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : (
                    rows.map((row) => (
                      <JoyTableRow key={row.id}>
                        <JoyTableCell sx={{ whiteSpace: "nowrap" }}>
                          {formatDateTime(row.occurred_at)}
                        </JoyTableCell>
                        <JoyTableCell sx={{ minWidth: 220 }}>
                          <Stack spacing={0.35}>
                            <Typography
                              sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                            >
                              {row.action_type}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {row.affected_table}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {row.affected_record_id ?? "—"}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell sx={{ minWidth: 220 }}>
                          <Stack spacing={0.35}>
                            <Typography
                              sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                            >
                              {row.company_name ?? "—"}
                            </Typography>
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {row.tenant_id ?? "global"}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell sx={{ minWidth: 220 }}>
                          <Stack spacing={0.35}>
                            <JoyStatusChip status={row.actor_type} />
                            <Typography level="body-xs" color="neutral">
                              {row.actor_email ?? "—"}
                            </Typography>
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {row.actor_id ?? "—"}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell>
                          {row.automation_precedence_mode ? (
                            <JoyStatusChip
                              status={row.automation_precedence_mode}
                            />
                          ) : (
                            "—"
                          )}
                        </JoyTableCell>
                        <JoyTableCell sx={{ whiteSpace: "nowrap" }}>
                          {formatDateTime(row.expires_at)}
                        </JoyTableCell>
                        <JoyTableCell sx={{ maxWidth: 280 }}>
                          {row.reason ?? "—"}
                        </JoyTableCell>
                        <JoyTableCell
                          sx={{ minWidth: 260, verticalAlign: "top" }}
                        >
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              maxHeight: 160,
                              overflow: "auto",
                              borderRadius: "var(--joy-radius-md)",
                              backgroundColor: "neutral.100",
                              p: 1.5,
                              fontSize: "var(--joy-fontSize-xs)",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {toPretty(row.previous_value)}
                          </Box>
                        </JoyTableCell>
                        <JoyTableCell
                          sx={{ minWidth: 260, verticalAlign: "top" }}
                        >
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              maxHeight: 160,
                              overflow: "auto",
                              borderRadius: "var(--joy-radius-md)",
                              backgroundColor: "neutral.100",
                              p: 1.5,
                              fontSize: "var(--joy-fontSize-xs)",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, monospace",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {toPretty(row.new_value)}
                          </Box>
                        </JoyTableCell>
                      </JoyTableRow>
                    ))
                  )}
                </JoyTableBody>
              </JoyTable>
            </Sheet>

            <JoyTablePagination
              page={page}
              pageIndexBase={0}
              pageSize={PAGE_SIZE}
              totalCount={count}
              disabled={loading}
              showPageSizeSelector={false}
              onPageChange={setPage}
              sx={{ mt: 2 }}
            />
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
}
