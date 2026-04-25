import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  Download,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import {
  DataTabEmptyState,
  StatusFilterPills,
  TableSkeleton,
  formatDateTimeValue,
  formatDuration,
  formatRelativeTimestamp,
} from "@/components/integrations/shared/dataTabPrimitives";
import { formatCount } from "@/components/integrations/shared/formatCount";
import {
  type MailchimpSyncLogEntry,
  type MailchimpSyncLogsDatePreset,
  type MailchimpSyncLogsStatusFilter,
  useMailchimpSyncLogs,
} from "@/hooks/useMailchimpSyncLogs";

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

function getStatusChipColor(
  status: MailchimpSyncLogEntry["status"],
): "success" | "danger" | "warning" | "primary" | "neutral" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "paused") return "warning";
  if (status === "running") return "primary";
  return "neutral";
}

function getProgressColor(
  status: MailchimpSyncLogEntry["status"],
): "success" | "danger" | "warning" | "primary" | "neutral" {
  if (status === "failed") return "danger";
  if (status === "completed") return "success";
  if (status === "pending" || status === "paused" || status === "cancelled")
    return "neutral";
  return "primary";
}

function getStatusLabel(status: MailchimpSyncLogEntry["status"]) {
  if (status === "running") return "In Progress";
  if (status === "failed") return "Needs Attention";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDurationLabel(entry: MailchimpSyncLogEntry) {
  if (entry.status === "completed" || entry.status === "failed") {
    return (
      formatDuration(entry.createdAt, entry.completedAt ?? entry.updatedAt) ??
      "\u2014"
    );
  }

  return formatDuration(entry.createdAt, new Date().toISOString()) ?? "\u2014";
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
    <Sheet
      variant="soft"
      color="neutral"
      sx={{ borderRadius: "sm", px: 1.5, py: 1 }}
    >
      <Typography
        level="body-xs"
        fontWeight="lg"
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "text.tertiary",
        }}
      >
        {label}
      </Typography>
      <Typography
        level="body-sm"
        fontWeight="lg"
        sx={{
          mt: 0.5,
          color: tone === "danger" ? "danger.600" : "text.primary",
        }}
      >
        {value}
      </Typography>
    </Sheet>
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
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography level="title-sm">{title}</Typography>
        {action}
      </Stack>
      {children}
    </Sheet>
  );
}

function TimelineDot({
  state,
}: {
  state: MailchimpSyncLogEntry["timeline"][number]["state"];
}) {
  return (
    <Box
      sx={{
        mt: 0.75,
        width: 10,
        height: 10,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor:
          state === "complete"
            ? "success.500"
            : state === "current"
              ? "primary.500"
              : state === "failed"
                ? "danger.500"
                : "neutral.300",
      }}
    />
  );
}

function JobCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: MailchimpSyncLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const progressValue = Math.max(0, Math.min(100, entry.progressPercentage));

  return (
    <Accordion expanded={expanded} onChange={onToggle}>
      <AccordionSummary sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={2} sx={{ width: "100%", textAlign: "left" }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ lg: "flex-start" }}
          >
            <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip
                  size="sm"
                  variant="soft"
                  color={getStatusChipColor(entry.status)}
                >
                  {getStatusLabel(entry.status)}
                </Chip>
                <Chip size="sm" variant="outlined" color="neutral">
                  {entry.scopeSummary}
                </Chip>
                {entry.status === "running" ? (
                  <Typography
                    level="body-xs"
                    fontWeight="lg"
                    sx={{ color: "primary.600", alignSelf: "center" }}
                  >
                    Live
                  </Typography>
                ) : null}
                {entry.errorCount > 0 ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AlertTriangle size={13} />
                    <Typography
                      level="body-xs"
                      fontWeight="lg"
                      sx={{ color: "danger.600" }}
                    >
                      {entry.errorCount} issue
                      {entry.errorCount === 1 ? "" : "s"}
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                  gap: 1,
                }}
              >
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
              </Box>

              <Stack spacing={0.75}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {entry.currentStage}
                  </Typography>
                  <Typography level="body-xs" fontWeight="lg">
                    {progressValue}%
                  </Typography>
                </Stack>
                <LinearProgress
                  determinate
                  value={progressValue}
                  color={getProgressColor(entry.status)}
                  size="sm"
                  sx={{ borderRadius: "xs" }}
                />
              </Stack>
            </Stack>

            <Stack
              spacing={0.5}
              alignItems={{ xs: "flex-start", lg: "flex-end" }}
              sx={{ flexShrink: 0, minWidth: 160 }}
            >
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Created {formatRelativeTimestamp(entry.createdAt)}
              </Typography>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Updated {formatRelativeTimestamp(entry.updatedAt)}
              </Typography>
              {entry.completedAt ? (
                <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                  Finished {formatRelativeTimestamp(entry.completedAt)}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
        <Stack
          spacing={2}
          sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}
        >
          <DetailSection title="Selected audience">
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "sm", p: 1.5 }}
              >
                <Typography
                  level="body-xs"
                  fontWeight="lg"
                  sx={{
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "text.tertiary",
                    mb: 1,
                  }}
                >
                  Lists
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                  {entry.resolvedLists.length > 0 ? (
                    entry.resolvedLists.map((list) => (
                      <Chip
                        key={`${entry.id}-${list.id}`}
                        size="sm"
                        variant="outlined"
                        color="neutral"
                      >
                        {list.name}
                      </Chip>
                    ))
                  ) : (
                    <Typography
                      level="body-xs"
                      sx={{ color: "text.secondary" }}
                    >
                      No specific lists were saved for this import.
                    </Typography>
                  )}
                </Stack>
              </Sheet>

              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "sm", p: 1.5 }}
              >
                <Typography
                  level="body-xs"
                  fontWeight="lg"
                  sx={{
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "text.tertiary",
                    mb: 1,
                  }}
                >
                  Segments
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                  {entry.resolvedSegments.length > 0 ? (
                    entry.resolvedSegments.map((segment) => (
                      <Chip
                        key={`${entry.id}-${segment.id}`}
                        size="sm"
                        variant="outlined"
                        color="neutral"
                      >
                        {segment.name}
                      </Chip>
                    ))
                  ) : (
                    <Typography
                      level="body-xs"
                      sx={{ color: "text.secondary" }}
                    >
                      No specific segments were saved for this import.
                    </Typography>
                  )}
                </Stack>
              </Sheet>
            </Box>
          </DetailSection>

          <DetailSection title="Import activity">
            <Stack spacing={0}>
              {entry.timeline.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1.5}
                  sx={{ pb: 2 }}
                >
                  <Stack alignItems="center" sx={{ flexShrink: 0 }}>
                    <TimelineDot state={item.state} />
                    <Box
                      sx={{
                        flex: 1,
                        width: "1px",
                        bgcolor: "divider",
                        mt: 0.5,
                      }}
                    />
                  </Stack>
                  <Box sx={{ pb: 0.5 }}>
                    <Typography level="body-sm" fontWeight="lg">
                      {item.label}
                    </Typography>
                    <Typography
                      level="body-sm"
                      sx={{ mt: 0.5, color: "text.secondary" }}
                    >
                      {item.description}
                    </Typography>
                    {item.timestamp ? (
                      <Typography
                        level="body-xs"
                        sx={{ mt: 0.5, color: "text.tertiary" }}
                      >
                        {formatDateTimeValue(item.timestamp)}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </DetailSection>

          <DetailSection
            title="Results"
            action={
              entry.report ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<Download size={14} />}
                  onClick={() => downloadReport(entry)}
                >
                  Download Report
                </Button>
              ) : undefined
            }
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 1,
                mb: 1.5,
              }}
            >
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
            </Box>
            {entry.report ? (
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                A downloadable report is available for this import if you need
                to review the final details outside this page.
              </Typography>
            ) : (
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                A final report has not been saved for this import yet.
              </Typography>
            )}
          </DetailSection>

          {entry.status === "failed" || entry.errorCount > 0 ? (
            <DetailSection title="What needs attention">
              <Stack spacing={1}>
                {entry.hasConnectionIssue ? (
                  <Alert size="sm" color="warning" variant="soft">
                    Reconnect Mailchimp, then retry this import.
                  </Alert>
                ) : null}
                {entry.errorMessages.length > 0 ? (
                  <Stack spacing={1}>
                    {entry.errorMessages.map((message, index) => (
                      <Alert
                        key={`${entry.id}-error-${index}`}
                        size="sm"
                        color="danger"
                        variant="soft"
                        startDecorator={<AlertTriangle size={14} />}
                      >
                        {message}
                      </Alert>
                    ))}
                  </Stack>
                ) : (
                  <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                    This import stopped before it could finish. Retry it when
                    you are ready.
                  </Typography>
                )}
              </Stack>
            </DetailSection>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
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

  if (loading && rows.length === 0) {
    return <TableSkeleton columns={5} rows={8} />;
  }
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
    <Sheet variant="outlined" sx={{ borderRadius: "xl", overflow: "hidden" }}>
      <Stack
        spacing={2}
        sx={{
          px: 2.5,
          py: 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ lg: "flex-start" }}
        >
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-sm">Sync Logs</Typography>
              {loading ? <CircularProgress size="sm" /> : null}
            </Stack>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Review recent Mailchimp imports and open any run for a cleaner
              summary of what happened.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<RefreshCw size={14} />}
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
            <Button size="sm" onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={2}
          alignItems={{ xl: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
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
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ flexWrap: "wrap" }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Clock3 size={13} />
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {totalCount.toLocaleString()} job{totalCount === 1 ? "" : "s"}
              </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              {statusCounts.running} running
            </Typography>
            {statusCounts.paused > 0 ? (
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {statusCounts.paused} paused
              </Typography>
            ) : null}
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              {statusCounts.failed} failed
            </Typography>
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              {statusCounts.completed} completed
            </Typography>
            {statusCounts.cancelled > 0 ? (
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {statusCounts.cancelled} cancelled
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        {focusedJobExcluded ? (
          <Alert size="sm" color="warning" variant="soft">
            The selected job is hidden by the current filters. Clear or widen
            the filters to view it.
          </Alert>
        ) : null}

        {error ? (
          <Alert size="sm" color="danger" variant="soft">
            {error}
          </Alert>
        ) : null}
      </Stack>

      {!loading && rows.length === 0 ? (
        <DataTabEmptyState
          icon={ScrollText}
          title="No Mailchimp sync logs yet"
          description="Import activity will appear here after the first Mailchimp sync runs."
          action={
            <Button onClick={handlePrimaryAction}>{primaryActionLabel}</Button>
          }
        />
      ) : null}

      {rows.length > 0 ? (
        <Stack spacing={0}>
          <AccordionGroup
            sx={{
              "--AccordionGroup-separator": "1px solid",
              "--joy-palette-divider":
                "var(--joy-palette-neutral-outlinedBorder)",
            }}
          >
            {rows.map((entry) => (
              <JobCard
                key={entry.id}
                entry={entry}
                expanded={expandedJobId === entry.id}
                onToggle={() =>
                  setExpandedJobId(
                    expandedJobId === entry.id ? undefined : entry.id,
                  )
                }
              />
            ))}
          </AccordionGroup>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
            sx={{
              px: 2.5,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              Showing {rows.length.toLocaleString()} of{" "}
              {totalCount.toLocaleString()} jobs
            </Typography>
            {hasMore ? (
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                startDecorator={
                  loadingMore ? <CircularProgress size="sm" /> : null
                }
              >
                Load More
              </Button>
            ) : null}
          </Stack>
        </Stack>
      ) : null}
    </Sheet>
  );
}
