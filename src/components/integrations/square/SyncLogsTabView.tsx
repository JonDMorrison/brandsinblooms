import { Fragment, useState } from "react";
import { ScrollText } from "lucide-react";
import {
  Alert,
  Box,
  Button as JoyButton,
  LinearProgress,
  Typography,
} from "@mui/joy";
import type {
  LightspeedPagination,
  SquareSyncLogRow,
} from "@/hooks/useIntegrationDetailData";

import {
  DataTabCard,
  DataTabEmptyState,
  DataTabPagination,
  JoyDataTable,
  RawDataPre,
  StatusFilterPills,
  SyncStatusBadge,
  SyncTypeBadge,
  TableSkeleton,
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
  rows: SquareSyncLogRow[];
  pagination: LightspeedPagination;
  isLoading: boolean;
  isFetching: boolean;
  statusFilter: SyncLogsStatusValue;
  onStatusFilterChange: (value: SyncLogsStatusValue) => void;
  onPageChange: (page: number) => void;
  onRetrySync: (syncType: SquareSyncLogRow["normalizedSyncType"]) => void;
  onRefresh: () => void;
}) {
  const [expandedFailures, setExpandedFailures] = useState<
    Record<string, boolean>
  >({});
  const hasVisibleActiveJob = rows.some((job) => job.status === "in_progress");

  if (isLoading || (isFetching && rows.length === 0)) {
    return <TableSkeleton columns={5} rows={8} />;
  }

  const toggleFailedRow = (id: string) => {
    setExpandedFailures((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <DataTabCard>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold">Square sync history</p>
        <StatusFilterPills
          options={SYNC_LOG_STATUS_OPTIONS}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </div>

      {hasVisibleActiveJob ? (
        <Alert
          color="neutral"
          variant="soft"
          sx={{ mx: 2.5, mt: 2, mb: 0, borderRadius: "md" }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              width: "100%",
              flexWrap: "wrap",
            }}
          >
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Refresh to see the latest Square sync status.
            </Typography>
            <JoyButton
              size="sm"
              variant="plain"
              color="neutral"
              onClick={onRefresh}
            >
              Refresh now
            </JoyButton>
          </Box>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <JoyDataTable>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Message</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                  const isFailureOpen = Boolean(expandedFailures[job.id]);

                  return (
                    <Fragment key={job.id}>
                      <tr>
                        <td>
                          <SyncTypeBadge job={job} />
                        </td>
                        <td>
                          <SyncStatusBadge job={job} />
                        </td>
                        <td>
                          {showProgress ? (
                            <Box sx={{ minWidth: 150 }}>
                              <LinearProgress
                                determinate
                                size="sm"
                                color={
                                  job.status === "failed" ? "danger" : "success"
                                }
                                value={progressPercent}
                              />
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.tertiary", mt: 0.5 }}
                              >
                                {(job.inserted_rows ?? 0).toLocaleString()} / ~
                                {job.estimated_rows?.toLocaleString()} (
                                {progressPercent}%)
                              </Typography>
                            </Box>
                          ) : (
                            <Typography
                              level="body-xs"
                              sx={{ color: "text.tertiary" }}
                            >
                              —
                            </Typography>
                          )}
                        </td>
                        <td>
                          <Typography
                            level="body-sm"
                            sx={{
                              color:
                                job.status === "failed"
                                  ? "danger.600"
                                  : "text.secondary",
                              maxWidth: 320,
                            }}
                          >
                            {job.progress_message ?? "Queued"}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm">
                            {formatRelativeTimestamp(job.created_at)}
                          </Typography>
                        </td>
                        <td>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.tertiary" }}
                          >
                            {formatDuration(job.created_at, job.completed_at) ??
                              "—"}
                          </Typography>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            {job.status === "failed" && job.last_error ? (
                              <JoyButton
                                size="sm"
                                variant="outlined"
                                color="danger"
                                onClick={() => toggleFailedRow(job.id)}
                              >
                                {isFailureOpen ? "Hide error" : "View error"}
                              </JoyButton>
                            ) : null}
                            {job.status === "failed" ? (
                              <JoyButton
                                type="button"
                                variant="plain"
                                color="neutral"
                                size="sm"
                                onClick={() =>
                                  onRetrySync(job.normalizedSyncType)
                                }
                              >
                                Retry
                              </JoyButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {job.status === "failed" &&
                      job.last_error &&
                      isFailureOpen ? (
                        <tr key={`${job.id}-error`}>
                          <td colSpan={7}>
                            <RawDataPre
                              value={{
                                last_error: job.last_error,
                                metadata: job.metadata,
                              }}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </JoyDataTable>
          </div>
          <DataTabPagination
            pagination={pagination}
            onPageChange={onPageChange}
          />
        </>
      ) : null}

      {!isLoading && !isFetching && rows.length === 0 ? (
        <DataTabEmptyState
          icon={ScrollText}
          title="No Square sync history yet"
          description="Sync activity will appear here after your first Square sync."
        />
      ) : null}
    </DataTabCard>
  );
}
