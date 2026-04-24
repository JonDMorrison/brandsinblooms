import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoySelect } from "@/components/joy/JoySelect";
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
  useDeleteFormSubmissions,
  useFormSubmissionsPage,
} from "@/hooks/useForms";
import { useFormSubmissionsRealtime } from "@/hooks/useFormSubmissionsRealtime";
import {
  formatSubmissionValue,
  getSubmissionDisplayEmail,
  getSubmissionDisplayName,
  getSubmissionDisplaySource,
  getSubmissionVisibleEntries,
  isTestSubmission,
  submissionMatchesFilters,
} from "@/lib/forms/submissionPresentation";
import type {
  Form,
  FormSubmission,
  FormSubmissionSortColumn,
  SortDirection,
  SubmissionResult,
} from "@/types/formBuilder";

interface FormSubmissionsTabProps {
  form: Form;
  tenantId?: string;
}

type SubmissionResultFilter = "all" | SubmissionResult;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_SORT_COLUMN: FormSubmissionSortColumn = "submitted_at";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

const RESULT_OPTIONS: Array<{ value: SubmissionResultFilter; label: string }> =
  [
    { value: "all", label: "All results" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected_invalid", label: "Invalid" },
    { value: "rejected_rate_limited", label: "Rate limited" },
    { value: "rejected_spam", label: "Spam" },
  ];

const resultConfig: Record<
  SubmissionResult,
  {
    color: "success" | "danger" | "warning" | "neutral";
    label: string;
  }
> = {
  accepted: { color: "success", label: "Accepted" },
  rejected_invalid: { color: "danger", label: "Invalid" },
  rejected_rate_limited: { color: "warning", label: "Rate limited" },
  rejected_spam: { color: "neutral", label: "Spam" },
};

function exportJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(filename, blob);
}

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const csv = [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((key) => {
          const raw = row[key];
          const value = raw === null || raw === undefined ? "" : String(raw);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function SubmissionsSkeleton() {
  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={132}
            animation="wave"
            sx={{ borderRadius: "lg" }}
          />
        ))}
      </Box>
      <Skeleton
        variant="rectangular"
        height={84}
        animation="wave"
        sx={{ borderRadius: "lg" }}
      />
      <Skeleton
        variant="rectangular"
        height={480}
        animation="wave"
        sx={{ borderRadius: "lg" }}
      />
    </Stack>
  );
}

export function FormSubmissionsTab({
  form,
  tenantId,
}: FormSubmissionsTabProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [resultFilter, setResultFilter] =
    React.useState<SubmissionResultFilter>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [sortColumn, setSortColumn] =
    React.useState<FormSubmissionSortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  );
  const [hideTestSubmissions, setHideTestSubmissions] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectedSubmission, setSelectedSubmission] =
    React.useState<FormSubmission | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [queuedRealtimeCount, setQueuedRealtimeCount] = React.useState(0);

  const deleteMutation = useDeleteFormSubmissions();
  const {
    data: pageData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFormSubmissionsPage(
    form.id,
    tenantId,
    page,
    pageSize,
    sortColumn,
    sortDirection,
    resultFilter,
    searchQuery,
    dateFrom || null,
    dateTo || null,
    hideTestSubmissions,
  );

  const submissions = pageData?.rows ?? [];
  const summary = pageData?.summary;
  const filteredTotal = pageData?.filteredTotal ?? 0;

  React.useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    resultFilter,
    dateFrom,
    dateTo,
    hideTestSubmissions,
    sortColumn,
    sortDirection,
    pageSize,
  ]);

  React.useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set(
        Array.from(current).filter((id) =>
          submissions.some((submission) => submission.id === id),
        ),
      );
      return next.size === current.size ? current : next;
    });
  }, [submissions]);

  const realtimeFilters = React.useMemo(
    () => ({
      searchQuery,
      resultFilter,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      hideTestSubmissions,
    }),
    [searchQuery, resultFilter, dateFrom, dateTo, hideTestSubmissions],
  );

  const { connectionState, isLive } = useFormSubmissionsRealtime({
    channelName: `form-submissions-${form.id}`,
    enabled: Boolean(tenantId),
    formId: form.id,
    tenantId,
    onSubmission: (submission) => {
      if (!submissionMatchesFilters(submission, realtimeFilters)) {
        return;
      }

      setQueuedRealtimeCount((count) => count + 1);
    },
  });

  const handleRefresh = React.useCallback(() => {
    setQueuedRealtimeCount(0);
    void refetch();
  }, [refetch]);

  const handleSort = React.useCallback(
    (column: FormSubmissionSortColumn) => {
      if (sortColumn === column) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }

      setSortColumn(column);
      setSortDirection(column === DEFAULT_SORT_COLUMN ? "desc" : "asc");
    },
    [sortColumn],
  );

  const toggleSelection = React.useCallback(
    (submissionId: string, checked: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (checked) {
          next.add(submissionId);
        } else {
          next.delete(submissionId);
        }
        return next;
      });
    },
    [],
  );

  const togglePageSelection = React.useCallback(
    (checked: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        submissions.forEach((submission) => {
          if (checked) {
            next.add(submission.id);
          } else {
            next.delete(submission.id);
          }
        });
        return next;
      });
    },
    [submissions],
  );

  const allRowsSelected =
    submissions.length > 0 &&
    submissions.every((submission) => selectedIds.has(submission.id));
  const selectedCount = selectedIds.size;

  const handleDeleteSelected = React.useCallback(async () => {
    if (!tenantId || selectedIds.size === 0) {
      return;
    }

    await deleteMutation.mutateAsync({
      formId: form.id,
      submissionIds: Array.from(selectedIds),
      tenantId,
    });

    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
  }, [deleteMutation, form.id, selectedIds, tenantId]);

  const exportRows = React.useMemo(
    () =>
      submissions.map((submission) => ({
        submitted_at: submission.submitted_at,
        name: getSubmissionDisplayName(submission) || "",
        email: getSubmissionDisplayEmail(submission),
        result: submission.result,
        source: getSubmissionDisplaySource(submission),
        is_test: isTestSubmission(submission),
        data: JSON.stringify(submission.data),
      })),
    [submissions],
  );

  if (isLoading) {
    return <SubmissionsSkeleton />;
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <JoyCard>
          <JoyCardHeader title="Total" />
          <JoyCardContent sx={{ pt: 2 }}>
            <Typography level="h2">{summary?.total ?? 0}</Typography>
            <Typography level="body-sm" color="neutral">
              Filtered submissions in view
            </Typography>
          </JoyCardContent>
        </JoyCard>
        <JoyCard>
          <JoyCardHeader title="Accepted" />
          <JoyCardContent sx={{ pt: 2 }}>
            <Typography level="h2">{summary?.accepted ?? 0}</Typography>
            <Typography level="body-sm" color="neutral">
              {summary
                ? `${summary.acceptRate.toFixed(0)}% acceptance rate`
                : "No data"}
            </Typography>
          </JoyCardContent>
        </JoyCard>
        <JoyCard>
          <JoyCardHeader title="Rejected" />
          <JoyCardContent sx={{ pt: 2 }}>
            <Typography level="h2">{summary?.rejected ?? 0}</Typography>
            <Typography level="body-sm" color="neutral">
              Invalid {summary?.rejectionBreakdown.invalid ?? 0}, rate limited{" "}
              {summary?.rejectionBreakdown.rateLimit ?? 0}, spam{" "}
              {summary?.rejectionBreakdown.spam ?? 0}
            </Typography>
          </JoyCardContent>
        </JoyCard>
        <JoyCard>
          <JoyCardHeader title="Recent activity" />
          <JoyCardContent sx={{ pt: 2 }}>
            <Typography level="h2">{summary?.last7Days ?? 0}</Typography>
            <Typography level="body-sm" color="neutral">
              Last 7 days vs previous period{" "}
              {summary
                ? `${summary.trend > 0 ? "+" : ""}${summary.trend.toFixed(1)}%`
                : "0%"}
            </Typography>
          </JoyCardContent>
        </JoyCard>
      </Box>

      <JoyCard>
        <JoyCardHeader
          startDecorator={
            <Avatar
              size="sm"
              variant="soft"
              color={isLive ? "success" : "warning"}
            >
              {isLive ? <Wifi size={18} /> : <WifiOff size={18} />}
            </Avatar>
          }
          title="Submission queue"
          description="Review incoming leads, export the current page, and inspect the full payload for each record."
          actions={
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip
                size="sm"
                variant="soft"
                color={isLive ? "success" : "warning"}
              >
                {connectionState === "live"
                  ? "Realtime live"
                  : connectionState === "connecting"
                    ? "Connecting"
                    : "Realtime paused"}
              </JoyChip>
              {queuedRealtimeCount > 0 ? (
                <JoyButton
                  bloomVariant="ghost"
                  color="primary"
                  startDecorator={<RefreshCw size={16} />}
                  onClick={handleRefresh}
                >
                  Refresh {queuedRealtimeCount} new
                </JoyButton>
              ) : null}
            </Stack>
          }
        />
        <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                xl: "minmax(0, 1.4fr) repeat(4, minmax(140px, 0.5fr))",
              },
              gap: 1,
            }}
          >
            <JoySearchInput
              value={searchQuery}
              placeholder="Search submissions..."
              onValueChange={setSearchQuery}
              onDebouncedChange={setSearchQuery}
            />
            <JoySelect
              label="Result"
              value={resultFilter}
              options={RESULT_OPTIONS}
              onValueChange={(value) =>
                setResultFilter((value || "all") as SubmissionResultFilter)
              }
            />
            <JoyInput
              label="From"
              type="date"
              value={dateFrom}
              onValueChange={setDateFrom}
            />
            <JoyInput
              label="To"
              type="date"
              value={dateTo}
              onValueChange={setDateTo}
            />
            <Sheet
              variant="plain"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "lg",
                px: 1.5,
                py: 1.25,
              }}
            >
              <Stack spacing={0.25}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Hide test submissions
                </Typography>
                <Typography level="body-xs" color="neutral">
                  Exclude records flagged as tests.
                </Typography>
              </Stack>
              <Switch
                checked={hideTestSubmissions}
                onChange={(event) =>
                  setHideTestSubmissions(event.target.checked)
                }
              />
            </Sheet>
          </Box>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip size="sm" variant="soft" color="neutral">
                {filteredTotal} matching records
              </JoyChip>
              {selectedCount > 0 ? (
                <JoyChip size="sm" variant="soft" color="primary">
                  {selectedCount} selected
                </JoyChip>
              ) : null}
              {isFetching ? (
                <JoyChip size="sm" variant="soft" color="neutral">
                  Refreshing...
                </JoyChip>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyButton
                bloomVariant="ghost"
                color="neutral"
                startDecorator={<Download size={16} />}
                onClick={() =>
                  exportCsv(
                    `${form.name.toLowerCase().replace(/\s+/g, "-")}-submissions.csv`,
                    exportRows,
                  )
                }
                disabled={submissions.length === 0}
              >
                Export CSV
              </JoyButton>
              <JoyButton
                bloomVariant="ghost"
                color="neutral"
                startDecorator={<Download size={16} />}
                onClick={() =>
                  exportJson(
                    `${form.name.toLowerCase().replace(/\s+/g, "-")}-submissions.json`,
                    submissions,
                  )
                }
                disabled={submissions.length === 0}
              >
                Export JSON
              </JoyButton>
              <JoyButton
                bloomVariant="ghost"
                color="danger"
                startDecorator={<Trash2 size={16} />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={selectedCount === 0 || deleteMutation.isPending}
              >
                Delete selected
              </JoyButton>
            </Stack>
          </Stack>

          {error ? (
            <Sheet
              variant="soft"
              color="danger"
              sx={{ borderRadius: "lg", p: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertTriangle size={18} />
                <Typography level="body-sm">
                  {error instanceof Error
                    ? error.message
                    : "Unable to load submissions."}
                </Typography>
              </Stack>
            </Sheet>
          ) : null}

          <JoyTable stickyHeader>
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell sx={{ width: 48 }}>
                  <Checkbox
                    checked={allRowsSelected}
                    indeterminate={!allRowsSelected && selectedCount > 0}
                    onChange={(event) =>
                      togglePageSelection(event.target.checked)
                    }
                  />
                </JoyTableHeaderCell>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={sortColumn === "name" ? sortDirection : "none"}
                  onSort={() => handleSort("name")}
                >
                  Customer
                </JoyTableHeaderCell>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={
                    sortColumn === "email" ? sortDirection : "none"
                  }
                  onSort={() => handleSort("email")}
                >
                  Email
                </JoyTableHeaderCell>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={
                    sortColumn === "result" ? sortDirection : "none"
                  }
                  onSort={() => handleSort("result")}
                >
                  Result
                </JoyTableHeaderCell>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={
                    sortColumn === "source" ? sortDirection : "none"
                  }
                  onSort={() => handleSort("source")}
                >
                  Source
                </JoyTableHeaderCell>
                <JoyTableHeaderCell
                  sortable
                  sortDirection={
                    sortColumn === "submitted_at" ? sortDirection : "none"
                  }
                  onSort={() => handleSort("submitted_at")}
                >
                  Submitted
                </JoyTableHeaderCell>
                <JoyTableHeaderCell align="right">Inspect</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {submissions.length === 0 ? (
                <JoyTableRow>
                  <JoyTableCell colSpan={7} sx={{ py: 5, textAlign: "center" }}>
                    <Typography level="body-sm" color="neutral">
                      No submissions match the current filters.
                    </Typography>
                  </JoyTableCell>
                </JoyTableRow>
              ) : (
                submissions.map((submission) => {
                  const displayName =
                    getSubmissionDisplayName(submission) || "Anonymous";
                  const displayEmail = getSubmissionDisplayEmail(submission);
                  const status = resultConfig[submission.result];
                  const testSubmission = isTestSubmission(submission);
                  return (
                    <JoyTableRow
                      key={submission.id}
                      clickable
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      <JoyTableCell
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(submission.id)}
                          onChange={(event) =>
                            toggleSelection(submission.id, event.target.checked)
                          }
                        />
                      </JoyTableCell>
                      <JoyTableCell>
                        <Stack spacing={0.25}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: 600 }}
                            >
                              {displayName}
                            </Typography>
                            {testSubmission ? (
                              <JoyChip size="sm" variant="soft" color="warning">
                                Test
                              </JoyChip>
                            ) : null}
                          </Stack>
                          <Typography level="body-xs" color="neutral">
                            {submission.customer_id
                              ? `Customer ${submission.customer_id}`
                              : "No linked customer yet"}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>{displayEmail}</JoyTableCell>
                      <JoyTableCell>
                        <JoyChip size="sm" variant="soft" color={status.color}>
                          {status.label}
                        </JoyChip>
                      </JoyTableCell>
                      <JoyTableCell>
                        {getSubmissionDisplaySource(submission)}
                      </JoyTableCell>
                      <JoyTableCell>
                        <Stack spacing={0.25}>
                          <Typography level="body-sm">
                            {formatDistanceToNow(
                              new Date(submission.submitted_at),
                              { addSuffix: true },
                            )}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {format(new Date(submission.submitted_at), "PPp")}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell align="right">
                        <JoyButton
                          bloomVariant="ghost"
                          color="neutral"
                          startDecorator={<Eye size={16} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedSubmission(submission);
                          }}
                        >
                          Open
                        </JoyButton>
                      </JoyTableCell>
                    </JoyTableRow>
                  );
                })
              )}
            </JoyTableBody>
          </JoyTable>

          <JoyTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={filteredTotal}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </JoyCardContent>
      </JoyCard>

      <JoyDrawer
        open={Boolean(selectedSubmission)}
        onClose={() => setSelectedSubmission(null)}
        title={
          selectedSubmission
            ? getSubmissionDisplayName(selectedSubmission) ||
              getSubmissionDisplayEmail(selectedSubmission)
            : "Submission details"
        }
        description={
          selectedSubmission
            ? `Submitted ${format(new Date(selectedSubmission.submitted_at), "PPpp")}`
            : undefined
        }
        size="lg"
      >
        {selectedSubmission ? (
          <Stack spacing={2.5}>
            <JoyCard>
              <JoyCardHeader title="Submission summary" />
              <JoyCardContent sx={{ pt: 2, gap: 1.25 }}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <JoyChip
                    size="sm"
                    variant="soft"
                    color={resultConfig[selectedSubmission.result].color}
                  >
                    {resultConfig[selectedSubmission.result].label}
                  </JoyChip>
                  {isTestSubmission(selectedSubmission) ? (
                    <JoyChip size="sm" variant="soft" color="warning">
                      Test submission
                    </JoyChip>
                  ) : null}
                </Stack>
                <Typography level="body-sm" color="neutral">
                  Source: {getSubmissionDisplaySource(selectedSubmission)}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Email: {getSubmissionDisplayEmail(selectedSubmission)}
                </Typography>
              </JoyCardContent>
            </JoyCard>

            <JoyCard>
              <JoyCardHeader title="Captured values" />
              <JoyCardContent sx={{ pt: 2, gap: 1 }}>
                {getSubmissionVisibleEntries(form, selectedSubmission).map(
                  (entry) => (
                    <Sheet
                      key={entry.id}
                      variant="soft"
                      sx={{ borderRadius: "lg", px: 1.5, py: 1.25 }}
                    >
                      <Stack spacing={0.5}>
                        <Typography level="body-xs" color="neutral">
                          {entry.label}
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ fontWeight: 600, whiteSpace: "pre-wrap" }}
                        >
                          {entry.displayValue}
                        </Typography>
                      </Stack>
                    </Sheet>
                  ),
                )}
              </JoyCardContent>
            </JoyCard>

            <JoyCard>
              <JoyCardHeader title="Metadata" />
              <JoyCardContent sx={{ pt: 2 }}>
                <Sheet
                  component="pre"
                  variant="soft"
                  sx={{
                    m: 0,
                    p: 2,
                    borderRadius: "lg",
                    overflowX: "auto",
                    fontFamily: "var(--joy-fontFamily-code)",
                    fontSize: "0.8125rem",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(selectedSubmission.metadata, null, 2)}
                </Sheet>
              </JoyCardContent>
            </JoyCard>
          </Stack>
        ) : null}
      </JoyDrawer>

      <JoyAlertDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteSelected()}
        title={`Delete ${selectedCount} selected submission${selectedCount === 1 ? "" : "s"}?`}
        description="This permanently removes the selected submission records and refreshes analytics after the delete completes."
        confirmLabel="Delete submissions"
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </Stack>
  );
}
