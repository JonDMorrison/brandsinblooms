import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
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

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Governance Audit Logs</h1>
            <p className="text-sm text-muted-foreground">
              Internal forensic trail for super-admin and automation governance
              actions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter by tenant, action, actor type, and time range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="tenant-filter">Tenant ID</Label>
              <Input
                id="tenant-filter"
                value={tenantIdFilter}
                onChange={(event) => {
                  setPage(0);
                  setTenantIdFilter(event.target.value);
                }}
                placeholder="Optional UUID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-filter">Action</Label>
              <Input
                id="action-filter"
                value={actionFilter}
                onChange={(event) => {
                  setPage(0);
                  setActionFilter(event.target.value);
                }}
                placeholder="Contains text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor-filter">Actor Type</Label>
              <select
                id="actor-filter"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={actorTypeFilter}
                onChange={(event) => {
                  setPage(0);
                  setActorTypeFilter(event.target.value);
                }}
              >
                <option value="all">All</option>
                <option value="admin">Admin</option>
                <option value="system">System</option>
                <option value="automation">Automation</option>
                <option value="service">Service</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-filter">From</Label>
              <Input
                id="from-filter"
                type="datetime-local"
                value={fromFilter}
                onChange={(event) => {
                  setPage(0);
                  setFromFilter(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-filter">To</Label>
              <Input
                id="to-filter"
                type="datetime-local"
                value={toFilter}
                onChange={(event) => {
                  setPage(0);
                  setToFilter(event.target.value);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchLogs} disabled={loading} className="w-full">
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Showing {rows.length} of {count} events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Occurred</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Precedence</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Previous</TableHead>
                  <TableHead>New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground"
                    >
                      {loading
                        ? "Loading logs..."
                        : "No audit logs found for current filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(row.occurred_at)}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">{row.action_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.affected_table}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.affected_record_id ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">
                          {row.company_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          {row.tenant_id ?? "global"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium capitalize">
                          {row.actor_type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.actor_email ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          {row.actor_id ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.automation_precedence_mode ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(row.expires_at)}
                      </TableCell>
                      <TableCell className="max-w-[280px] break-words">
                        {row.reason ?? "—"}
                      </TableCell>
                      <TableCell className="min-w-[260px] align-top">
                        <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                          {toPretty(row.previous_value)}
                        </pre>
                      </TableCell>
                      <TableCell className="min-w-[260px] align-top">
                        <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                          {toPretty(row.new_value)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
