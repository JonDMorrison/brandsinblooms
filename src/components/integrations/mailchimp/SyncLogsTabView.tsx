import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  ScrollText,
} from "lucide-react";

import {
  DataTabEmptyState,
  StatusFilterPills,
  formatCount,
  formatDateTimeValue,
  formatDuration,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";
import {
  type MailchimpSyncLogEntry,
  type MailchimpSyncLogsDatePreset,
  type MailchimpSyncLogsStatusFilter,
  useMailchimpSyncLogs,
} from "@/hooks/useMailchimpSyncLogs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Paused", value: "paused" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
] satisfies Array<{ label: string; value: MailchimpSyncLogsStatusFilter }>;

const DATE_PRESET_OPTIONS = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" },
] satisfies Array<{ label: string; value: MailchimpSyncLogsDatePreset }>;

function getStatusBadgeClass(status: MailchimpSyncLogEntry["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "running") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (status === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getStatusLabel(status: MailchimpSyncLogEntry["status"]) {
  if (status === "running") {
    return "In Progress";
  }

  if (status === "failed") {
    return "Needs Attention";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getProgressBarClass(status: MailchimpSyncLogEntry["status"]) {
  if (status === "failed") {
    return "bg-rose-500";
  }

  if (status === "completed") {
    return "bg-emerald-500";
  }

  if (status === "pending" || status === "paused" || status === "cancelled") {
    return "bg-slate-400";
  }

  return "bg-sky-500";
}

function formatDurationLabel(entry: MailchimpSyncLogEntry) {
  if (entry.status === "completed" || entry.status === "failed") {
    return (
      formatDuration(entry.createdAt, entry.completedAt ?? entry.updatedAt) ??
      "—"
    );
  }

  return formatDuration(entry.createdAt, new Date().toISOString()) ?? "—";
}

function downloadReport(entry: MailchimpSyncLogEntry) {
  const payload = {
    jobId: entry.id,
    status: entry.status,
    generatedAt: new Date().toISOString(),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    completedAt: entry.completedAt,
    report: entry.report,
    reportSummary: entry.reportSummary,
    batchStats: entry.batchStats,
    errorDetails: entry.errorDetails,
    configEntries: entry.configEntries,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mailchimp-sync-report-${entry.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "danger" ? "text-rose-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function TimelineDot({
  state,
}: {
  state: MailchimpSyncLogEntry["timeline"][number]["state"];
}) {
  return (
    <span
      className={cn(
        "mt-1.5 block h-2.5 w-2.5 rounded-full",
        state === "complete" && "bg-emerald-500",
        state === "current" && "bg-sky-500",
        state === "failed" && "bg-rose-500",
        state === "pending" && "bg-slate-300",
      )}
    />
  );
}

function JobCard({
  entry,
  isExpanded,
}: {
  entry: MailchimpSyncLogEntry;
  isExpanded: boolean;
}) {
  const progressValue = Math.max(0, Math.min(100, entry.progressPercentage));

  return (
    <AccordionItem
      value={entry.id}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <div className="flex w-full flex-col gap-4 text-left lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className={getStatusBadgeClass(entry.status)}>
                {getStatusLabel(entry.status)}
              </Badge>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-600"
              >
                {entry.scopeSummary}
              </Badge>
              {entry.status === "running" ? (
                <span className="text-xs font-medium text-sky-700">Live</span>
              ) : null}
              {entry.errorCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {entry.errorCount} issue{entry.errorCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                label="Started"
                value={formatDateTimeValue(entry.createdAt)}
              />
              <SummaryMetric
                label="Duration"
                value={formatDurationLabel(entry)}
              />
              <SummaryMetric
                label="Imported"
                value={formatCount(entry.insertedRows)}
              />
              <SummaryMetric
                label="Skipped / Failed"
                value={`${formatCount(entry.skippedRows)} / ${formatCount(entry.failedRows)}`}
                tone={entry.failedRows > 0 ? "danger" : "default"}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{entry.currentStage}</span>
                <span>{progressValue}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    getProgressBarClass(entry.status),
                  )}
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex min-w-[12rem] shrink-0 flex-col items-start gap-1 text-xs text-slate-500 lg:items-end">
            <span>Created {formatRelativeTimestamp(entry.createdAt)}</span>
            <span>Updated {formatRelativeTimestamp(entry.updatedAt)}</span>
            {entry.completedAt ? (
              <span>Finished {formatRelativeTimestamp(entry.completedAt)}</span>
            ) : null}
            {isExpanded ? (
              <span className="font-medium text-slate-700">Details open</span>
            ) : null}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-5 pb-5 pt-0">
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <DetailSection title="Selected audience">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Lists
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.resolvedLists.length > 0 ? (
                      entry.resolvedLists.map((list) => (
                        <Badge
                          key={`${entry.id}-${list.id}`}
                          variant="outline"
                          className="border-slate-200 bg-white text-slate-700"
                        >
                          {list.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        No specific lists were saved for this import.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Segments
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.resolvedSegments.length > 0 ? (
                      entry.resolvedSegments.map((segment) => (
                        <Badge
                          key={`${entry.id}-${segment.id}`}
                          variant="outline"
                          className="border-slate-200 bg-white text-slate-700"
                        >
                          {segment.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        No specific segments were saved for this import.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Import activity">
            <div className="space-y-3">
              {entry.timeline.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <TimelineDot state={item.state} />
                    <span className="mt-1 h-full w-px bg-slate-200 last:hidden" />
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium text-slate-900">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                    {item.timestamp ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTimeValue(item.timestamp)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title="Results"
            action={
              entry.report ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadReport(entry)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Import Report
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryMetric
                label="Imported"
                value={formatCount(entry.reportSummary.contactsImported)}
              />
              <SummaryMetric
                label="Skipped"
                value={formatCount(entry.reportSummary.contactsSkipped)}
              />
              <SummaryMetric
                label="Failed"
                value={formatCount(entry.reportSummary.contactsFailed)}
                tone={
                  entry.reportSummary.contactsFailed > 0 ? "danger" : "default"
                }
              />
              <SummaryMetric
                label="Segments created"
                value={formatCount(entry.reportSummary.segmentsCreated)}
              />
              <SummaryMetric
                label="Tags created"
                value={formatCount(entry.reportSummary.tagsCreated)}
              />
              <SummaryMetric
                label="Consents recorded"
                value={formatCount(entry.reportSummary.consentsRecorded)}
              />
            </div>

            {entry.report ? (
              <p className="text-sm text-slate-600">
                A downloadable report is available for this import if you need
                to review the final details outside this page.
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                A final report has not been saved for this import yet.
              </p>
            )}
          </DetailSection>

          {entry.status === "failed" || entry.errorCount > 0 ? (
            <DetailSection title="What needs attention">
              <div className="space-y-3">
                {entry.hasConnectionIssue ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Reconnect Mailchimp, then retry this import.
                  </div>
                ) : null}
                {entry.errorMessages.length > 0 ? (
                  <ul className="space-y-2">
                    {entry.errorMessages.map((message, index) => (
                      <li
                        key={`${entry.id}-error-${index}`}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
                      >
                        {message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    This import stopped before it could finish. Retry it when
                    you are ready.
                  </p>
                )}
              </div>
            </DetailSection>
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function SyncLogsTabView({
  focusedJobId,
  isConnected,
  onOpenConnectDialog,
  onOpenImportDialog,
}: {
  focusedJobId?: string | null;
  isConnected: boolean;
  onOpenConnectDialog: () => void;
  onOpenImportDialog: () => void;
}) {
  const [statusFilter, setStatusFilter] =
    useState<MailchimpSyncLogsStatusFilter>("all");
  const [datePreset, setDatePreset] =
    useState<MailchimpSyncLogsDatePreset>("30d");
  const [expandedJobId, setExpandedJobId] = useState<string | undefined>(
    focusedJobId ?? undefined,
  );
  const {
    rows,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    loadMore,
    refresh,
    focusedJobExcluded,
  } = useMailchimpSyncLogs({
    statusFilter,
    datePreset,
    focusedJobId,
  });
  const primaryActionLabel = isConnected ? "Start Import" : "Connect Mailchimp";
  const handlePrimaryAction = isConnected
    ? onOpenImportDialog
    : onOpenConnectDialog;

  useEffect(() => {
    if (focusedJobId && rows.some((row) => row.id === focusedJobId)) {
      setExpandedJobId(focusedJobId);
    }
  }, [focusedJobId, rows]);

  const statusCounts = useMemo(() => {
    return rows.reduce<Record<MailchimpSyncLogEntry["status"], number>>(
      (accumulator, row) => {
        accumulator[row.status] += 1;
        return accumulator;
      },
      {
        pending: 0,
        running: 0,
        paused: 0,
        cancelled: 0,
        completed: 0,
        failed: 0,
      },
    );
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Sync Logs
              </h3>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Review recent Mailchimp imports and open any run for a cleaner
              summary of what happened.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusFilterPills
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <StatusFilterPills
              options={DATE_PRESET_OPTIONS}
              value={datePreset}
              onChange={setDatePreset}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {totalCount.toLocaleString()} job{totalCount === 1 ? "" : "s"}
            </span>
            <span>{statusCounts.running} running</span>
            {statusCounts.paused > 0 ? (
              <span>{statusCounts.paused} paused</span>
            ) : null}
            <span>{statusCounts.failed} failed</span>
            <span>{statusCounts.completed} completed</span>
            {statusCounts.cancelled > 0 ? (
              <span>{statusCounts.cancelled} cancelled</span>
            ) : null}
          </div>
        </div>

        {focusedJobExcluded ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The selected job is hidden by the current filters. Clear or widen
            the filters to view it.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      {!loading && rows.length === 0 ? (
        <DataTabEmptyState
          icon={ScrollText}
          title="No Mailchimp sync logs yet"
          description="Import activity will appear here after the first Mailchimp sync runs."
          action={
            <Button type="button" onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </Button>
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-4 px-5 py-5">
          <Accordion
            type="single"
            collapsible
            value={expandedJobId}
            onValueChange={(value) => setExpandedJobId(value || undefined)}
            className="space-y-4"
          >
            {rows.map((entry) => (
              <JobCard
                key={entry.id}
                entry={entry}
                isExpanded={expandedJobId === entry.id}
              />
            ))}
          </Accordion>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Showing {rows.length.toLocaleString()} of{" "}
              {totalCount.toLocaleString()} jobs
            </p>
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Load More
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sync logs…
        </div>
      ) : null}
    </div>
  );
}
