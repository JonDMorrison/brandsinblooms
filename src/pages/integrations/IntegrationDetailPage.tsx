import { useDeferredValue, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  FlaskConical,
  Globe,
  MailPlus,
  MapPin,
  PlugZap,
  RefreshCcw,
  Receipt,
  ShieldAlert,
  Store,
  Users,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import { CRMMetricCard } from "@/components/crm/CRMMetricCard";
import type {
  IntegrationDetailRow,
  IntegrationDetailTimelineEntry,
  IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActionDropdown } from "@/components/ui/action-dropdown";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type LightspeedCustomerSortField,
  type LightspeedCustomerTableRow,
  type LightspeedPagination,
  type LightspeedProductsSortField,
  type LightspeedProductTableRow,
  type LightspeedSalesSortField,
  type LightspeedSortDirection,
  type LightspeedSyncLogRow,
  useIntegrationDetailData,
} from "@/hooks/useIntegrationDetailData";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/NotFound";

const REQUEST_INTEGRATION_MAILTO =
  "mailto:support@bloomsuite.app?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A";

function formatRelativeTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "Not available";
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Not available";
  }
}

function formatExactTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }

  try {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

function formatRate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatInfrastructureHealthTone(
  status: "healthy" | "warning" | "error" | "neutral",
): IntegrationDetailTone {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

function formatInfrastructureTrendLabel(trend: "up" | "down" | "flat" | null) {
  switch (trend) {
    case "up":
      return "Improving";
    case "down":
      return "Declining";
    case "flat":
      return "Stable";
    default:
      return "Trend unavailable";
  }
}

function getToneClasses(tone: IntegrationDetailTone) {
  switch (tone) {
    case "success":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: "text-emerald-700",
        iconWrap: "border-emerald-200 bg-emerald-50/80",
        dot: "bg-emerald-500",
      };
    case "warning":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        icon: "text-amber-700",
        iconWrap: "border-amber-200 bg-amber-50/80",
        dot: "bg-amber-500",
      };
    case "danger":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        icon: "text-rose-700",
        iconWrap: "border-rose-200 bg-rose-50/80",
        dot: "bg-rose-500",
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        icon: "text-slate-700",
        iconWrap: "border-slate-200 bg-slate-50/90",
        dot: "bg-slate-400",
      };
  }
}

function DetailStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: IntegrationDetailTone;
}) {
  const classes = getToneClasses(tone);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        classes.badge,
      )}
    >
      {label}
    </span>
  );
}

function DetailHealthRows({ rows }: { rows: IntegrationDetailRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const classes = getToneClasses(row.tone ?? "neutral");
        const timestampLabel = row.timestamp
          ? formatRelativeTimestamp(row.timestamp)
          : null;
        const exactLabel = row.timestamp
          ? formatExactTimestamp(row.timestamp)
          : null;

        return (
          <div
            key={`${row.label}-${row.value}-${row.timestamp ?? "none"}`}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-white/70 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {row.label}
              </div>
              {row.tooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mt-1 cursor-help truncate text-xs text-muted-foreground">
                      {row.tooltip}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs leading-5">
                    {row.tooltip}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <div className="min-w-0 text-right">
              <div className={cn("text-sm font-semibold", classes.icon)}>
                {timestampLabel ?? row.value}
              </div>
              {exactLabel ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {exactLabel}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailTimeline({
  entries,
}: {
  entries: IntegrationDetailTimelineEntry[];
}) {
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const classes = getToneClasses(entry.tone);
        const exactTimestamp = formatExactTimestamp(entry.timestamp);

        return (
          <div key={entry.key} className="flex gap-4">
            <div className="flex w-5 flex-col items-center">
              <span
                className={cn("mt-1 h-2.5 w-2.5 rounded-full", classes.dot)}
              />
              {index < entries.length - 1 ? (
                <span className="mt-2 h-full min-h-8 w-px bg-border/80" />
              ) : null}
            </div>
            <div className="pb-4">
              <div className="text-sm font-semibold text-foreground">
                {entry.label}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {entry.timestamp
                  ? formatRelativeTimestamp(entry.timestamp)
                  : "Waiting for provider data"}
              </div>
              {exactTimestamp ? (
                <div className="mt-1 text-xs text-muted-foreground/80">
                  {exactTimestamp}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function formatLightspeedSyncTypeLabel(
  syncType: "customers" | "sales" | "products" | "full",
) {
  switch (syncType) {
    case "customers":
      return "Customers";
    case "sales":
      return "Sales";
    case "products":
      return "Products";
    default:
      return "Full Sync";
  }
}

function formatLightspeedSyncStatus(jobStatus: string, isStale: boolean) {
  if (isStale) {
    return {
      label: "Stalled",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  switch (jobStatus) {
    case "completed":
      return {
        label: "Completed",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
    case "delayed":
      return {
        label: "Delayed",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "in_progress":
      return {
        label: "Syncing",
        className: "border-brand-teal/20 bg-brand-teal/10 text-brand-teal",
      };
    default:
      return {
        label: "Queued",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
  }
}

function LightspeedSyncProgressPanel({
  jobs,
  syncState,
  hasStaleJobs,
}: {
  jobs: Array<{
    id: string;
    normalizedSyncType: "customers" | "sales" | "products" | "full";
    status: string;
    progressPercent: number;
    progress_message: string | null;
    last_progress_at: string | null;
    current_page: number;
    total_pages_est: number | null;
    fetched_rows: number;
    inserted_rows: number;
    skipped_rows: number;
    failed_rows: number;
    isStale: boolean;
  }>;
  syncState: "idle" | "triggering" | "syncing";
  hasStaleJobs: boolean;
}) {
  const activeJobs = jobs.filter(
    (job) =>
      job.status !== "completed" &&
      job.status !== "failed" &&
      job.status !== "cancelled",
  );
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter(
    (job) => job.status === "failed" || job.status === "cancelled",
  );
  const totalInsertedRows = jobs.reduce(
    (sum, job) => sum + (job.inserted_rows ?? 0),
    0,
  );
  const aggregateProgress = jobs.length
    ? Math.round(
        jobs.reduce((sum, job) => sum + job.progressPercent, 0) / jobs.length,
      )
    : syncState === "triggering"
      ? 5
      : 0;

  return (
    <SectionCard
      title="Sync Progress"
      description="Live queue progress for the current Lightspeed sync jobs."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">
              {syncState === "triggering"
                ? "Creating Lightspeed sync jobs..."
                : activeJobs.length > 0
                  ? `${activeJobs.length} active sync ${activeJobs.length === 1 ? "job" : "jobs"}`
                  : jobs.length > 0
                    ? "Latest Lightspeed sync summary"
                    : "No active Lightspeed sync jobs"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {syncState === "triggering"
                ? "Queue records are being created now."
                : jobs.length > 0
                  ? `${completedJobs.length} completed, ${failedJobs.length} failed, ${totalInsertedRows.toLocaleString()} rows inserted.`
                  : "Trigger a manual sync to watch per-job progress here."}
            </div>
          </div>
          <div className="min-w-[12rem]">
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <span>Overall progress</span>
              <span>{aggregateProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-teal transition-all duration-300"
                style={{ width: `${aggregateProgress}%` }}
              />
            </div>
          </div>
        </div>

        {hasStaleJobs ? (
          <div className="flex items-start gap-3 rounded-[1.15rem] border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Progress looks stale</div>
              <p className="mt-1 leading-6 text-amber-800/90">
                One or more Lightspeed jobs have not reported progress for over
                five minutes.
              </p>
            </div>
          </div>
        ) : null}

        {jobs.length > 0 ? (
          <div className="space-y-3">
            {jobs.map((job) => {
              const status = formatLightspeedSyncStatus(
                job.status,
                job.isStale,
              );

              return (
                <div
                  key={job.id}
                  className="rounded-[1.25rem] border border-border/70 bg-white/90 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">
                        {formatLightspeedSyncTypeLabel(job.normalizedSyncType)}{" "}
                        sync
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {job.progress_message ||
                          "Waiting for the next worker update."}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      <span>
                        {job.total_pages_est
                          ? `Page ${Math.max(job.current_page, 0)} of ${job.total_pages_est}`
                          : `Page ${Math.max(job.current_page, 0)}`}
                      </span>
                      <span>{job.progressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          job.status === "failed" || job.status === "cancelled"
                            ? "bg-rose-500"
                            : job.isStale
                              ? "bg-amber-500"
                              : "bg-brand-teal",
                        )}
                        style={{ width: `${job.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border/60 bg-slate-50/80 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Fetched
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCount(job.fetched_rows)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-slate-50/80 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Inserted
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCount(job.inserted_rows)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-slate-50/80 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Skipped
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCount(job.skipped_rows)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-slate-50/80 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Failed
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCount(job.failed_rows)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>
                      Last progress{" "}
                      {formatRelativeTimestamp(job.last_progress_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function MetricAppearance({ tone }: { tone: IntegrationDetailTone }) {
  const classes = getToneClasses(tone);
  return {
    iconClassName: classes.icon,
    iconWrapClassName: classes.iconWrap,
  };
}

function ComingSoonCard({
  title,
  description,
  capabilities,
  availabilityLabel,
  previewCallout,
  notifyEmail,
  isSubmitted,
  isSubmitting,
  onSubmit,
  requestPath,
}: {
  title: string;
  description: string;
  capabilities: string[];
  availabilityLabel: string;
  previewCallout?: {
    title: string;
    description: string;
  };
  notifyEmail: string | null;
  isSubmitted: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  requestPath: string;
}) {
  return (
    <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {availabilityLabel}
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      {previewCallout ? (
        <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
          <div className="font-semibold">{previewCallout.title}</div>
          <p className="mt-1 leading-6 text-amber-800/90">
            {previewCallout.description}
          </p>
        </div>
      ) : null}

      <div className="mt-8 rounded-[1.5rem] border border-border/70 bg-slate-50/70 p-5 sm:p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">
          Planned capabilities
        </div>
        <div className="mt-4 space-y-3">
          {capabilities.map((capability) => (
            <div
              key={capability}
              className="flex items-start gap-3 text-sm text-slate-700"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span className="leading-6">{capability}</span>
            </div>
          ))}
        </div>

        <Separator className="my-6 bg-border/80" />

        {!isSubmitted ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Notify me when access opens
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                We'll send the first rollout update to your signed-in account
                email.
              </p>
            </div>
            <Input
              type="email"
              value={notifyEmail ?? ""}
              readOnly
              aria-label="Notification email"
              placeholder="Sign in to request updates"
              className="bg-white"
              disabled={!notifyEmail || isSubmitting}
            />
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!notifyEmail || isSubmitting}
            >
              {isSubmitting ? "Saving request..." : "Notify me"}
            </Button>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-900">
            <div className="font-semibold">You're on the list</div>
            <p className="mt-1 leading-6 text-emerald-800/90">
              We'll send rollout updates to{" "}
              {notifyEmail ?? "your account email"} when access opens.
            </p>
          </div>
        )}

        <div className="mt-5 text-center">
          <a
            href={requestPath}
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
          >
            Request this integration →
          </a>
        </div>
      </div>
    </section>
  );
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString();
}

function formatEnvironmentLabel(environment?: string | null) {
  if (!environment) {
    return "Environment pending";
  }

  return environment
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatTokenType(tokenType?: string | null) {
  if (!tokenType) {
    return "Not available";
  }

  return tokenType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatRegionLabel(region?: string | null) {
  if (!region) {
    return "Not available";
  }

  return region.toUpperCase();
}

function formatTimestampOrFallback(
  timestamp?: string | null,
  fallback = "Not available",
) {
  if (!timestamp) {
    return fallback;
  }

  return formatExactTimestamp(timestamp) ?? fallback;
}

function formatRelativePlusAbsolute(
  timestamp?: string | null,
  fallback = "Never",
) {
  if (!timestamp) {
    return {
      value: fallback,
      description: undefined,
    };
  }

  return {
    value: formatRelativeTimestamp(timestamp),
    description: formatExactTimestamp(timestamp) ?? undefined,
  };
}

function formatLightspeedWebhookMode(
  mode?: "real-time" | "sync-only" | "unavailable" | null,
) {
  if (mode === "real-time") {
    return {
      label: "Real-time",
      subtitle: "Webhook delivery is active for this account",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (mode === "unavailable") {
    return {
      label: "Unavailable",
      subtitle: "Webhook API is not available for this Lightspeed account",
      tone: "neutral" as const,
      valueClassName: "text-slate-600",
    };
  }

  return {
    label: "Sync only",
    subtitle: "Connected without verified real-time webhook delivery",
    tone: "warning" as const,
    valueClassName: "text-amber-600",
  };
}

function formatMetaAuthorizationState(
  status?: "authorized" | "expired" | "not-connected" | null,
) {
  if (status === "authorized") {
    return {
      label: "Authorized",
      subtitle: "Meta authorization is active for connected assets",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (status === "expired") {
    return {
      label: "Expired",
      subtitle: "Stored assets need Meta reauthorization before publishing",
      tone: "warning" as const,
      valueClassName: "text-amber-600",
    };
  }

  return {
    label: "Not connected",
    subtitle: "Authorize Meta to connect Facebook and Instagram assets",
    tone: "neutral" as const,
    valueClassName: "text-slate-600",
  };
}

function formatGa4ConnectionState(
  status?:
    | "connected"
    | "authorizing"
    | "error"
    | "not-connected"
    | string
    | null,
) {
  if (status === "connected") {
    return {
      label: "Connected",
      subtitle: "Property access is active for website reporting",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  if (status === "error") {
    return {
      label: "Attention needed",
      subtitle: "Stored settings exist, but the connection needs review",
      tone: "warning" as const,
      valueClassName: "text-amber-600",
    };
  }

  if (status === "authorizing") {
    return {
      label: "Authorizing",
      subtitle: "Authorization is in progress",
      tone: "neutral" as const,
      valueClassName: "text-slate-600",
    };
  }

  return {
    label: "Not connected",
    subtitle:
      "Add a property ID on the Website integrations page to connect GA4",
    tone: "neutral" as const,
    valueClassName: "text-slate-600",
  };
}

function formatMarketingImportState(status?: string | null) {
  if (status === "connected") {
    return {
      label: "Connected",
      subtitle: "Ready for one-time imports",
      tone: "success" as const,
      valueClassName: "text-emerald-600",
    };
  }

  return {
    label: "Not connected",
    subtitle: "Connect this provider to preview lists and import contacts",
    tone: "neutral" as const,
    valueClassName: "text-slate-600",
  };
}

function KeyValueGrid({
  entries,
}: {
  entries: Array<{ label: string; value: string; description?: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <div
          key={`${entry.label}-${entry.value}`}
          className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {entry.label}
          </div>
          <div className="mt-2 break-words text-sm font-semibold text-slate-950">
            {entry.value}
          </div>
          {entry.description ? (
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {entry.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DetailFieldRows({
  rows,
  onCopy,
}: {
  rows: Array<{
    label: string;
    value: React.ReactNode;
    description?: React.ReactNode;
    tone?: IntegrationDetailTone;
    valueClassName?: string;
    copyValue?: string | null;
    copyLabel?: string;
  }>;
  onCopy?: (value: string | null | undefined, label: string) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const classes = row.tone ? getToneClasses(row.tone) : null;

        return (
          <div
            key={row.label}
            className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {row.label}
                </div>
                <div className="mt-2 flex items-start gap-2">
                  {classes ? (
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        classes.dot,
                      )}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 break-words text-sm font-semibold text-slate-950",
                      classes?.icon,
                      row.valueClassName,
                    )}
                  >
                    {row.value}
                  </div>
                </div>
                {row.description ? (
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {row.description}
                  </div>
                ) : null}
              </div>
              {row.copyValue && onCopy && row.copyLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCopy(row.copyValue, row.copyLabel!)}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type LightspeedTabValue =
  | "overview"
  | "customers"
  | "sales"
  | "products"
  | "sync-logs";

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateValue(
  timestamp?: string | null,
  fallback = "Not available",
) {
  if (!timestamp) {
    return fallback;
  }

  return formatExactTimestamp(timestamp) ?? fallback;
}

function formatJsonValue(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function getNextSortDirection(
  currentField: string,
  nextField: string,
  currentDirection: LightspeedSortDirection,
): LightspeedSortDirection {
  if (currentField !== nextField) {
    return "asc";
  }

  return currentDirection === "asc" ? "desc" : "asc";
}

function getSortLabel(
  activeField: string,
  field: string,
  direction: LightspeedSortDirection,
) {
  if (activeField !== field) {
    return null;
  }

  return direction === "asc" ? "asc" : "desc";
}

function LightspeedTableEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/80 p-6 text-sm text-muted-foreground">
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-2 leading-6">{description}</p>
    </div>
  );
}

function LightspeedPaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: LightspeedPagination;
  onPageChange: (page: number) => void;
}) {
  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.page < pagination.totalPages;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} ·{" "}
        {formatCount(pagination.totalCount)} total rows
      </div>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={!canGoPrevious}
              className={cn(!canGoPrevious && "pointer-events-none opacity-50")}
              onClick={(event) => {
                event.preventDefault();
                if (canGoPrevious) {
                  onPageChange(pagination.page - 1);
                }
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!canGoNext}
              className={cn(!canGoNext && "pointer-events-none opacity-50")}
              onClick={(event) => {
                event.preventDefault();
                if (canGoNext) {
                  onPageChange(pagination.page + 1);
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function LightspeedJsonCollapsible({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <Collapsible className="rounded-2xl border border-border/70 bg-slate-50/80">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-950">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/70 px-4 py-4">
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {formatJsonValue(value)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LightspeedSortButton({
  label,
  field,
  activeField,
  direction,
  onToggle,
}: {
  label: string;
  field: string;
  activeField: string;
  direction: LightspeedSortDirection;
  onToggle: (field: string) => void;
}) {
  const sortLabel = getSortLabel(activeField, field, direction);

  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className="inline-flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-slate-950"
    >
      <span>{label}</span>
      {sortLabel ? (
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-slate-700">
          {sortLabel}
        </span>
      ) : null}
    </button>
  );
}

function LightspeedCustomerQualityBadges({
  customer,
}: {
  customer: LightspeedCustomerTableRow;
}) {
  const badges = [
    customer.quality.missingEmail
      ? {
          label: "Missing email",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : null,
    customer.quality.missingPhone
      ? {
          label: "Missing phone",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : null,
    customer.quality.zeroPurchaseCount
      ? {
          label: "No purchases",
          className: "border-slate-200 bg-slate-50 text-slate-700",
        }
      : null,
    customer.quality.staleSync
      ? {
          label: "Stale sync",
          className: "border-rose-200 bg-rose-50 text-rose-700",
        }
      : null,
    customer.quality.missingCrmLink
      ? {
          label: "No CRM link",
          className: "border-slate-200 bg-slate-50 text-slate-700",
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; className: string }>;

  if (badges.length === 0) {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
        Healthy
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge key={badge.label} className={badge.className}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function LightspeedProductStockBadge({
  product,
}: {
  product: LightspeedProductTableRow;
}) {
  const config =
    product.stockState === "out"
      ? {
          label: "Out of stock",
          className: "border-rose-200 bg-rose-50 text-rose-700",
        }
      : product.stockState === "low"
        ? {
            label: "Low stock",
            className: "border-amber-200 bg-amber-50 text-amber-700",
          }
        : product.stockState === "healthy"
          ? {
              label: "In stock",
              className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            }
          : {
              label: "Unknown",
              className: "border-slate-200 bg-slate-50 text-slate-700",
            };

  return <Badge className={config.className}>{config.label}</Badge>;
}

function MetaAssetList({
  assets,
  emptyMessage,
  onCopy,
  onOpen,
}: {
  assets: Array<{
    id: string;
    name: string;
    externalId: string | null;
    secondaryLabel: string;
    connectedAt: string | null;
    lastActivityAt: string | null;
  }>;
  emptyMessage: string;
  onCopy: (value: string | null | undefined, label: string) => void;
  onOpen: () => void;
}) {
  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex items-center gap-3 rounded-2xl border border-border/70 bg-slate-50/70 p-3 transition-colors hover:border-slate-300 hover:bg-white"
        >
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <div className="text-sm font-semibold text-slate-950">
              {asset.name}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {asset.secondaryLabel}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {asset.lastActivityAt
                ? `Last refreshed ${formatRelativeTimestamp(asset.lastActivityAt)}`
                : asset.connectedAt
                  ? `Connected ${formatRelativeTimestamp(asset.connectedAt)}`
                  : "Stored asset"}
            </div>
          </button>
          {asset.externalId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCopy(asset.externalId, "Asset ID")}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
              Copy ID
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="h-10 w-80 animate-pulse rounded-full bg-slate-100" />
      <div className="rounded-[1.75rem] border border-border/70 bg-white/90 p-6 shadow-sm shadow-brand-navy/5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-10 w-72 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-5 w-96 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-[1.5rem] bg-slate-100"
            />
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-[1.5rem] bg-slate-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [lightspeedTab, setLightspeedTab] =
    useState<LightspeedTabValue>("overview");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSortField, setCustomerSortField] =
    useState<LightspeedCustomerSortField>("last_purchase_date");
  const [customerSortDirection, setCustomerSortDirection] =
    useState<LightspeedSortDirection>("desc");
  const [selectedCustomer, setSelectedCustomer] =
    useState<LightspeedCustomerTableRow | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatus, setSalesStatus] = useState("all");
  const [salesStartDate, setSalesStartDate] = useState("");
  const [salesEndDate, setSalesEndDate] = useState("");
  const [salesSortField, setSalesSortField] =
    useState<LightspeedSalesSortField>("sale_date");
  const [salesSortDirection, setSalesSortDirection] =
    useState<LightspeedSortDirection>("desc");
  const [selectedSale, setSelectedSale] = useState<
    | NonNullable<
        ReturnType<typeof useIntegrationDetailData>["lightspeedDashboard"]
      >["sales"]["rows"][number]
    | null
  >(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsCategory, setProductsCategory] = useState("all");
  const [productsInStockOnly, setProductsInStockOnly] = useState(false);
  const [productsSortField, setProductsSortField] =
    useState<LightspeedProductsSortField>("name");
  const [productsSortDirection, setProductsSortDirection] =
    useState<LightspeedSortDirection>("asc");
  const [syncLogsPage, setSyncLogsPage] = useState(1);
  const [expandedSyncLogId, setExpandedSyncLogId] = useState<string | null>(
    null,
  );
  const deferredCustomerSearch = useDeferredValue(customerSearchInput.trim());
  const detail = useIntegrationDetailData(
    slug,
    slug === "lightspeed"
      ? {
          customers: {
            page: customerPage,
            search: deferredCustomerSearch,
            sortField: customerSortField,
            sortDirection: customerSortDirection,
          },
          sales: {
            page: salesPage,
            status: salesStatus,
            startDate: salesStartDate || null,
            endDate: salesEndDate || null,
            sortField: salesSortField,
            sortDirection: salesSortDirection,
          },
          products: {
            page: productsPage,
            category: productsCategory,
            inStockOnly: productsInStockOnly,
            sortField: productsSortField,
            sortDirection: productsSortDirection,
          },
          syncLogs: {
            page: syncLogsPage,
          },
        }
      : undefined,
  );

  const seed = useMemo(() => (slug ? getIntegrationSeed(slug) : null), [slug]);

  if (!seed || !detail.isValidSlug || !detail.item || !detail.model) {
    return <NotFound />;
  }

  if (detail.isLoading) {
    return <LoadingShell />;
  }

  const item = detail.item;
  const model = detail.model;
  const Icon = item.icon;
  const isSquare = item.slug === "square";
  const isClover = item.slug === "clover";
  const isLightspeed = item.slug === "lightspeed";
  const isMeta = item.slug === "meta";
  const isGa4 = item.slug === "google-analytics-4";
  const isEmailInfrastructure = item.slug === "email-infrastructure";
  const isMarketingImport =
    item.slug === "mailchimp" ||
    item.slug === "klaviyo" ||
    item.slug === "constant-contact";
  const squareDetail = detail.squareDetail;
  const cloverDetail = detail.cloverDetail;
  const lightspeedDetail = detail.lightspeedDetail;
  const lightspeedDashboard = detail.lightspeedDashboard;
  const metaDetail = detail.metaDetail;
  const ga4Detail = detail.ga4Detail;
  const marketingImportDetail = detail.marketingImportDetail;
  const emailInfrastructureDetail = detail.emailInfrastructureDetail;
  const comingSoonDetail = detail.comingSoonDetail;
  const isComingSoonPage = Boolean(comingSoonDetail);
  const lightspeedWebhookMode = formatLightspeedWebhookMode(
    lightspeedDetail?.webhookMode,
  );
  const metaAuthorizationState = formatMetaAuthorizationState(
    metaDetail?.authorizationStatus,
  );
  const ga4ConnectionState = formatGa4ConnectionState(
    ga4Detail?.connectionStatus,
  );
  const marketingImportState = formatMarketingImportState(
    marketingImportDetail?.connectionStatus,
  );

  const metadataEntries =
    isComingSoonPage && comingSoonDetail
      ? comingSoonDetail.metadata
      : isEmailInfrastructure && emailInfrastructureDetail
        ? emailInfrastructureDetail.metadata
        : isSquare && squareDetail
          ? [
              item.categoryLabel,
              item.syncScopeLabel,
              squareDetail.merchantName ?? "Square merchant",
              `${formatEnvironmentLabel(squareDetail.environment)} environment`,
              squareDetail.locationId
                ? `Location ${squareDetail.locationId}`
                : "Location pending",
            ].filter((entry): entry is string => Boolean(entry))
          : isClover && cloverDetail
            ? [
                `Category: ${item.categoryLabel}`,
                `Region: ${formatRegionLabel(cloverDetail.region)}`,
                `Merchant: ${cloverDetail.merchantName ?? "Clover merchant"}`,
                `Connected since: ${formatTimestampOrFallback(cloverDetail.connectedAt)}`,
                `Last synced: ${formatTimestampOrFallback(cloverDetail.lastSyncedAt)}`,
              ]
            : isLightspeed && lightspeedDetail
              ? [
                  `Category: ${item.categoryLabel}`,
                  `Store: ${lightspeedDetail.storeUrl?.replace("https://", "") ?? "Domain pending"}`,
                  `Retailer: ${lightspeedDetail.retailerName ?? "Lightspeed store"}`,
                  `Connected since: ${formatTimestampOrFallback(lightspeedDetail.connectedAt)}`,
                  `Last synced: ${formatTimestampOrFallback(lightspeedDetail.lastSyncedAt)}`,
                ]
              : isMeta && metaDetail
                ? [
                    `Category: ${item.categoryLabel}`,
                    `Provider: ${metaDetail.providerLabel}`,
                    `Authorization: ${metaDetail.authorizationLabel}`,
                    `Connected since: ${formatTimestampOrFallback(metaDetail.connectedAt, "Not connected")}`,
                  ]
                : isGa4 && ga4Detail
                  ? [
                      `Category: ${item.categoryLabel}`,
                      `Property: ${ga4Detail.propertyId ?? "Not configured"}`,
                      `Status: ${ga4Detail.connectionLabel}`,
                      `Last tested: ${formatTimestampOrFallback(ga4Detail.lastTestAt, "Not tested yet")}`,
                    ]
                  : isMarketingImport && marketingImportDetail
                    ? [
                        `Category: ${item.categoryLabel}`,
                        `Provider: ${marketingImportDetail.providerLabel}`,
                        `Account: ${marketingImportDetail.accountName ?? "Connection pending"}`,
                      ]
                    : model.metadata;

  const squareMetricCards =
    isSquare && squareDetail
      ? [
          {
            key: "square-connection-status",
            label: "Connection Status",
            value: item.status === "connected" ? "Connected" : "Available",
            subtitle:
              item.status === "connected"
                ? squareDetail.connectedAt
                  ? `Connected ${formatRelativeTimestamp(squareDetail.connectedAt)}`
                  : "Square connection is active"
                : "Connect Square to enable syncing and webhook monitoring",
            icon: PlugZap,
            tone: model.statusTone,
          },
          {
            key: "square-customers",
            label: "Customers Synced",
            value: formatCount(squareDetail.customersSynced),
            subtitle: squareDetail.lastCustomerSync
              ? `Last customer sync ${formatRelativeTimestamp(squareDetail.lastCustomerSync)}`
              : "No customer sync recorded yet",
            icon: Users,
            tone: squareDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "square-sales",
            label: "Sales Synced",
            value: formatCount(squareDetail.salesSynced),
            subtitle: squareDetail.lastSalesSync
              ? `Last sales sync ${formatRelativeTimestamp(squareDetail.lastSalesSync)}`
              : "No sales sync recorded yet",
            icon: Receipt,
            tone: squareDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "square-products",
            label: "Products Synced",
            value: formatCount(squareDetail.productsSynced),
            subtitle: squareDetail.lastProductSync
              ? `Last product sync ${formatRelativeTimestamp(squareDetail.lastProductSync)}`
              : "No product sync recorded yet",
            icon: Store,
            tone: squareDetail.lastProductSync ? "success" : "neutral",
          },
        ]
      : [];

  const cloverMetricCards =
    isClover && cloverDetail
      ? [
          {
            key: "clover-customers",
            label: "Customers Synced",
            value: formatCount(cloverDetail.customersSynced),
            subtitle: cloverDetail.lastCustomerSync
              ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastCustomerSync)}`
              : "Last synced Not available",
            icon: Users,
            tone: cloverDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "clover-sales",
            label: "Sales Synced",
            value: formatCount(cloverDetail.salesSynced),
            subtitle: cloverDetail.lastSalesSync
              ? `Last sync: ${formatRelativeTimestamp(cloverDetail.lastSalesSync)}`
              : "Last sync: Not available",
            icon: Receipt,
            tone: cloverDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "clover-products",
            label: "Products Synced",
            value: formatCount(cloverDetail.productsSynced),
            subtitle: cloverDetail.lastProductSync
              ? `Last sync: ${formatRelativeTimestamp(cloverDetail.lastProductSync)}`
              : "Last sync: Not available",
            icon: Store,
            tone: cloverDetail.lastProductSync ? "success" : "neutral",
          },
          {
            key: "clover-webhook-mode",
            label: "Webhook Mode",
            value: cloverDetail.webhooksSubscribed ? "Real-time" : "Sync only",
            subtitle: cloverDetail.webhooksSubscribed
              ? "App-level webhook traffic detected"
              : "Operating without verified app-level webhook traffic",
            icon: Webhook,
            tone: cloverDetail.webhooksSubscribed ? "success" : "warning",
            valueClassName: cloverDetail.webhooksSubscribed
              ? "text-emerald-600"
              : "text-amber-600",
          },
        ]
      : [];

  const lightspeedMetricCards =
    isLightspeed && lightspeedDetail
      ? [
          {
            key: "lightspeed-customers",
            label: "Customers Synced",
            value: formatCount(lightspeedDetail.customersSynced),
            subtitle: lightspeedDetail.lastCustomerSync
              ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastCustomerSync)}`
              : "Last synced Not available",
            icon: Users,
            tone: lightspeedDetail.lastCustomerSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-sales",
            label: "Sales Synced",
            value: formatCount(lightspeedDetail.salesSynced),
            subtitle: lightspeedDetail.lastSalesSync
              ? `Last sync: ${formatRelativeTimestamp(lightspeedDetail.lastSalesSync)}`
              : "Last sync: Not available",
            icon: Receipt,
            tone: lightspeedDetail.lastSalesSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-products",
            label: "Products Synced",
            value: formatCount(lightspeedDetail.productsSynced),
            subtitle: lightspeedDetail.lastProductSync
              ? `Last sync: ${formatRelativeTimestamp(lightspeedDetail.lastProductSync)}`
              : "Last sync: Not available",
            icon: Store,
            tone: lightspeedDetail.lastProductSync ? "success" : "neutral",
          },
          {
            key: "lightspeed-webhook-mode",
            label: "Webhook Mode",
            value: lightspeedWebhookMode.label,
            subtitle: lightspeedWebhookMode.subtitle,
            icon: Webhook,
            tone: lightspeedWebhookMode.tone,
            valueClassName: lightspeedWebhookMode.valueClassName,
          },
        ]
      : [];

  const metaMetricCards =
    isMeta && metaDetail
      ? [
          {
            key: "meta-authorization",
            label: "Authorization",
            value: metaAuthorizationState.label,
            subtitle: metaDetail.expiresAt
              ? `Expires ${formatRelativeTimestamp(metaDetail.expiresAt)}`
              : metaAuthorizationState.subtitle,
            icon: CheckCircle2,
            tone: metaAuthorizationState.tone,
            valueClassName: metaAuthorizationState.valueClassName,
          },
          {
            key: "meta-facebook-pages",
            label: "Facebook Pages",
            value: formatCount(metaDetail.facebookPageCount),
            subtitle:
              metaDetail.facebookPageCount > 0
                ? `${metaDetail.facebookPageCount} stored page${metaDetail.facebookPageCount === 1 ? "" : "s"}`
                : "No Facebook Pages connected",
            icon: Store,
            tone: metaDetail.facebookPageCount > 0 ? "success" : "neutral",
          },
          {
            key: "meta-instagram-accounts",
            label: "Instagram Accounts",
            value: formatCount(metaDetail.instagramAccountCount),
            subtitle:
              metaDetail.instagramAccountCount > 0
                ? `${metaDetail.instagramAccountCount} stored account${metaDetail.instagramAccountCount === 1 ? "" : "s"}`
                : "No Instagram accounts connected",
            icon: Users,
            tone: metaDetail.instagramAccountCount > 0 ? "success" : "neutral",
          },
          {
            key: "meta-last-refresh",
            label: "Last Asset Refresh",
            value: metaDetail.lastActivityAt
              ? formatRelativeTimestamp(metaDetail.lastActivityAt)
              : "Not available",
            subtitle:
              formatExactTimestamp(metaDetail.lastActivityAt) ??
              "Asset refresh history will appear after Meta activity is recorded",
            icon: Activity,
            tone: metaDetail.lastActivityAt ? "neutral" : "warning",
          },
        ]
      : [];

  const ga4MetricCards =
    isGa4 && ga4Detail
      ? [
          {
            key: "ga4-connection-status",
            label: "Connection Status",
            value: ga4ConnectionState.label,
            subtitle: ga4ConnectionState.subtitle,
            icon: PlugZap,
            tone: ga4ConnectionState.tone,
            valueClassName: ga4ConnectionState.valueClassName,
          },
          {
            key: "ga4-property-id",
            label: "Property ID",
            value: ga4Detail.propertyId ?? "Not configured",
            subtitle: ga4Detail.propertyId
              ? ga4Detail.propertyLabel
              : "Configure a numeric GA4 property ID on the Website integrations page",
            icon: Globe,
            tone: ga4Detail.propertyId ? "success" : "neutral",
          },
          {
            key: "ga4-last-test",
            label: "Last Connection Test",
            value: ga4Detail.lastTestAt
              ? formatRelativeTimestamp(ga4Detail.lastTestAt)
              : "Not tested",
            subtitle:
              formatExactTimestamp(ga4Detail.lastTestAt) ??
              (ga4Detail.serviceAccountConfigured
                ? "Service account is configured"
                : "Service account configuration is still required"),
            icon: FlaskConical,
            tone: ga4Detail.lastTestAt ? "neutral" : "warning",
          },
        ]
      : [];

  const marketingImportMetricCards =
    isMarketingImport && marketingImportDetail
      ? [
          {
            key: "marketing-import-status",
            label: "Connection Status",
            value: marketingImportState.label,
            subtitle: marketingImportState.subtitle,
            icon: PlugZap,
            tone: marketingImportState.tone,
            valueClassName: marketingImportState.valueClassName,
          },
          {
            key: "marketing-import-lists",
            label: "Lists Available",
            value: formatCount(marketingImportDetail.listCount),
            subtitle:
              marketingImportDetail.listCount > 0
                ? `${marketingImportDetail.listCount} saved list${marketingImportDetail.listCount === 1 ? "" : "s"} discovered`
                : "Preview lists to cache provider artifacts",
            icon: Store,
            tone: marketingImportDetail.listCount > 0 ? "success" : "neutral",
          },
          {
            key: "marketing-import-latest",
            label: "Latest Import",
            value: marketingImportDetail.latestImportCompletedAt
              ? formatRelativeTimestamp(
                  marketingImportDetail.latestImportCompletedAt,
                )
              : marketingImportDetail.latestImportStartedAt
                ? formatRelativeTimestamp(
                    marketingImportDetail.latestImportStartedAt,
                  )
                : "Not started",
            subtitle: marketingImportDetail.latestImportSummary,
            icon: Activity,
            tone: marketingImportDetail.latestImportId ? "neutral" : "warning",
          },
        ]
      : [];

  const emailInfrastructureMetricCards =
    isEmailInfrastructure && emailInfrastructureDetail
      ? [
          {
            key: "email-infrastructure-domain",
            label: "Primary Domain",
            value: emailInfrastructureDetail.primaryDomain ?? "Setup required",
            subtitle: `${emailInfrastructureDetail.primaryStatusLabel} • ${emailInfrastructureDetail.providerModeLabel}`,
            icon: Globe,
            tone: emailInfrastructureDetail.primaryDomain
              ? "success"
              : "warning",
          },
          {
            key: "email-infrastructure-dns",
            label: "DNS Coverage",
            value: `${emailInfrastructureDetail.dnsVerifiedCount}/${emailInfrastructureDetail.dnsRecordCount}`,
            subtitle:
              emailInfrastructureDetail.dnsRecordCount > 0
                ? "Verified records currently visible from BloomSuite checks"
                : "No DNS records are loaded for the current domain yet",
            icon: Webhook,
            tone:
              emailInfrastructureDetail.dnsRecordCount > 0 &&
              emailInfrastructureDetail.dnsVerifiedCount ===
                emailInfrastructureDetail.dnsRecordCount
                ? "success"
                : emailInfrastructureDetail.dnsRecordCount > 0
                  ? "warning"
                  : "neutral",
          },
          {
            key: "email-infrastructure-volume",
            label: "Sent Last 24h",
            value: formatCount(emailInfrastructureDetail.sent24h),
            subtitle:
              emailInfrastructureDetail.dailyLimit !== null
                ? `Daily limit ${formatCount(emailInfrastructureDetail.dailyLimit)} • Delivered ${formatCount(emailInfrastructureDetail.delivered24h)}`
                : `Delivered ${formatCount(emailInfrastructureDetail.delivered24h)} in the last 24 hours`,
            icon: Activity,
            tone: emailInfrastructureDetail.sent24h > 0 ? "success" : "neutral",
          },
          {
            key: "email-infrastructure-health",
            label: "Infrastructure Health",
            value:
              emailInfrastructureDetail.reputationScore !== null
                ? `${Math.round(emailInfrastructureDetail.reputationScore)}`
                : emailInfrastructureDetail.healthCheckLabel,
            subtitle:
              emailInfrastructureDetail.reputationScore !== null
                ? `${formatRate(emailInfrastructureDetail.bounceRate24h)} bounce • ${formatRate(emailInfrastructureDetail.complaintRate24h)} complaint`
                : emailInfrastructureDetail.healthSummary,
            icon: ShieldAlert,
            tone: formatInfrastructureHealthTone(
              emailInfrastructureDetail.healthCheckStatus,
            ),
          },
        ]
      : [];

  const copyToClipboard = async (
    value: string | null | undefined,
    label: string,
  ) => {
    if (!value) {
      toast.error(`${label} is not available for this integration.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const headerActionSections =
    !isComingSoonPage && detail.canUseActions
      ? [
          {
            id: "primary",
            items: [
              {
                label:
                  item.status === "coming-soon"
                    ? "Request integration"
                    : (item.detailActionLabel ?? "Open integration"),
                icon: item.status === "coming-soon" ? MailPlus : ExternalLink,
                onSelect: () => {
                  if (item.status === "coming-soon") {
                    window.location.href = `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(item.name)}`;
                    return;
                  }

                  if (detail.targetPath) {
                    navigate(detail.targetPath);
                  }
                },
              },
              {
                label: detail.isFetching ? "Refreshing…" : "Refresh status",
                icon: RefreshCcw,
                disabled: detail.isFetching,
                onSelect: () => {
                  void detail.refetch();
                },
              },
            ],
          },
          ...(isSquare && squareDetail
            ? [
                {
                  id: "square-operations",
                  label: "Square Operations",
                  items: [
                    {
                      label: detail.isSquareSyncing
                        ? "Starting sync…"
                        : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" || detail.isSquareSyncing,
                      onSelect: () => {
                        void detail.triggerSquareSync();
                      },
                    },
                    {
                      label: detail.isVerifyingSquareWebhooks
                        ? "Verifying webhooks…"
                        : "Verify webhooks",
                      icon: Webhook,
                      disabled:
                        item.status !== "connected" ||
                        detail.isVerifyingSquareWebhooks,
                      onSelect: () => {
                        void detail.verifySquareWebhooks();
                      },
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(squareDetail.syncLogsPath),
                    },
                    {
                      label: "View automation logs",
                      icon: Bot,
                      onSelect: () => navigate(squareDetail.automationLogsPath),
                    },
                  ],
                },
                {
                  id: "square-identifiers",
                  label: "Square IDs",
                  items: [
                    {
                      label: "Copy merchant ID",
                      icon: Copy,
                      disabled: !squareDetail.merchantId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.merchantId,
                          "Merchant ID",
                        );
                      },
                    },
                    {
                      label: "Copy location ID",
                      icon: MapPin,
                      disabled: !squareDetail.locationId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.locationId,
                          "Location ID",
                        );
                      },
                    },
                    {
                      label: "Copy webhook subscription ID",
                      icon: Webhook,
                      disabled: !squareDetail.webhookSubscriptionId,
                      onSelect: () => {
                        void copyToClipboard(
                          squareDetail.webhookSubscriptionId,
                          "Webhook subscription ID",
                        );
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isClover && cloverDetail
            ? [
                {
                  id: "clover-operations",
                  label: "Clover Operations",
                  items: [
                    {
                      label: detail.isCloverSyncing
                        ? "Starting sync…"
                        : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" || detail.isCloverSyncing,
                      onSelect: () => {
                        void detail.triggerCloverSync();
                      },
                    },
                    {
                      label: detail.isCloverConnectionTesting
                        ? "Running connection test…"
                        : "Run connection test",
                      icon: FlaskConical,
                      disabled:
                        item.status !== "connected" ||
                        detail.isCloverConnectionTesting,
                      onSelect: () => {
                        void detail.runCloverConnectionTest();
                      },
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(cloverDetail.syncLogsPath),
                    },
                    {
                      label: "Copy merchant ID",
                      icon: Copy,
                      disabled: !cloverDetail.merchantId,
                      onSelect: () => {
                        void copyToClipboard(
                          cloverDetail.merchantId,
                          "Merchant ID",
                        );
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isLightspeed && lightspeedDetail
            ? [
                {
                  id: "lightspeed-operations",
                  label: "Lightspeed Operations",
                  items: [
                    {
                      label:
                        detail.lightspeedSyncState === "triggering"
                          ? "Starting sync…"
                          : detail.lightspeedSyncState === "syncing"
                            ? "Sync in progress"
                            : "Trigger manual sync",
                      icon: RefreshCcw,
                      disabled:
                        item.status !== "connected" ||
                        detail.isLightspeedSyncing,
                      onSelect: () => {
                        void detail.triggerLightspeedSync();
                      },
                    },
                    {
                      label: "Run diagnostics",
                      icon: FlaskConical,
                      onSelect: () =>
                        navigate(lightspeedDetail.diagnosticsPath),
                    },
                    {
                      label: "View sync logs",
                      icon: Activity,
                      onSelect: () => navigate(lightspeedDetail.syncLogsPath),
                    },
                    {
                      label: "Open store URL",
                      icon: ExternalLink,
                      disabled: !lightspeedDetail.storeUrl,
                      onSelect: () => {
                        if (lightspeedDetail.storeUrl) {
                          window.open(
                            lightspeedDetail.storeUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(isMeta && metaDetail
            ? [
                {
                  id: "meta-operations",
                  label: "Meta Operations",
                  items: [
                    {
                      label: detail.isMetaReauthorizing
                        ? "Opening authorization..."
                        : metaDetail.authorizationStatus === "not-connected"
                          ? "Authorize Meta"
                          : "Re-authorize Meta",
                      icon: PlugZap,
                      disabled: detail.isMetaReauthorizing,
                      onSelect: () => {
                        void detail.triggerMetaReauthorization();
                      },
                    },
                    {
                      label: detail.isRefreshingMetaAssets
                        ? "Refreshing asset list..."
                        : "Refresh asset list",
                      icon: RefreshCcw,
                      disabled:
                        detail.isRefreshingMetaAssets ||
                        metaDetail.connectedAssetCount === 0,
                      onSelect: () => {
                        void detail.refreshMetaAssets();
                      },
                    },
                    {
                      label: "View publishing logs",
                      icon: Activity,
                      onSelect: () => navigate(metaDetail.syncLogsPath),
                    },
                  ],
                },
              ]
            : []),
          ...(isGa4 && ga4Detail
            ? [
                {
                  id: "ga4-operations",
                  label: "Google Analytics Actions",
                  items: [
                    {
                      label: detail.isGa4ConnectionTesting
                        ? "Testing connection..."
                        : "Test Connection",
                      icon: FlaskConical,
                      disabled:
                        !ga4Detail.propertyId ||
                        ga4Detail.connectionStatus !== "connected" ||
                        detail.isGa4ConnectionTesting,
                      onSelect: () => {
                        void detail.triggerGa4ConnectionTest();
                      },
                    },
                    {
                      label: detail.isGa4Reauthorizing
                        ? "Opening Google authorization..."
                        : "Re-authorize Google Analytics",
                      icon: PlugZap,
                      disabled:
                        !ga4Detail.propertyId || detail.isGa4Reauthorizing,
                      onSelect: () => {
                        void detail.triggerGa4Reauthorization();
                      },
                    },
                    {
                      label: "View Reporting Dashboard",
                      icon: Activity,
                      onSelect: () => navigate(ga4Detail.reportingPath),
                    },
                  ],
                },
              ]
            : []),
          ...(isMarketingImport && marketingImportDetail
            ? [
                {
                  id: "marketing-import-actions",
                  label: `${marketingImportDetail.providerLabel} Import Actions`,
                  items: [
                    {
                      label: "Open Import Flow",
                      icon: ArrowRight,
                      onSelect: () =>
                        navigate(marketingImportDetail.importFlowPath),
                    },
                    {
                      label: "Preview Lists",
                      icon: ExternalLink,
                      onSelect: () =>
                        navigate(marketingImportDetail.previewListsPath),
                    },
                  ],
                },
              ]
            : []),
          ...(detail.canDisconnect
            ? [
                {
                  id: "danger",
                  items: [
                    {
                      label: isMeta
                        ? "Disconnect Meta"
                        : isClover
                          ? "Disconnect Clover"
                          : isLightspeed
                            ? "Disconnect Lightspeed"
                            : isGa4
                              ? "Disconnect Google Analytics"
                              : isMarketingImport && marketingImportDetail
                                ? `Disconnect ${marketingImportDetail.providerLabel}`
                                : "Disconnect integration",
                      icon: ShieldAlert,
                      destructive: true,
                      onSelect: () => setDisconnectOpen(true),
                    },
                  ],
                },
              ]
            : []),
        ]
      : [];

  const displayedActionSections =
    isEmailInfrastructure && emailInfrastructureDetail
      ? [
          {
            id: "email-infrastructure-actions",
            label: "Infrastructure Actions",
            items: [
              {
                label: detail.isRunningEmailInfrastructureHealthCheck
                  ? "Running health check..."
                  : "Run Health Check",
                icon: FlaskConical,
                disabled:
                  !emailInfrastructureDetail.canRunHealthCheck ||
                  detail.isRunningEmailInfrastructureHealthCheck,
                onSelect: () => {
                  void detail.runEmailInfrastructureHealthCheck();
                },
              },
              {
                label: "View DNS Records",
                icon: Webhook,
                onSelect: () =>
                  navigate(emailInfrastructureDetail.dnsRecordsPath),
              },
              {
                label: "View Sending Logs",
                icon: Activity,
                onSelect: () =>
                  navigate(emailInfrastructureDetail.sendingLogsPath),
              },
              {
                label: "Contact Support",
                icon: MailPlus,
                onSelect: () => {
                  window.location.href = emailInfrastructureDetail.supportPath;
                },
              },
            ],
          },
        ]
      : headerActionSections;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList className="flex-wrap gap-2 rounded-full border border-border/70 bg-white/90 px-4 py-2 text-sm shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
              >
                <Link to="/integrations">Integrations</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-muted-foreground/50" />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-brand-navy">
                {item.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-white via-white to-brand-teal/5 p-6 shadow-sm shadow-brand-navy/5">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-white shadow-sm">
                  <Icon className="h-6 w-6 text-slate-700" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {item.name}
                    </h1>
                    <DetailStatusBadge
                      label={
                        comingSoonDetail?.statusLabel ??
                        emailInfrastructureDetail?.badgeLabel ??
                        model.statusLabel
                      }
                      tone={
                        comingSoonDetail?.statusTone ??
                        emailInfrastructureDetail?.badgeTone ??
                        model.statusTone
                      }
                    />
                    {detail.isFetching ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Refreshing
                      </span>
                    ) : null}
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {item.detailSummary ?? item.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {metadataEntries.map((entry, index) => (
                      <div
                        key={`${entry}-${index}`}
                        className="inline-flex items-center gap-2"
                      >
                        {index > 0 ? (
                          <span className="text-border">&middot;</span>
                        ) : null}
                        <span>{entry}</span>
                      </div>
                    ))}
                  </div>
                  {isMarketingImport && marketingImportDetail ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                        Purpose: {marketingImportDetail.purposeLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-slate-200 text-slate-600"
                      >
                        Live Sync: {marketingImportDetail.liveSyncLabel}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/integrations/${seed.slug}/documentation`}>
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Documentation
                </Link>
              </Button>
              {displayedActionSections.length > 0 ? (
                <ActionDropdown
                  label="Actions"
                  align="end"
                  sections={displayedActionSections}
                  triggerClassName="min-w-[10rem] justify-between"
                />
              ) : null}
            </div>
          </div>

          {detail.isError ? (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Unable to refresh integration details
                  </div>
                  <div className="mt-1 text-rose-700/90">
                    {detail.error instanceof Error
                      ? detail.error.message
                      : "An unexpected error occurred while loading this integration."}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void detail.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : null}

          {model.errorBanner ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{model.errorBanner.title}</div>
                <div className="mt-1 text-amber-800/90">
                  {model.errorBanner.description}
                </div>
              </div>
            </div>
          ) : null}

          {!isComingSoonPage ? (
            <div
              className={cn(
                "mt-6 grid gap-4",
                isSquare ||
                  isClover ||
                  isLightspeed ||
                  isMeta ||
                  isGa4 ||
                  isEmailInfrastructure ||
                  isMarketingImport
                  ? "md:grid-cols-2 xl:grid-cols-4"
                  : "md:grid-cols-3",
              )}
            >
              {(isSquare
                ? squareMetricCards
                : isClover
                  ? cloverMetricCards
                  : isLightspeed
                    ? lightspeedMetricCards
                    : isMeta
                      ? metaMetricCards
                      : isGa4
                        ? ga4MetricCards
                        : isEmailInfrastructure
                          ? emailInfrastructureMetricCards
                          : isMarketingImport
                            ? marketingImportMetricCards
                            : model.metrics
              ).map((metric) => {
                const appearance = MetricAppearance({ tone: metric.tone });

                return (
                  <CRMMetricCard
                    key={metric.key}
                    label={metric.label}
                    value={metric.value}
                    subtitle={
                      "timestamp" in metric && metric.timestamp
                        ? `${formatRelativeTimestamp(metric.timestamp)}${formatExactTimestamp(metric.timestamp) ? ` • ${formatExactTimestamp(metric.timestamp)}` : ""}`
                        : metric.subtitle
                    }
                    icon={
                      "icon" in metric
                        ? metric.icon
                        : metric.key === "connection"
                          ? PlugZap
                          : metric.key === "latest-signal"
                            ? Clock3
                            : Activity
                    }
                    iconClassName={appearance.iconClassName}
                    iconWrapClassName={appearance.iconWrapClassName}
                    valueClassName={
                      "valueClassName" in metric
                        ? metric.valueClassName
                        : undefined
                    }
                    appearance="flat"
                  />
                );
              })}
            </div>
          ) : null}
        </section>

        {isComingSoonPage && comingSoonDetail ? (
          <ComingSoonCard
            title={comingSoonDetail.cardTitle}
            description={comingSoonDetail.description}
            capabilities={comingSoonDetail.capabilities}
            availabilityLabel={comingSoonDetail.availabilityLabel}
            previewCallout={comingSoonDetail.previewCallout}
            notifyEmail={comingSoonDetail.notifyEmail}
            isSubmitted={comingSoonDetail.isSubmitted}
            isSubmitting={detail.isSubmittingComingSoonInterest}
            onSubmit={() => {
              void detail.submitComingSoonInterest();
            }}
            requestPath={comingSoonDetail.requestPath}
          />
        ) : isEmailInfrastructure && emailInfrastructureDetail ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)]">
            <div className="space-y-6">
              <SectionCard
                title="Infrastructure Timeline"
                description="Recent verification and infrastructure lifecycle events for your primary sending domain."
              >
                <DetailTimeline entries={model.timeline} />
              </SectionCard>

              <SectionCard
                title="Operational Overview"
                description="A concise summary of current readiness, tenant email activity, and the shared monitoring state available today."
              >
                <div className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Readiness summary
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {emailInfrastructureDetail.readinessSummary}
                    </p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Health summary
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {emailInfrastructureDetail.healthSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      disabled={
                        !emailInfrastructureDetail.canRunHealthCheck ||
                        detail.isRunningEmailInfrastructureHealthCheck
                      }
                      onClick={() => {
                        void detail.runEmailInfrastructureHealthCheck();
                      }}
                    >
                      {detail.isRunningEmailInfrastructureHealthCheck
                        ? "Running health check..."
                        : "Run Health Check"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(emailInfrastructureDetail.sendingLogsPath)
                      }
                    >
                      View Sending Logs
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                title="Domain Configuration"
                description="Primary sending-domain state and the provider controls BloomSuite currently knows about."
              >
                <DetailFieldRows
                  rows={[
                    {
                      label: "Primary Domain",
                      value:
                        emailInfrastructureDetail.primaryDomain ??
                        "No sending domain configured",
                    },
                    {
                      label: "Status",
                      value: emailInfrastructureDetail.primaryStatusLabel,
                      tone: emailInfrastructureDetail.primaryDomain
                        ? "success"
                        : "warning",
                    },
                    {
                      label: "Provider",
                      value: emailInfrastructureDetail.providerLabel,
                      description: emailInfrastructureDetail.providerModeLabel,
                    },
                    {
                      label: "Domains on File",
                      value: formatCount(emailInfrastructureDetail.domainCount),
                      description: `${formatCount(emailInfrastructureDetail.verifiedDomainCount)} verified`,
                      tone:
                        emailInfrastructureDetail.verifiedDomainCount > 0
                          ? "success"
                          : "neutral",
                    },
                    {
                      label: "Verified At",
                      value: formatRelativePlusAbsolute(
                        emailInfrastructureDetail.verifiedAt,
                        "Not verified yet",
                      ).value,
                      description: formatRelativePlusAbsolute(
                        emailInfrastructureDetail.verifiedAt,
                        "Not verified yet",
                      ).description,
                      tone: emailInfrastructureDetail.verifiedAt
                        ? "success"
                        : "warning",
                    },
                    {
                      label: "Warmup Stage",
                      value:
                        emailInfrastructureDetail.warmupStage !== null
                          ? String(emailInfrastructureDetail.warmupStage)
                          : "Not warming",
                      description:
                        emailInfrastructureDetail.healthyDaysCounter !== null
                          ? `${emailInfrastructureDetail.healthyDaysCounter} healthy days tracked`
                          : undefined,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard
                title="DNS Record Status"
                description="Current DNS evidence for the primary sending domain using the records BloomSuite already stores."
              >
                {emailInfrastructureDetail.dnsRecords.length > 0 ? (
                  <DetailFieldRows
                    rows={emailInfrastructureDetail.dnsRecords.map(
                      (record) => ({
                        label: `${record.type} • ${record.purpose}`,
                        value: record.verified ? "Verified" : "Pending",
                        description: `${record.name} • ${record.value}`,
                        tone: record.verified ? "success" : "warning",
                      }),
                    )}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
                    No DNS records are available yet for the current
                    infrastructure view. Open Domain settings to add a sending
                    domain or inspect the existing DNS configuration.
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(emailInfrastructureDetail.dnsRecordsPath)
                    }
                  >
                    View DNS Records
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(emailInfrastructureDetail.domainSettingsPath)
                    }
                  >
                    Open Domain Settings
                  </Button>
                </div>
              </SectionCard>

              <SectionCard
                title="Sending Infrastructure Health"
                description="Tenant-level reputation and delivery health already available from BloomSuite’s email dashboards."
              >
                <DetailFieldRows
                  rows={[
                    {
                      label: "Health Check",
                      value: emailInfrastructureDetail.healthCheckLabel,
                      description: formatRelativePlusAbsolute(
                        emailInfrastructureDetail.latestHealthCheckAt,
                        "No checks recorded",
                      ).description,
                      tone: formatInfrastructureHealthTone(
                        emailInfrastructureDetail.healthCheckStatus,
                      ),
                    },
                    {
                      label: "Reputation Score",
                      value:
                        emailInfrastructureDetail.reputationScore !== null
                          ? String(
                              Math.round(
                                emailInfrastructureDetail.reputationScore,
                              ),
                            )
                          : "Unavailable",
                      description:
                        emailInfrastructureDetail.reputationTier ??
                        formatInfrastructureTrendLabel(
                          emailInfrastructureDetail.trendDirection,
                        ),
                      tone:
                        emailInfrastructureDetail.reputationScore !== null
                          ? "success"
                          : "neutral",
                    },
                    {
                      label: "Sent Last 24h",
                      value: formatCount(emailInfrastructureDetail.sent24h),
                      description: `${formatCount(emailInfrastructureDetail.delivered24h)} delivered`,
                      tone:
                        emailInfrastructureDetail.sent24h > 0
                          ? "success"
                          : "neutral",
                    },
                    {
                      label: "30d Delivery Rate",
                      value: formatRate(
                        emailInfrastructureDetail.deliveryRate30d,
                      ),
                      description: `${formatRate(emailInfrastructureDetail.bounceRate30d)} bounce rate`,
                      tone:
                        emailInfrastructureDetail.deliveryRate30d >= 95
                          ? "success"
                          : "warning",
                    },
                    {
                      label: "24h Bounce Rate",
                      value: formatRate(
                        emailInfrastructureDetail.bounceRate24h,
                      ),
                      description: `${formatRate(emailInfrastructureDetail.complaintRate24h)} complaint rate`,
                      tone:
                        emailInfrastructureDetail.bounceRate24h <= 2
                          ? "success"
                          : "warning",
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard
                title="Domain Connect & Setup Tools"
                description="Existing setup destinations for Domain Connect, manual DNS changes, sending preferences, and support."
              >
                <div className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {emailInfrastructureDetail.domainConnectSummary}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        navigate(emailInfrastructureDetail.domainSettingsPath)
                      }
                    >
                      Open Domain Settings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(emailInfrastructureDetail.emailSettingsPath)
                      }
                    >
                      Email Sending Settings
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(emailInfrastructureDetail.sendingLogsPath)
                      }
                    >
                      View Sending Logs
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href =
                          emailInfrastructureDetail.supportPath;
                      }}
                    >
                      Contact Support
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
              <SectionCard
                title="Connection Health"
                description="Connection lifecycle and provider events for this integration."
              >
                <DetailTimeline entries={model.timeline} />
              </SectionCard>

              <SectionCard
                title="Webhook Health"
                description="Subscription, retry, and delivery state based on existing provider telemetry."
              >
                <DetailHealthRows rows={model.webhookRows} />
              </SectionCard>

              <SectionCard
                title="Sync Health"
                description="Last sync or verification state and the display-safe counters available today."
              >
                <DetailHealthRows rows={model.syncRows} />
              </SectionCard>
            </div>

            <div className="space-y-6">
              {isSquare && squareDetail ? (
                <>
                  <SectionCard
                    title="Merchant Details"
                    description="Identifiers and connection metadata stored for this Square merchant."
                  >
                    <KeyValueGrid
                      entries={[
                        {
                          label: "Merchant Name",
                          value: squareDetail.merchantName ?? "Not available",
                        },
                        {
                          label: "Merchant ID",
                          value: squareDetail.merchantId ?? "Not available",
                        },
                        {
                          label: "Location ID",
                          value: squareDetail.locationId ?? "Not available",
                        },
                        {
                          label: "Environment",
                          value: formatEnvironmentLabel(
                            squareDetail.environment,
                          ),
                        },
                        {
                          label: "Token Type",
                          value: formatTokenType(squareDetail.tokenType),
                        },
                        {
                          label: "Connected",
                          value:
                            formatExactTimestamp(squareDetail.connectedAt) ??
                            "Not connected yet",
                        },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Sync Configuration"
                    description="Current Square sync coverage and the last recorded timestamp per domain."
                  >
                    <div className="space-y-3">
                      {[
                        {
                          label: "Customers",
                          value: squareDetail.lastCustomerSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastCustomerSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.customersSynced)} customer records synced`,
                        },
                        {
                          label: "Sales",
                          value: squareDetail.lastSalesSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastSalesSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.salesSynced)} sales records synced`,
                        },
                        {
                          label: "Products",
                          value: squareDetail.lastProductSync
                            ? `Last synced ${formatRelativeTimestamp(squareDetail.lastProductSync)}`
                            : "Not synced yet",
                          description: `${formatCount(squareDetail.productsSynced)} product records synced`,
                        },
                      ].map((entry) => (
                        <div
                          key={entry.label}
                          className="rounded-2xl border border-border/70 bg-slate-50/70 p-4"
                        >
                          <div className="text-sm font-semibold text-slate-950">
                            {entry.label}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.value}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {entry.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Webhook Subscription Status"
                    description="Square webhook subscription health and the required event coverage BloomSuite expects."
                  >
                    <KeyValueGrid
                      entries={[
                        {
                          label: "Subscription State",
                          value: squareDetail.webhooksSubscribed
                            ? "Subscribed"
                            : "Attention needed",
                        },
                        {
                          label: "Subscription ID",
                          value:
                            squareDetail.webhookSubscriptionId ??
                            "Not available",
                        },
                        {
                          label: "Last Checked",
                          value:
                            formatExactTimestamp(
                              squareDetail.webhooksLastCheckedAt,
                            ) ?? "Not yet checked",
                        },
                        {
                          label: "Last Event",
                          value:
                            formatExactTimestamp(
                              squareDetail.lastWebhookReceivedAt,
                            ) ?? "Not yet received",
                        },
                        {
                          label: "Retry Queue",
                          value: squareDetail.webhookRetryCount
                            ? `${squareDetail.webhookRetryCount} pending`
                            : "No retries pending",
                        },
                        {
                          label: "Next Retry",
                          value:
                            formatExactTimestamp(
                              squareDetail.webhookNextRetryAt,
                            ) ?? "Not scheduled",
                        },
                      ]}
                    />
                    {squareDetail.webhookLastError ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                        <div className="font-semibold">Last webhook error</div>
                        <div className="mt-1 leading-6 text-amber-800/90">
                          {squareDetail.webhookLastError}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Required event types
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {squareDetail.requiredWebhookEvents.map((eventType) => (
                          <span
                            key={eventType}
                            className="inline-flex items-center rounded-full border border-border/70 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {eventType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Automation Integration"
                    description="Square activity feeds BloomSuite automation and activity workflows through existing CRM surfaces."
                  >
                    <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white">
                          <Bot className="h-4.5 w-4.5 text-slate-700" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            Existing automation routing
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Use CRM Automations to review triggers and rules
                            that react to Square customer, order, and catalog
                            activity. Use Activity Center for the latest
                            automation and sync events tied to Square.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={() => navigate(squareDetail.automationPath)}
                        >
                          Open automations
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            navigate(squareDetail.automationLogsPath)
                          }
                        >
                          View automation logs
                        </Button>
                      </div>
                    </div>
                  </SectionCard>
                </>
              ) : isClover && cloverDetail ? (
                <>
                  <SectionCard
                    title="Merchant Details"
                    description="Merchant identifiers and Clover connection metadata stored for this tenant."
                  >
                    <DetailFieldRows
                      onCopy={copyToClipboard}
                      rows={[
                        {
                          label: "Merchant Name",
                          value: cloverDetail.merchantName ?? "Not available",
                        },
                        {
                          label: "Merchant ID",
                          value: cloverDetail.merchantId ?? "Not available",
                          copyValue: cloverDetail.merchantId,
                          copyLabel: "Merchant ID",
                        },
                        {
                          label: "Employee ID",
                          value: cloverDetail.employeeId ?? "Not available",
                          copyValue: cloverDetail.employeeId,
                          copyLabel: "Employee ID",
                        },
                        {
                          label: "Region",
                          value: formatRegionLabel(cloverDetail.region),
                        },
                        {
                          label: "Environment",
                          value: formatEnvironmentLabel(
                            cloverDetail.environment,
                          ),
                        },
                        {
                          label: "Connected Since",
                          value: formatTimestampOrFallback(
                            cloverDetail.connectedAt,
                          ),
                        },
                        {
                          label: "Setup Wizard Completed",
                          value: formatTimestampOrFallback(
                            cloverDetail.setupWizardCompletedAt,
                            "Not completed",
                          ),
                        },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Sync Configuration"
                    description="Actual Clover sync telemetry per domain, without assuming all sync paths are active."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "Customers",
                          value: cloverDetail.lastCustomerSync
                            ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastCustomerSync)}`
                            : "Not synced yet",
                          description: `${formatCount(cloverDetail.customersSynced)} records`,
                          tone: cloverDetail.lastCustomerSync
                            ? "success"
                            : "neutral",
                        },
                        {
                          label: "Sales",
                          value: cloverDetail.lastSalesSync
                            ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastSalesSync)}`
                            : "Not synced yet",
                          description: `${formatCount(cloverDetail.salesSynced)} records`,
                          tone: cloverDetail.lastSalesSync
                            ? "success"
                            : "neutral",
                        },
                        {
                          label: "Products",
                          value: cloverDetail.lastProductSync
                            ? `Last synced ${formatRelativeTimestamp(cloverDetail.lastProductSync)}`
                            : "Not synced yet",
                          description: `${formatCount(cloverDetail.productsSynced)} records`,
                          tone: cloverDetail.lastProductSync
                            ? "success"
                            : "neutral",
                        },
                      ]}
                    />
                    <div className="mt-4">
                      <Button
                        type="button"
                        onClick={() => {
                          void detail.triggerCloverSync();
                        }}
                        disabled={
                          item.status !== "connected" || detail.isCloverSyncing
                        }
                      >
                        {detail.isCloverSyncing
                          ? "Starting sync..."
                          : "Trigger Manual Sync"}
                      </Button>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Webhook Configuration"
                    description="Clover webhook state as tracked from the existing app-level monitoring flow."
                  >
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                      Clover webhooks are configured at the app level, not per
                      merchant. BloomSuite monitors webhook readiness by
                      observing recent traffic rather than directly provisioning
                      merchant subscriptions.
                    </div>
                    <div className="mt-4">
                      <DetailFieldRows
                        rows={[
                          {
                            label: "App Webhook Status",
                            value: cloverDetail.webhooksSubscribed
                              ? "Enabled"
                              : "Not configured",
                            tone: cloverDetail.webhooksSubscribed
                              ? "success"
                              : "warning",
                          },
                          {
                            label: "App ID on File",
                            value: cloverDetail.appIdConfigured
                              ? "Configured"
                              : "Not set",
                            tone: cloverDetail.appIdConfigured
                              ? "success"
                              : "warning",
                          },
                          {
                            label: "Last Webhook Received",
                            value: formatRelativePlusAbsolute(
                              cloverDetail.lastWebhookReceivedAt,
                              "Never",
                            ).value,
                            description: formatRelativePlusAbsolute(
                              cloverDetail.lastWebhookReceivedAt,
                              "Never",
                            ).description,
                            tone: cloverDetail.lastWebhookReceivedAt
                              ? "success"
                              : "neutral",
                          },
                          {
                            label: "Last Health Check",
                            value: formatRelativePlusAbsolute(
                              cloverDetail.webhooksLastCheckedAt,
                              "Never",
                            ).value,
                            description: formatRelativePlusAbsolute(
                              cloverDetail.webhooksLastCheckedAt,
                              "Never",
                            ).description,
                            tone: cloverDetail.webhooksLastCheckedAt
                              ? "neutral"
                              : "warning",
                          },
                          {
                            label: "Last Error",
                            value: cloverDetail.webhookLastError ?? "—",
                            tone: cloverDetail.webhookLastError
                              ? "danger"
                              : "neutral",
                            valueClassName: cloverDetail.webhookLastError
                              ? "text-rose-700"
                              : "text-slate-500",
                          },
                          {
                            label: "Retry Count",
                            value: String(cloverDetail.webhookRetryCount ?? 0),
                            tone:
                              (cloverDetail.webhookRetryCount ?? 0) > 0
                                ? "warning"
                                : "neutral",
                          },
                          {
                            label: "Next Retry",
                            value: formatRelativePlusAbsolute(
                              cloverDetail.webhookNextRetryAt,
                              "—",
                            ).value,
                            description: formatRelativePlusAbsolute(
                              cloverDetail.webhookNextRetryAt,
                              "—",
                            ).description,
                            tone: cloverDetail.webhookNextRetryAt
                              ? "warning"
                              : "neutral",
                          },
                        ]}
                      />
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground">
                      If Clover App ID is not configured, this integration will
                      operate in sync-only mode. Real-time event processing
                      requires app-level webhook setup.
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Automation Integration"
                    description="Current Clover automation maturity based on the existing CRM and webhook pipeline implementation."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "CRM Customer Writes",
                          value: "Active",
                          tone: "success",
                        },
                        {
                          label: "Order Pipeline",
                          value: "Partial",
                          tone: "warning",
                        },
                        {
                          label: "Automation Triggers",
                          value: "Active",
                          tone: "success",
                        },
                        {
                          label: "Outbox Messaging",
                          value: "Active",
                          tone: "success",
                        },
                        {
                          label: "Loyalty Events",
                          value: "Not available",
                          tone: "neutral",
                          valueClassName: "text-slate-500",
                        },
                        {
                          label: "Refund Handling",
                          value: "Partial",
                          tone: "warning",
                        },
                      ]}
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0"
                        onClick={() =>
                          navigate(cloverDetail.automationLogsPath)
                        }
                      >
                        View Automation Logs
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Some Clover automation behaviors are provisionally
                      implemented. Order and refund pipeline maturity is lower
                      than Square.
                    </div>
                  </SectionCard>
                </>
              ) : isLightspeed && lightspeedDetail ? (
                <>
                  <Tabs
                    value={lightspeedTab}
                    onValueChange={(value) =>
                      setLightspeedTab(value as LightspeedTabValue)
                    }
                    className="space-y-6"
                  >
                    <div className="overflow-x-auto">
                      <TabsList className="inline-flex h-auto min-w-full justify-start rounded-2xl border border-border/70 bg-white/80 p-1">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="customers">
                          Customers (
                          {formatCount(lightspeedDetail.customersSynced)})
                        </TabsTrigger>
                        <TabsTrigger value="sales">
                          Sales ({formatCount(lightspeedDetail.salesSynced)})
                        </TabsTrigger>
                        <TabsTrigger value="products">
                          Products (
                          {formatCount(lightspeedDetail.productsSynced)})
                        </TabsTrigger>
                        <TabsTrigger value="sync-logs">Sync Logs</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-6">
                      <SectionCard
                        title="Store Details"
                        description="Domain-based store identity and connection metadata stored for this Lightspeed account."
                      >
                        <DetailFieldRows
                          onCopy={copyToClipboard}
                          rows={[
                            {
                              label: "Retailer Name",
                              value:
                                lightspeedDetail.retailerName ??
                                "Not available",
                            },
                            {
                              label: "Domain Prefix",
                              value:
                                lightspeedDetail.domainPrefix ??
                                "Not available",
                              copyValue: lightspeedDetail.domainPrefix,
                              copyLabel: "Domain prefix",
                            },
                            {
                              label: "Store URL",
                              value: lightspeedDetail.storeUrl ? (
                                <a
                                  href={lightspeedDetail.storeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-brand-navy underline-offset-4 hover:underline"
                                >
                                  {lightspeedDetail.storeUrl.replace(
                                    "https://",
                                    "",
                                  )}
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                "Not available"
                              ),
                            },
                            {
                              label: "Connection Status",
                              value:
                                lightspeedDetail.connectionStatus ??
                                "Not available",
                              tone:
                                item.status === "connected"
                                  ? "success"
                                  : "neutral",
                            },
                            {
                              label: "Connected Since",
                              value: formatTimestampOrFallback(
                                lightspeedDetail.connectedAt,
                              ),
                            },
                          ]}
                        />
                      </SectionCard>

                      <LightspeedSyncProgressPanel
                        jobs={detail.lightspeedSyncJobs}
                        syncState={detail.lightspeedSyncState}
                        hasStaleJobs={detail.lightspeedHasStaleJobs}
                      />

                      <SectionCard
                        title="Sync Configuration"
                        description="Actual Lightspeed sync telemetry per domain, using the connection timestamps already stored today."
                      >
                        <DetailFieldRows
                          rows={[
                            {
                              label: "Customers",
                              value: lightspeedDetail.lastCustomerSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastCustomerSync)}`
                                : "Not synced yet",
                              description: `${formatCount(lightspeedDetail.customersSynced)} records`,
                              tone: lightspeedDetail.lastCustomerSync
                                ? "success"
                                : "neutral",
                            },
                            {
                              label: "Sales",
                              value: lightspeedDetail.lastSalesSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastSalesSync)}`
                                : "Not synced yet",
                              description: `${formatCount(lightspeedDetail.salesSynced)} records`,
                              tone: lightspeedDetail.lastSalesSync
                                ? "success"
                                : "neutral",
                            },
                            {
                              label: "Products",
                              value: lightspeedDetail.lastProductSync
                                ? `Last synced ${formatRelativeTimestamp(lightspeedDetail.lastProductSync)}`
                                : "Not synced yet",
                              description: `${formatCount(lightspeedDetail.productsSynced)} records`,
                              tone: lightspeedDetail.lastProductSync
                                ? "success"
                                : "neutral",
                            },
                          ]}
                        />
                        <div className="mt-4">
                          <Button
                            type="button"
                            onClick={() => {
                              void detail.triggerLightspeedSync();
                            }}
                            disabled={
                              item.status !== "connected" ||
                              detail.isLightspeedSyncing
                            }
                          >
                            {detail.lightspeedSyncState === "triggering"
                              ? "Starting sync..."
                              : detail.lightspeedSyncState === "syncing"
                                ? "Sync in progress..."
                                : "Trigger Manual Sync"}
                          </Button>
                        </div>
                      </SectionCard>

                      <SectionCard
                        title="Webhook Configuration"
                        description="Lightspeed webhook state as observed from the current account capabilities and delivery telemetry."
                      >
                        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                          Lightspeed webhook support varies by account.
                          BloomSuite treats unsupported webhook APIs as an
                          account capability constraint and continues operating
                          in sync-only mode where needed.
                        </div>
                        <div className="mt-4">
                          <DetailFieldRows
                            rows={[
                              {
                                label: "Webhook Mode",
                                value: lightspeedWebhookMode.label,
                                tone: lightspeedWebhookMode.tone,
                                valueClassName:
                                  lightspeedWebhookMode.valueClassName,
                              },
                              {
                                label: "Registration State",
                                value: lightspeedDetail.webhookRegistered
                                  ? "Registered"
                                  : "Not registered",
                                tone: lightspeedDetail.webhookRegistered
                                  ? "success"
                                  : lightspeedDetail.webhookMode ===
                                      "unavailable"
                                    ? "neutral"
                                    : "warning",
                              },
                              {
                                label: "Last Webhook Received",
                                value: formatRelativePlusAbsolute(
                                  lightspeedDetail.lastWebhookReceivedAt,
                                  "Never",
                                ).value,
                                description: formatRelativePlusAbsolute(
                                  lightspeedDetail.lastWebhookReceivedAt,
                                  "Never",
                                ).description,
                                tone: lightspeedDetail.lastWebhookReceivedAt
                                  ? "success"
                                  : "neutral",
                              },
                              {
                                label: "Last Health Check",
                                value: formatRelativePlusAbsolute(
                                  lightspeedDetail.webhooksLastCheckedAt,
                                  "Never",
                                ).value,
                                description: formatRelativePlusAbsolute(
                                  lightspeedDetail.webhooksLastCheckedAt,
                                  "Never",
                                ).description,
                                tone: lightspeedDetail.webhooksLastCheckedAt
                                  ? "neutral"
                                  : "warning",
                              },
                              {
                                label: "Retry Count",
                                value: String(
                                  lightspeedDetail.webhookRetryCount ?? 0,
                                ),
                                tone:
                                  (lightspeedDetail.webhookRetryCount ?? 0) > 0
                                    ? "warning"
                                    : "neutral",
                              },
                              {
                                label: "Next Retry",
                                value: formatRelativePlusAbsolute(
                                  lightspeedDetail.webhookNextRetryAt,
                                  "—",
                                ).value,
                                description: formatRelativePlusAbsolute(
                                  lightspeedDetail.webhookNextRetryAt,
                                  "—",
                                ).description,
                                tone: lightspeedDetail.webhookNextRetryAt
                                  ? "warning"
                                  : "neutral",
                              },
                              {
                                label: "Last Error",
                                value: lightspeedDetail.webhookLastError ?? "—",
                                tone: lightspeedDetail.webhookLastError
                                  ? lightspeedDetail.webhookMode ===
                                    "unavailable"
                                    ? "neutral"
                                    : "danger"
                                  : "neutral",
                                valueClassName:
                                  lightspeedDetail.webhookLastError
                                    ? lightspeedDetail.webhookMode ===
                                      "unavailable"
                                      ? "text-slate-600"
                                      : "text-rose-700"
                                    : "text-slate-500",
                              },
                            ]}
                          />
                        </div>
                      </SectionCard>

                      <SectionCard
                        title="Data Pipeline"
                        description="BloomSuite uses the Lightspeed customer, sales, and product feeds that are available for this account today."
                      >
                        <DetailFieldRows
                          rows={[
                            {
                              label: "Customer Feed",
                              value: lightspeedDetail.lastCustomerSync
                                ? "Active"
                                : "Pending",
                              tone: lightspeedDetail.lastCustomerSync
                                ? "success"
                                : "warning",
                            },
                            {
                              label: "Sales Feed",
                              value: lightspeedDetail.lastSalesSync
                                ? "Active"
                                : "Pending",
                              tone: lightspeedDetail.lastSalesSync
                                ? "success"
                                : "warning",
                            },
                            {
                              label: "Product Feed",
                              value: lightspeedDetail.lastProductSync
                                ? "Active"
                                : "Pending",
                              tone: lightspeedDetail.lastProductSync
                                ? "success"
                                : "warning",
                            },
                            {
                              label: "Diagnostics",
                              value: "Available",
                              tone: "success",
                            },
                          ]}
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            onClick={() =>
                              navigate(lightspeedDetail.diagnosticsPath)
                            }
                          >
                            Run Diagnostics
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setLightspeedTab("sync-logs")}
                          >
                            Open Sync Logs
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Lightspeed is the least normalized POS integration in
                          the current shell. Diagnostics and sync visibility are
                          real, while webhook behavior depends on account
                          capabilities.
                        </div>
                      </SectionCard>
                    </TabsContent>

                    <TabsContent value="customers" className="space-y-6">
                      <SectionCard
                        title="Customers"
                        description="Tenant-scoped Lightspeed customer rows with search, sorting, quality signals, and CRM linkage."
                      >
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <Input
                            value={customerSearchInput}
                            onChange={(event) => {
                              setCustomerSearchInput(event.target.value);
                              setCustomerPage(1);
                            }}
                            placeholder="Search by name, email, phone, or customer ID"
                            className="max-w-xl bg-white"
                          />
                          <div className="text-sm text-muted-foreground">
                            Showing{" "}
                            {formatCount(
                              lightspeedDashboard?.customers.pagination
                                .totalCount,
                            )}{" "}
                            synced customers
                          </div>
                        </div>

                        {lightspeedDashboard?.customers.rows.length ? (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Customer"
                                      field="name"
                                      activeField={customerSortField}
                                      direction={customerSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            customerSortField,
                                            field,
                                            customerSortDirection,
                                          );
                                        setCustomerSortField(
                                          field as LightspeedCustomerSortField,
                                        );
                                        setCustomerSortDirection(nextDirection);
                                        setCustomerPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>Contact</TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Total spend"
                                      field="total_spend"
                                      activeField={customerSortField}
                                      direction={customerSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            customerSortField,
                                            field,
                                            customerSortDirection,
                                          );
                                        setCustomerSortField(
                                          field as LightspeedCustomerSortField,
                                        );
                                        setCustomerSortDirection(nextDirection);
                                        setCustomerPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Purchases"
                                      field="purchase_count"
                                      activeField={customerSortField}
                                      direction={customerSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            customerSortField,
                                            field,
                                            customerSortDirection,
                                          );
                                        setCustomerSortField(
                                          field as LightspeedCustomerSortField,
                                        );
                                        setCustomerSortDirection(nextDirection);
                                        setCustomerPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Last purchase"
                                      field="last_purchase_date"
                                      activeField={customerSortField}
                                      direction={customerSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            customerSortField,
                                            field,
                                            customerSortDirection,
                                          );
                                        setCustomerSortField(
                                          field as LightspeedCustomerSortField,
                                        );
                                        setCustomerSortDirection(nextDirection);
                                        setCustomerPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>Data quality</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lightspeedDashboard.customers.rows.map(
                                  (customer) => (
                                    <TableRow
                                      key={customer.id}
                                      className="cursor-pointer"
                                      onClick={() =>
                                        setSelectedCustomer(customer)
                                      }
                                    >
                                      <TableCell>
                                        <div className="font-semibold text-slate-950">
                                          {customer.displayName}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          Lightspeed ID{" "}
                                          {customer.lightspeed_customer_id}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          {customer.email ?? "No email"}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {customer.phone ?? "No phone"}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {formatCurrency(customer.total_spend)}
                                      </TableCell>
                                      <TableCell>
                                        {formatCount(customer.purchase_count)}
                                      </TableCell>
                                      <TableCell>
                                        {formatDateValue(
                                          customer.last_purchase_date,
                                          "No purchases yet",
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <LightspeedCustomerQualityBadges
                                          customer={customer}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )}
                              </TableBody>
                            </Table>
                            <LightspeedPaginationBar
                              pagination={
                                lightspeedDashboard.customers.pagination
                              }
                              onPageChange={setCustomerPage}
                            />
                          </>
                        ) : lightspeedDashboard?.customers.isLoading ||
                          lightspeedDashboard?.customers.isFetching ? (
                          <LightspeedTableEmptyState
                            title="Loading customer rows"
                            description="BloomSuite is fetching the latest tenant-scoped Lightspeed customers."
                          />
                        ) : (
                          <LightspeedTableEmptyState
                            title="No customers match this view"
                            description="Adjust the search term or run a manual sync to populate customer records."
                          />
                        )}
                      </SectionCard>

                      <Sheet
                        open={Boolean(selectedCustomer)}
                        onOpenChange={(open) => {
                          if (!open) {
                            setSelectedCustomer(null);
                          }
                        }}
                      >
                        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                          {selectedCustomer ? (
                            <div className="space-y-5">
                              <SheetHeader>
                                <SheetTitle>
                                  {selectedCustomer.displayName}
                                </SheetTitle>
                                <SheetDescription>
                                  Lightspeed customer detail with BloomSuite CRM
                                  linkage.
                                </SheetDescription>
                              </SheetHeader>

                              <KeyValueGrid
                                entries={[
                                  {
                                    label: "Email",
                                    value:
                                      selectedCustomer.email ?? "Not available",
                                  },
                                  {
                                    label: "Phone",
                                    value:
                                      selectedCustomer.phone ?? "Not available",
                                  },
                                  {
                                    label: "Total spend",
                                    value: formatCurrency(
                                      selectedCustomer.total_spend,
                                    ),
                                  },
                                  {
                                    label: "Purchase count",
                                    value: formatCount(
                                      selectedCustomer.purchase_count,
                                    ),
                                  },
                                  {
                                    label: "First purchase",
                                    value: formatDateValue(
                                      selectedCustomer.first_purchase_date,
                                      "Not available",
                                    ),
                                  },
                                  {
                                    label: "Last purchase",
                                    value: formatDateValue(
                                      selectedCustomer.last_purchase_date,
                                      "Not available",
                                    ),
                                  },
                                  {
                                    label: "Synced at",
                                    value: formatDateValue(
                                      selectedCustomer.synced_at,
                                    ),
                                  },
                                  {
                                    label: "Lightspeed ID",
                                    value:
                                      selectedCustomer.lightspeed_customer_id,
                                  },
                                ]}
                              />

                              <div>
                                <div className="mb-2 text-sm font-semibold text-slate-950">
                                  Data quality
                                </div>
                                <LightspeedCustomerQualityBadges
                                  customer={selectedCustomer}
                                />
                              </div>

                              <div className="flex flex-wrap gap-3">
                                {selectedCustomer.contact_id ? (
                                  <Button asChild type="button">
                                    <Link
                                      to={`/crm/customers/${selectedCustomer.contact_id}`}
                                    >
                                      Open CRM Customer
                                    </Link>
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    copyToClipboard(
                                      selectedCustomer.lightspeed_customer_id,
                                      "Lightspeed customer ID",
                                    )
                                  }
                                >
                                  Copy Customer ID
                                </Button>
                              </div>

                              <LightspeedJsonCollapsible
                                title="Raw Lightspeed payload"
                                value={selectedCustomer.raw_data}
                              />
                            </div>
                          ) : null}
                        </SheetContent>
                      </Sheet>
                    </TabsContent>

                    <TabsContent value="sales" className="space-y-6">
                      <SectionCard
                        title="Sales"
                        description="Tenant-scoped Lightspeed sales with filter-aware summary metrics and sale detail."
                      >
                        <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_auto]">
                          <select
                            value={salesStatus}
                            onChange={(event) => {
                              setSalesStatus(event.target.value);
                              setSalesPage(1);
                            }}
                            className="h-10 rounded-xl border border-border/70 bg-white px-3 text-sm"
                          >
                            <option value="all">All statuses</option>
                            <option value="completed">Completed</option>
                            <option value="open">Open</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="refunded">Refunded</option>
                          </select>
                          <Input
                            type="date"
                            value={salesStartDate}
                            onChange={(event) => {
                              setSalesStartDate(event.target.value);
                              setSalesPage(1);
                            }}
                          />
                          <Input
                            type="date"
                            value={salesEndDate}
                            onChange={(event) => {
                              setSalesEndDate(event.target.value);
                              setSalesPage(1);
                            }}
                          />
                          <div className="flex justify-start lg:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSalesStatus("all");
                                setSalesStartDate("");
                                setSalesEndDate("");
                                setSalesPage(1);
                              }}
                            >
                              Clear filters
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Revenue
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {formatCurrency(
                                lightspeedDashboard?.sales.summary.revenue,
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Average order value
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {formatCurrency(
                                lightspeedDashboard?.sales.summary
                                  .averageOrderValue,
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Sale count
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-950">
                              {formatCount(
                                lightspeedDashboard?.sales.summary.saleCount,
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          {lightspeedDashboard?.sales.rows.length ? (
                            <>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>
                                      <LightspeedSortButton
                                        label="Sale date"
                                        field="sale_date"
                                        activeField={salesSortField}
                                        direction={salesSortDirection}
                                        onToggle={(field) => {
                                          const nextDirection =
                                            getNextSortDirection(
                                              salesSortField,
                                              field,
                                              salesSortDirection,
                                            );
                                          setSalesSortField(
                                            field as LightspeedSalesSortField,
                                          );
                                          setSalesSortDirection(nextDirection);
                                          setSalesPage(1);
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>
                                      <LightspeedSortButton
                                        label="Total"
                                        field="total_amount"
                                        activeField={salesSortField}
                                        direction={salesSortDirection}
                                        onToggle={(field) => {
                                          const nextDirection =
                                            getNextSortDirection(
                                              salesSortField,
                                              field,
                                              salesSortDirection,
                                            );
                                          setSalesSortField(
                                            field as LightspeedSalesSortField,
                                          );
                                          setSalesSortDirection(nextDirection);
                                          setSalesPage(1);
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Line items</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {lightspeedDashboard.sales.rows.map(
                                    (sale) => (
                                      <TableRow
                                        key={sale.id}
                                        className="cursor-pointer"
                                        onClick={() => setSelectedSale(sale)}
                                      >
                                        <TableCell>
                                          <div className="font-semibold text-slate-950">
                                            {formatDateValue(sale.sale_date)}
                                          </div>
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            Sale ID {sale.lightspeed_sale_id}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                                            {sale.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrency(sale.total_amount)}
                                        </TableCell>
                                        <TableCell>
                                          {sale.payment_method ??
                                            "Not available"}
                                        </TableCell>
                                        <TableCell>
                                          {Array.isArray(sale.line_items)
                                            ? sale.line_items.length
                                            : 0}
                                        </TableCell>
                                      </TableRow>
                                    ),
                                  )}
                                </TableBody>
                              </Table>
                              <LightspeedPaginationBar
                                pagination={
                                  lightspeedDashboard.sales.pagination
                                }
                                onPageChange={setSalesPage}
                              />
                            </>
                          ) : lightspeedDashboard?.sales.isLoading ||
                            lightspeedDashboard?.sales.isFetching ? (
                            <LightspeedTableEmptyState
                              title="Loading sales rows"
                              description="BloomSuite is fetching tenant-scoped Lightspeed sales for the current filters."
                            />
                          ) : (
                            <LightspeedTableEmptyState
                              title="No sales match this filter set"
                              description="Adjust the status or date range filters, or run a manual sync to populate sales data."
                            />
                          )}
                        </div>
                      </SectionCard>

                      <Sheet
                        open={Boolean(selectedSale)}
                        onOpenChange={(open) => {
                          if (!open) {
                            setSelectedSale(null);
                          }
                        }}
                      >
                        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                          {selectedSale ? (
                            <div className="space-y-5">
                              <SheetHeader>
                                <SheetTitle>
                                  Sale {selectedSale.lightspeed_sale_id}
                                </SheetTitle>
                                <SheetDescription>
                                  Filtered sale detail for the current
                                  Lightspeed tenant.
                                </SheetDescription>
                              </SheetHeader>
                              <KeyValueGrid
                                entries={[
                                  {
                                    label: "Sale date",
                                    value: formatDateValue(
                                      selectedSale.sale_date,
                                    ),
                                  },
                                  {
                                    label: "Status",
                                    value: selectedSale.status,
                                  },
                                  {
                                    label: "Total amount",
                                    value: formatCurrency(
                                      selectedSale.total_amount,
                                    ),
                                  },
                                  {
                                    label: "Payment method",
                                    value:
                                      selectedSale.payment_method ??
                                      "Not available",
                                  },
                                  {
                                    label: "Line items",
                                    value: String(
                                      Array.isArray(selectedSale.line_items)
                                        ? selectedSale.line_items.length
                                        : 0,
                                    ),
                                  },
                                  {
                                    label: "Synced at",
                                    value: formatDateValue(
                                      selectedSale.synced_at,
                                    ),
                                  },
                                ]}
                              />
                              <div className="flex flex-wrap gap-3">
                                {selectedSale.contact_id ? (
                                  <Button asChild type="button">
                                    <Link
                                      to={`/crm/customers/${selectedSale.contact_id}`}
                                    >
                                      Open CRM Customer
                                    </Link>
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    copyToClipboard(
                                      selectedSale.lightspeed_sale_id,
                                      "Lightspeed sale ID",
                                    )
                                  }
                                >
                                  Copy Sale ID
                                </Button>
                              </div>
                              {selectedSale.note ? (
                                <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4 text-sm text-slate-700">
                                  <div className="mb-2 font-semibold text-slate-950">
                                    Note
                                  </div>
                                  <p className="leading-6">
                                    {selectedSale.note}
                                  </p>
                                </div>
                              ) : null}
                              <LightspeedJsonCollapsible
                                title="Line items"
                                value={selectedSale.line_items}
                              />
                              <LightspeedJsonCollapsible
                                title="Raw sale payload"
                                value={selectedSale.raw_data}
                              />
                            </div>
                          ) : null}
                        </SheetContent>
                      </Sheet>
                    </TabsContent>

                    <TabsContent value="products" className="space-y-6">
                      <SectionCard
                        title="Products"
                        description="Tenant-scoped Lightspeed catalog data with stock-aware filtering and inventory cues."
                      >
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <select
                              value={productsCategory}
                              onChange={(event) => {
                                setProductsCategory(event.target.value);
                                setProductsPage(1);
                              }}
                              className="h-10 rounded-xl border border-border/70 bg-white px-3 text-sm"
                            >
                              <option value="all">All categories</option>
                              {(
                                lightspeedDashboard?.products.categories ?? []
                              ).map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant={
                                productsInStockOnly ? "default" : "outline"
                              }
                              onClick={() => {
                                setProductsInStockOnly((current) => !current);
                                setProductsPage(1);
                              }}
                            >
                              {productsInStockOnly
                                ? "Showing in-stock only"
                                : "Filter to in-stock"}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCount(
                              lightspeedDashboard?.products.pagination
                                .totalCount,
                            )}{" "}
                            products in view
                          </div>
                        </div>

                        {lightspeedDashboard?.products.rows.length ? (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Product"
                                      field="name"
                                      activeField={productsSortField}
                                      direction={productsSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            productsSortField,
                                            field,
                                            productsSortDirection,
                                          );
                                        setProductsSortField(
                                          field as LightspeedProductsSortField,
                                        );
                                        setProductsSortDirection(nextDirection);
                                        setProductsPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Category"
                                      field="category"
                                      activeField={productsSortField}
                                      direction={productsSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            productsSortField,
                                            field,
                                            productsSortDirection,
                                          );
                                        setProductsSortField(
                                          field as LightspeedProductsSortField,
                                        );
                                        setProductsSortDirection(nextDirection);
                                        setProductsPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Inventory"
                                      field="inventory_count"
                                      activeField={productsSortField}
                                      direction={productsSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            productsSortField,
                                            field,
                                            productsSortDirection,
                                          );
                                        setProductsSortField(
                                          field as LightspeedProductsSortField,
                                        );
                                        setProductsSortDirection(nextDirection);
                                        setProductsPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>
                                    <LightspeedSortButton
                                      label="Price"
                                      field="price"
                                      activeField={productsSortField}
                                      direction={productsSortDirection}
                                      onToggle={(field) => {
                                        const nextDirection =
                                          getNextSortDirection(
                                            productsSortField,
                                            field,
                                            productsSortDirection,
                                          );
                                        setProductsSortField(
                                          field as LightspeedProductsSortField,
                                        );
                                        setProductsSortDirection(nextDirection);
                                        setProductsPage(1);
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead>Stock state</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lightspeedDashboard.products.rows.map(
                                  (product) => (
                                    <TableRow key={product.id}>
                                      <TableCell>
                                        <div className="font-semibold text-slate-950">
                                          {product.name}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {product.sku ?? "No SKU"}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {product.category ?? "Uncategorized"}
                                      </TableCell>
                                      <TableCell>
                                        {formatCount(product.inventory_count)}
                                      </TableCell>
                                      <TableCell>
                                        {formatCurrency(product.price)}
                                      </TableCell>
                                      <TableCell>
                                        <LightspeedProductStockBadge
                                          product={product}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )}
                              </TableBody>
                            </Table>
                            <LightspeedPaginationBar
                              pagination={
                                lightspeedDashboard.products.pagination
                              }
                              onPageChange={setProductsPage}
                            />
                          </>
                        ) : lightspeedDashboard?.products.isLoading ||
                          lightspeedDashboard?.products.isFetching ? (
                          <LightspeedTableEmptyState
                            title="Loading products"
                            description="BloomSuite is fetching Lightspeed catalog rows for the active tenant."
                          />
                        ) : (
                          <LightspeedTableEmptyState
                            title="No products match this view"
                            description="Adjust the category or in-stock filter, or run a manual sync to refresh catalog rows."
                          />
                        )}
                      </SectionCard>
                    </TabsContent>

                    <TabsContent value="sync-logs" className="space-y-6">
                      <SectionCard
                        title="Sync Logs"
                        description="Historical Lightspeed sync jobs, with live updates for in-progress work and expanded failure detail."
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-muted-foreground">
                            {formatCount(
                              lightspeedDashboard?.syncLogs.pagination
                                .totalCount,
                            )}{" "}
                            job rows available for this tenant.
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              void detail.triggerLightspeedSync();
                            }}
                            disabled={detail.isLightspeedSyncing}
                          >
                            {detail.isLightspeedSyncing
                              ? "Sync in progress..."
                              : "Trigger Manual Sync"}
                          </Button>
                        </div>

                        {lightspeedDashboard?.syncLogs.rows.length ? (
                          <div className="space-y-3">
                            {lightspeedDashboard.syncLogs.rows.map((job) => {
                              const isExpanded = expandedSyncLogId === job.id;
                              const statusLabel = formatLightspeedSyncStatus(
                                job.status,
                                job.isStale,
                              );

                              return (
                                <div
                                  key={job.id}
                                  className="rounded-2xl border border-border/70 bg-white/90 p-4"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                          className={statusLabel.className}
                                        >
                                          {statusLabel.label}
                                        </Badge>
                                        <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                                          {formatLightspeedSyncTypeLabel(
                                            job.normalizedSyncType,
                                          )}
                                        </Badge>
                                        {job.isStale ? (
                                          <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                                            No recent worker update
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <div className="text-sm font-semibold text-slate-950">
                                        {job.progress_message ||
                                          "No progress message recorded."}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Created{" "}
                                        {formatRelativeTimestamp(
                                          job.created_at,
                                        )}{" "}
                                        · Updated{" "}
                                        {formatRelativeTimestamp(
                                          job.updated_at,
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:min-w-[20rem]">
                                      <div>Progress {job.progressPercent}%</div>
                                      <div>
                                        Processed{" "}
                                        {formatCount(job.processed_rows)}
                                      </div>
                                      <div>
                                        Inserted{" "}
                                        {formatCount(job.inserted_rows)}
                                      </div>
                                      <div>
                                        Failed {formatCount(job.failed_rows)}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-300",
                                        job.status === "failed" ||
                                          job.status === "cancelled"
                                          ? "bg-rose-500"
                                          : job.isStale
                                            ? "bg-amber-500"
                                            : "bg-brand-teal",
                                      )}
                                      style={{
                                        width: `${job.progressPercent}%`,
                                      }}
                                    />
                                  </div>

                                  <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        setExpandedSyncLogId((current) =>
                                          current === job.id ? null : job.id,
                                        )
                                      }
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                      {isExpanded
                                        ? "Hide details"
                                        : "Show details"}
                                    </Button>
                                    {(job.status === "failed" ||
                                      job.status === "cancelled") && (
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          void detail.triggerLightspeedSync();
                                        }}
                                        disabled={detail.isLightspeedSyncing}
                                      >
                                        Retry via Manual Sync
                                      </Button>
                                    )}
                                  </div>

                                  {isExpanded ? (
                                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                                      <KeyValueGrid
                                        entries={[
                                          {
                                            label: "Attempts",
                                            value: String(job.attempts),
                                          },
                                          {
                                            label: "Error count",
                                            value: String(job.error_count),
                                          },
                                          {
                                            label: "Next retry",
                                            value: formatDateValue(
                                              job.next_retry_at,
                                              "No retry scheduled",
                                            ),
                                          },
                                          {
                                            label: "Last failure",
                                            value: formatDateValue(
                                              job.last_failure_at,
                                              "No failure timestamp",
                                            ),
                                          },
                                          {
                                            label: "Current page",
                                            value: String(job.current_page),
                                          },
                                          {
                                            label: "Estimated pages",
                                            value: String(
                                              job.total_pages_est ?? 0,
                                            ),
                                          },
                                        ]}
                                      />
                                      <div className="space-y-4">
                                        <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4 text-sm text-slate-700">
                                          <div className="mb-2 font-semibold text-slate-950">
                                            Failure context
                                          </div>
                                          <p className="leading-6">
                                            {job.last_error ??
                                              "No error message stored for this job."}
                                          </p>
                                        </div>
                                        <LightspeedJsonCollapsible
                                          title="Job metadata"
                                          value={job.metadata}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                            <LightspeedPaginationBar
                              pagination={
                                lightspeedDashboard.syncLogs.pagination
                              }
                              onPageChange={setSyncLogsPage}
                            />
                          </div>
                        ) : lightspeedDashboard?.syncLogs.isLoading ||
                          lightspeedDashboard?.syncLogs.isFetching ? (
                          <LightspeedTableEmptyState
                            title="Loading sync logs"
                            description="BloomSuite is fetching Lightspeed sync history and merging live worker updates."
                          />
                        ) : (
                          <LightspeedTableEmptyState
                            title="No sync jobs yet"
                            description="Trigger a manual sync to populate Lightspeed job history for this tenant."
                          />
                        )}
                      </SectionCard>
                    </TabsContent>
                  </Tabs>
                </>
              ) : isMeta && metaDetail ? (
                <>
                  <SectionCard
                    title="Meta Authorization"
                    description="Authorization state and connected asset summary for the shared Meta OAuth flow."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "Authorization Status",
                          value: metaDetail.authorizationLabel,
                          tone: metaAuthorizationState.tone,
                          valueClassName: metaAuthorizationState.valueClassName,
                        },
                        {
                          label: "Connected Assets",
                          value: String(metaDetail.connectedAssetCount),
                          description: metaDetail.platformSummary,
                          tone:
                            metaDetail.connectedAssetCount > 0
                              ? "success"
                              : "neutral",
                        },
                        {
                          label: "Connected Platforms",
                          value:
                            metaDetail.connectedPlatforms.length > 0
                              ? metaDetail.connectedPlatforms
                                  .map(
                                    (platform) =>
                                      platform.charAt(0).toUpperCase() +
                                      platform.slice(1),
                                  )
                                  .join(" + ")
                              : "None",
                        },
                        {
                          label: "Connected Since",
                          value: formatTimestampOrFallback(
                            metaDetail.connectedAt,
                            "Not connected",
                          ),
                        },
                        {
                          label: "Authorization Expires",
                          value: formatRelativePlusAbsolute(
                            metaDetail.expiresAt,
                            metaDetail.authorizationStatus === "not-connected"
                              ? "Authorization required"
                              : "No expiry reported",
                          ).value,
                          description: formatRelativePlusAbsolute(
                            metaDetail.expiresAt,
                            metaDetail.authorizationStatus === "not-connected"
                              ? "Authorization required"
                              : "No expiry reported",
                          ).description,
                          tone:
                            metaDetail.authorizationStatus === "authorized"
                              ? "success"
                              : metaDetail.authorizationStatus === "expired"
                                ? "warning"
                                : "neutral",
                        },
                      ]}
                    />
                    <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Authorization summary
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {metaDetail.authorizationSummary}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {metaDetail.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={() => {
                            void detail.triggerMetaReauthorization();
                          }}
                          disabled={detail.isMetaReauthorizing}
                        >
                          {detail.isMetaReauthorizing
                            ? "Opening authorization..."
                            : metaDetail.authorizationStatus === "not-connected"
                              ? "Authorize Meta"
                              : "Re-authorize Meta"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(metaDetail.managementPath)}
                        >
                          Open Social Accounts
                        </Button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Facebook Pages"
                    description="Stored Facebook Page assets connected through the current Meta authorization."
                  >
                    <MetaAssetList
                      assets={metaDetail.facebookPages}
                      emptyMessage="No Facebook Pages are connected for this account yet."
                      onCopy={copyToClipboard}
                      onOpen={() => navigate(metaDetail.managementPath)}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Instagram Accounts"
                    description="Stored Instagram Business assets available from the current Meta authorization."
                  >
                    <MetaAssetList
                      assets={metaDetail.instagramAccounts}
                      emptyMessage="No Instagram Business accounts are connected for this account yet."
                      onCopy={copyToClipboard}
                      onOpen={() => navigate(metaDetail.managementPath)}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Publishing & Analytics Capabilities"
                    description="Capability summary based on the current Meta OAuth flow and existing activity surfaces in the repo."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "Publishing Access",
                          value:
                            metaDetail.authorizationStatus === "authorized"
                              ? "Available"
                              : metaDetail.authorizationStatus === "expired"
                                ? "Reauthorization required"
                                : "Not connected",
                          tone:
                            metaDetail.authorizationStatus === "authorized"
                              ? "success"
                              : metaDetail.authorizationStatus === "expired"
                                ? "warning"
                                : "neutral",
                        },
                        {
                          label: "Facebook Page Discovery",
                          value:
                            metaDetail.facebookPageCount > 0
                              ? "Available"
                              : "Pending",
                          tone:
                            metaDetail.facebookPageCount > 0
                              ? "success"
                              : "neutral",
                        },
                        {
                          label: "Instagram Account Discovery",
                          value:
                            metaDetail.instagramAccountCount > 0
                              ? "Available"
                              : "Pending",
                          tone:
                            metaDetail.instagramAccountCount > 0
                              ? "success"
                              : "neutral",
                        },
                        {
                          label: "Publishing Logs",
                          value: "Activity Center",
                          description:
                            "Meta publishing activity is routed through the shared Activity Center filters available in this repo today.",
                          tone: "success",
                        },
                      ]}
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => navigate(metaDetail.syncLogsPath)}
                      >
                        View Publishing Logs
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(metaDetail.managementPath)}
                      >
                        Manage Social Accounts
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      BloomSuite currently stores Meta-connected assets and
                      routes publishing visibility through shared activity
                      tooling. This page does not expose token values or hidden
                      provider credentials.
                    </div>
                  </SectionCard>
                </>
              ) : isGa4 && ga4Detail ? (
                <>
                  <SectionCard
                    title="Property Details"
                    description="Stored GA4 property settings and the current connection state available in BloomSuite today."
                  >
                    <DetailFieldRows
                      onCopy={copyToClipboard}
                      rows={[
                        {
                          label: "Property ID",
                          value: ga4Detail.propertyId ?? "Not configured",
                          copyValue: ga4Detail.propertyId,
                          copyLabel: "Property ID",
                        },
                        {
                          label: "Connection Status",
                          value: ga4ConnectionState.label,
                          description: ga4ConnectionState.subtitle,
                          tone: ga4ConnectionState.tone,
                          valueClassName: ga4ConnectionState.valueClassName,
                        },
                        {
                          label: "Connected Since",
                          value: formatTimestampOrFallback(
                            ga4Detail.connectedAt,
                            "Not connected",
                          ),
                        },
                        {
                          label: "Last Tested",
                          value: formatRelativePlusAbsolute(
                            ga4Detail.lastTestAt,
                            "Not tested",
                          ).value,
                          description: formatRelativePlusAbsolute(
                            ga4Detail.lastTestAt,
                            "Not tested",
                          ).description,
                          tone: ga4Detail.lastTestAt ? "neutral" : "warning",
                        },
                        {
                          label: "Service Account",
                          value: ga4Detail.serviceAccountConfigured
                            ? "Configured"
                            : "Not configured",
                          description: ga4Detail.serviceAccountConfigured
                            ? "Reporting calls can use the existing configured service account path."
                            : "The repo still flags service-account setup as incomplete for this property.",
                          tone: ga4Detail.serviceAccountConfigured
                            ? "success"
                            : "warning",
                        },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Reporting Capabilities"
                    description="Current reporting surfaces already implemented for the Website integrations area."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "Website Reporting Dashboard",
                          value: ga4Detail.propertyId
                            ? "Available"
                            : "Setup required",
                          description: ga4Detail.reportingSummary,
                          tone: ga4Detail.propertyId ? "success" : "warning",
                        },
                        {
                          label: "Traffic Metrics",
                          value: ga4Detail.propertyId
                            ? "Available"
                            : "Unavailable",
                          description:
                            "The existing dashboard already reports users, page views, sessions, countries, and device types.",
                          tone: ga4Detail.propertyId ? "success" : "neutral",
                        },
                        {
                          label: "Live Sync",
                          value: "Not applicable",
                          description:
                            "Google Analytics detail pages expose reporting access rather than a CRM sync pipeline.",
                          tone: "neutral",
                        },
                      ]}
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => navigate(ga4Detail.reportingPath)}
                      >
                        View Reporting Dashboard
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(ga4Detail.managementPath)}
                      >
                        Open Website Integrations
                      </Button>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Connection Actions"
                    description="Use the existing repo-supported GA4 flows instead of introducing new endpoints or token handling."
                  >
                    <div className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <Button
                        type="button"
                        className="w-full justify-between"
                        disabled={
                          !ga4Detail.propertyId ||
                          ga4Detail.connectionStatus !== "connected" ||
                          detail.isGa4ConnectionTesting
                        }
                        onClick={() => {
                          void detail.triggerGa4ConnectionTest();
                        }}
                      >
                        {detail.isGa4ConnectionTesting
                          ? "Testing connection..."
                          : "Test Connection"}
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        disabled={
                          !ga4Detail.propertyId || detail.isGa4Reauthorizing
                        }
                        onClick={() => {
                          void detail.triggerGa4Reauthorization();
                        }}
                      >
                        {detail.isGa4Reauthorizing
                          ? "Opening Google authorization..."
                          : "Re-authorize Google Analytics"}
                        <PlugZap className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => navigate(ga4Detail.reportingPath)}
                      >
                        View Reporting Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </SectionCard>
                </>
              ) : isMarketingImport && marketingImportDetail ? (
                <>
                  <SectionCard
                    title="Connection Details"
                    description="Provider account metadata and import-scoped connection state stored for this marketing source."
                  >
                    <DetailFieldRows
                      onCopy={copyToClipboard}
                      rows={[
                        {
                          label: "Provider",
                          value: marketingImportDetail.providerLabel,
                        },
                        {
                          label: "Connection Status",
                          value: marketingImportState.label,
                          description: marketingImportState.subtitle,
                          tone: marketingImportState.tone,
                          valueClassName: marketingImportState.valueClassName,
                        },
                        {
                          label: "Account Name",
                          value:
                            marketingImportDetail.accountName ??
                            "Not connected yet",
                        },
                        {
                          label: "Account ID",
                          value:
                            marketingImportDetail.accountId ?? "Not available",
                          copyValue: marketingImportDetail.accountId,
                          copyLabel: "Account ID",
                        },
                        {
                          label: "Contact Email",
                          value:
                            marketingImportDetail.contactEmail ??
                            "Not available",
                        },
                        {
                          label: "Connected Since",
                          value: formatTimestampOrFallback(
                            marketingImportDetail.connectedAt,
                            "Not connected",
                          ),
                        },
                        {
                          label: "Token Expiry",
                          value: formatRelativePlusAbsolute(
                            marketingImportDetail.tokenExpiresAt,
                            "No expiry reported",
                          ).value,
                          description: formatRelativePlusAbsolute(
                            marketingImportDetail.tokenExpiresAt,
                            "No expiry reported",
                          ).description,
                          tone: marketingImportDetail.tokenExpiresAt
                            ? "neutral"
                            : "warning",
                        },
                      ]}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Import Capabilities"
                    description="This integration supports one-time contact imports and intentionally does not enable live CRM sync."
                  >
                    <DetailFieldRows
                      rows={[
                        {
                          label: "Purpose",
                          value: marketingImportDetail.purposeLabel,
                          tone: "warning",
                          valueClassName: "text-amber-700",
                        },
                        {
                          label: "Live Sync",
                          value: marketingImportDetail.liveSyncLabel,
                          tone: "neutral",
                          valueClassName: "text-slate-600",
                        },
                        {
                          label: "Lists Discovered",
                          value: formatCount(marketingImportDetail.listCount),
                          description:
                            marketingImportDetail.listCount > 0
                              ? "Provider artifacts from prior previews are stored for reuse."
                              : "Preview lists to cache provider list metadata.",
                          tone:
                            marketingImportDetail.listCount > 0
                              ? "success"
                              : "neutral",
                        },
                        {
                          label: "Segments Discovered",
                          value: formatCount(
                            marketingImportDetail.segmentCount,
                          ),
                          description:
                            marketingImportDetail.segmentCount > 0
                              ? "Saved segment artifacts are available for import review."
                              : "Some providers will only expose segments after list preview.",
                          tone:
                            marketingImportDetail.segmentCount > 0
                              ? "success"
                              : "neutral",
                        },
                        {
                          label: "Latest Import",
                          value:
                            marketingImportDetail.latestImportStatus ??
                            "No import job yet",
                          description:
                            marketingImportDetail.latestImportSummary,
                          tone: marketingImportDetail.latestImportId
                            ? "neutral"
                            : "warning",
                        },
                      ]}
                    />
                    <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Available capabilities
                      </div>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {marketingImportDetail.capabilities.map(
                          (capability) => (
                            <div
                              key={capability}
                              className="flex items-start gap-2"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{capability}</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Import Actions"
                    description="Use the existing migration wizard to preview provider data and start one-time imports."
                  >
                    <div className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                      <Button
                        type="button"
                        className="w-full justify-between"
                        onClick={() =>
                          navigate(marketingImportDetail.importFlowPath)
                        }
                      >
                        Open Import Flow
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() =>
                          navigate(marketingImportDetail.previewListsPath)
                        }
                      >
                        Preview Lists
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </SectionCard>
                </>
              ) : (
                <>
                  <SectionCard
                    title="Configuration"
                    description="Provider-specific controls will plug into this shared shell in later milestones."
                  >
                    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        {model.configurationHint}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {item.status === "coming-soon" ? (
                          <Button
                            type="button"
                            onClick={() => {
                              window.location.href = `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(item.name)}`;
                            }}
                          >
                            <MailPlus className="mr-2 h-4 w-4" />
                            Request integration
                          </Button>
                        ) : detail.targetPath ? (
                          <Button
                            type="button"
                            onClick={() => navigate(detail.targetPath)}
                          >
                            {item.detailActionLabel ?? "Open integration"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate("/integrations")}
                        >
                          Return to hub
                        </Button>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Activity Placeholder"
                    description="This panel reserves space for provider-specific activity and diagnostics."
                  >
                    <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/70 p-4">
                      <p className="text-sm leading-6 text-muted-foreground">
                        {model.activityHint}
                      </p>
                    </div>
                  </SectionCard>
                </>
              )}

              <SectionCard
                title="Danger Zone"
                description={
                  isSquare
                    ? "Disconnect Square using the current repo-supported flow for removing the stored connection."
                    : isMeta
                      ? "Disconnect Meta by removing the stored Facebook and Instagram connections for this account."
                      : isClover
                        ? "Disconnect Clover using the existing repo-supported flow for removing the stored connection."
                        : isLightspeed
                          ? "Disconnect Lightspeed using the existing repo-supported flow for removing the stored connection."
                          : isGa4
                            ? "Disconnect Google Analytics by removing the stored property connection for this user."
                            : isMarketingImport && marketingImportDetail
                              ? `Disconnect ${marketingImportDetail.providerLabel} by revoking the stored import connection for this user.`
                              : "Destructive actions are gated until provider-specific controls are available."
                }
              >
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-rose-900">
                        {isMeta
                          ? "Disconnect Meta"
                          : isClover
                            ? "Disconnect Clover"
                            : isLightspeed
                              ? "Disconnect Lightspeed"
                              : isGa4
                                ? "Disconnect Google Analytics"
                                : isMarketingImport && marketingImportDetail
                                  ? `Disconnect ${marketingImportDetail.providerLabel}`
                                  : (model.disconnectTitle ??
                                    "No destructive action available")}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-rose-800/80">
                        {isMeta
                          ? detail.canDisconnect
                            ? "Disconnecting Meta will remove the stored Facebook Page and Instagram account connections from BloomSuite. Existing CRM data is not deleted, and Meta can be re-authorized later."
                            : "No stored Meta connections are currently available to remove from this page."
                          : isClover
                            ? "Disconnecting Clover will stop all sync and real-time event processing and remove your Clover credentials from BloomSuite. Your existing CRM data is not deleted."
                            : isLightspeed
                              ? "Disconnecting Lightspeed will stop sync and any available webhook processing and remove your Lightspeed credentials from BloomSuite. Your existing CRM data is not deleted."
                              : isGa4
                                ? "Disconnecting Google Analytics will remove the stored GA4 property settings from BloomSuite. Existing reporting views remain available after you reconnect."
                                : isMarketingImport && marketingImportDetail
                                  ? `Disconnecting ${marketingImportDetail.providerLabel} will revoke the stored import connection and stop future list previews or contact imports until it is connected again.`
                                  : model.canDisconnect
                                    ? model.disconnectDescription
                                    : isSquare
                                      ? "Only site admins can remove the stored Square connection from this page."
                                      : isLightspeed
                                        ? "Only site admins can remove the stored Lightspeed connection from this page."
                                        : item.isManagedInfrastructure
                                          ? "This integration is managed through settings and cannot be disconnected from the shell."
                                          : "Disconnect actions will appear here when this integration supports them."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!detail.canDisconnect}
                      onClick={() => setDisconnectOpen(true)}
                    >
                      {isMeta
                        ? "Disconnect Meta"
                        : isClover
                          ? "Disconnect Clover"
                          : isLightspeed
                            ? "Disconnect Lightspeed"
                            : isGa4
                              ? "Disconnect Google Analytics"
                              : isMarketingImport && marketingImportDetail
                                ? `Disconnect ${marketingImportDetail.providerLabel}`
                                : "Disconnect"}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isMeta
                  ? "Disconnect Meta?"
                  : isClover
                    ? "Disconnect Clover?"
                    : isLightspeed
                      ? "Disconnect Lightspeed?"
                      : isGa4
                        ? "Disconnect Google Analytics?"
                        : isMarketingImport && marketingImportDetail
                          ? `Disconnect ${marketingImportDetail.providerLabel}?`
                          : (model.disconnectTitle ??
                            "Disconnect integration?")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isMeta
                  ? "Disconnecting Meta will remove the stored Facebook Page and Instagram account connections from BloomSuite. Existing CRM data is not deleted, and Meta can be re-authorized later."
                  : isClover
                    ? "Disconnecting Clover will stop all sync and real-time event processing and remove your Clover credentials from BloomSuite. Your existing CRM data is not deleted."
                    : isLightspeed
                      ? "Disconnecting Lightspeed will stop sync and any available webhook processing and remove your Lightspeed credentials from BloomSuite. Your existing CRM data is not deleted."
                      : isGa4
                        ? "Disconnecting Google Analytics will remove the stored GA4 property settings from BloomSuite. Existing reporting views remain available after you reconnect."
                        : isMarketingImport && marketingImportDetail
                          ? `Disconnecting ${marketingImportDetail.providerLabel} will revoke the stored import connection and stop future list previews or contact imports until it is connected again.`
                          : (model.disconnectDescription ??
                            `Disconnecting ${item.name} will stop future syncing until it is connected again.`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={detail.isDisconnecting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void detail.disconnect().then(() => setDisconnectOpen(false));
                }}
                disabled={detail.isDisconnecting}
              >
                {detail.isDisconnecting
                  ? "Disconnecting..."
                  : isSquare
                    ? "Remove Square connection"
                    : isMeta
                      ? "Remove Meta connection"
                      : isClover
                        ? "Remove Clover connection"
                        : isLightspeed
                          ? "Remove Lightspeed connection"
                          : isGa4
                            ? "Remove Google Analytics connection"
                            : isMarketingImport && marketingImportDetail
                              ? `Remove ${marketingImportDetail.providerLabel} connection`
                              : "Confirm disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
