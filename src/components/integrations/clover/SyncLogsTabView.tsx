import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CloverSyncLogRow,
  LightspeedPagination,
} from "@/hooks/useIntegrationDetailData";

import {
  DataTabEmptyState,
  DataTabPagination,
  RawDataPre,
  StatusFilterPills,
  SyncStatusBadge,
  SyncTypeBadge,
  formatDuration,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";

type SyncLogsStatusValue = "all" | "completed" | "failed" | "in_progress";

const SYNC_LOG_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "In progress", value: "in_progress" },
] satisfies Array<{ label: string; value: SyncLogsStatusValue }>;

export function SyncLogsTabView({
  connectionId: _connectionId,
  rows,
  pagination,
  isLoading,
  isFetching,
  statusFilter,
  onStatusFilterChange,
  onPageChange,
  onRetrySync,
  onRefresh,
}: {
  connectionId: string;
  rows: CloverSyncLogRow[];
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  statusFilter: SyncLogsStatusValue;
  onStatusFilterChange: (value: SyncLogsStatusValue) => void;
  onPageChange: (page: number) => void;
  onRetrySync: (syncType: CloverSyncLogRow["normalizedSyncType"]) => void;
  onRefresh: () => void;
}) {
  const hasVisibleActiveJob = rows.some((job) => job.status === "in_progress");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold">Clover sync history</p>
        <StatusFilterPills
          options={SYNC_LOG_STATUS_OPTIONS}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </div>

      {hasVisibleActiveJob ? (
        <div className="border-b border-border/70 bg-brand-teal/5 px-5 py-2.5 text-xs text-slate-700">
          Refresh to see the latest Clover sync status.{" "}
          <button
            type="button"
            onClick={onRefresh}
            className="font-medium underline underline-offset-2"
          >
            Refresh now
          </button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="divide-y divide-gray-50">
            {rows.map((job) => {
              const showProgress =
                (job.status === "in_progress" ||
                  job.status === "completed" ||
                  job.status === "failed") &&
                typeof job.estimated_rows === "number" &&
                job.estimated_rows > 0;
              const progressPercent = showProgress
                ? Math.min(
                    100,
                    Math.round(
                      ((job.inserted_rows ?? 0) / job.estimated_rows) * 100,
                    ),
                  )
                : job.progressPercent;

              return (
                <div key={job.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <SyncTypeBadge job={job} />
                        <SyncStatusBadge job={job} />
                        {job.status === "in_progress" ? (
                          <span className="animate-pulse text-xs text-muted-foreground">
                            Live
                          </span>
                        ) : null}
                      </div>

                      {showProgress ? (
                        <div className="mb-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {(job.inserted_rows ?? 0).toLocaleString()} / ~
                              {job.estimated_rows?.toLocaleString()} records
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {progressPercent}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={
                                job.status === "failed"
                                  ? "h-full rounded-full bg-red-400 transition-all duration-500"
                                  : "h-full rounded-full bg-emerald-500 transition-all duration-500"
                              }
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <p
                        className={
                          job.status === "failed"
                            ? "text-xs text-red-600"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {job.progress_message ?? "Queued"}
                      </p>

                      {job.last_error ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            View job details
                          </summary>
                          <RawDataPre
                            value={{
                              last_error: job.last_error,
                              metadata: job.metadata,
                            }}
                          />
                        </details>
                      ) : null}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTimestamp(job.created_at)}
                      </p>
                      {job.completed_at ? (
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(job.created_at, job.completed_at)}
                        </p>
                      ) : null}
                      {job.status === "failed" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => onRetrySync(job.normalizedSyncType)}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DataTabPagination
            pagination={pagination}
            onPageChange={onPageChange}
          />
        </>
      ) : null}

      {isLoading || isFetching ? (
        <div className="px-5 py-10 text-sm text-muted-foreground">
          Loading Clover sync history...
        </div>
      ) : null}

      {!isLoading && !isFetching && rows.length === 0 ? (
        <DataTabEmptyState
          icon={ScrollText}
          title="No Clover sync history yet"
          description="Clover sync activity will appear here after the first customer, order, or catalog sync runs."
        />
      ) : null}
    </div>
  );
}
