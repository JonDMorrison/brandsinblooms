import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-legacy/table";
import { Skeleton } from "@/components/ui-legacy/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  Mail,
  MessageSquare,
  Bot,
  TrendingUp,
  TrendingDown,
  Eye,
  AlertCircle,
  TestTube2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import {
  Form,
  FormSubmissionSortColumn,
  FormSubmission,
  FormSubmissionMetadata,
  SortDirection,
  SubmissionResult,
} from "@/types/formBuilder";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-legacy/tooltip";
import { Button } from "@/components/ui-legacy/button";
import { Switch } from "@/components/ui-legacy/switch";
import { Label } from "@/components/ui-legacy/label";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { ConfirmationDialog } from "@/components/ui-legacy/confirmation-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-legacy/collapsible";
import {
  SubmissionFilters,
  SubmissionResultFilter,
  DateRange,
} from "./submissions/SubmissionFilters";
import { SubmissionDetailModal } from "./submissions/SubmissionDetailModal";
import { SubmissionExport } from "./submissions/SubmissionExport";
import {
  useDeleteFormSubmissions,
  useFormAnalytics,
  useFormSubmissionsPage,
} from "@/hooks/useForms";
import { useFormSubmissionsRealtime } from "@/hooks/useFormSubmissionsRealtime";
import {
  getSubmissionDisplayEmail,
  getSubmissionDisplayName,
  getSubmissionDisplaySource,
  isTestSubmission,
  submissionMatchesFilters,
} from "@/lib/forms/submissionPresentation";
import { FormTestMatrix } from "./FormTestMatrix";

interface FormSubmissionsTabProps {
  form: Form;
  tenantId?: string;
}

// Canonical result display config
const resultConfig: Record<
  SubmissionResult,
  {
    label: string;
    shortLabel: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    className?: string;
  }
> = {
  accepted: {
    label: "Accepted",
    shortLabel: "Accepted",
    variant: "default",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  rejected_invalid: {
    label: "Invalid",
    shortLabel: "Invalid",
    variant: "destructive",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  rejected_rate_limited: {
    label: "Rate Limited",
    shortLabel: "Rate Limited",
    variant: "outline",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  rejected_spam: {
    label: "Spam",
    shortLabel: "Spam",
    variant: "outline",
    icon: <Bot className="h-3.5 w-3.5" />,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

function getSubmissionResultInfo(
  submission: Pick<FormSubmission, "result" | "metadata">,
) {
  switch (submission.result) {
    case "accepted":
      return resultConfig.accepted;
    case "rejected_invalid":
      return resultConfig.rejected_invalid;
    case "rejected_rate_limited":
      return resultConfig.rejected_rate_limited;
    case "rejected_spam":
      return resultConfig.rejected_spam;
    default: {
      const rejectionType = submission.metadata?.rejection_type;
      if (rejectionType === "rate_limited") {
        return resultConfig.rejected_rate_limited;
      }
      if (rejectionType === "spam") {
        return resultConfig.rejected_spam;
      }
      return resultConfig.rejected_invalid;
    }
  }
}

const PAGE_SIZE = 25;
const DEFAULT_SORT_COLUMN: FormSubmissionSortColumn = "submitted_at";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

const EMPTY_SUMMARY = {
  total: 0,
  accepted: 0,
  rejected: 0,
  acceptRate: 0,
  last7Days: 0,
  previous7Days: 0,
  trend: 0,
  rejectionBreakdown: { invalid: 0, rateLimit: 0, spam: 0 },
};

export function FormSubmissionsTab({
  form,
  tenantId,
}: FormSubmissionsTabProps) {
  const formId = form.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] =
    useState<SubmissionResultFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedSubmission, setSelectedSubmission] =
    useState<FormSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] =
    useState<FormSubmissionSortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  );
  const [hideTestSubmissions, setHideTestSubmissions] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [queuedRealtimeCount, setQueuedRealtimeCount] = useState(0);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const deleteSubmissionsMutation = useDeleteFormSubmissions();

  const dateFrom = useMemo(
    () => (dateRange.from ? startOfDay(dateRange.from).toISOString() : null),
    [dateRange.from],
  );
  const dateTo = useMemo(
    () => (dateRange.to ? endOfDay(dateRange.to).toISOString() : null),
    [dateRange.to],
  );

  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    resultFilter,
    dateFrom,
    dateTo,
    hideTestSubmissions,
    sortColumn,
    sortDirection,
  ]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFormSubmissionsPage(
    formId,
    tenantId,
    page,
    PAGE_SIZE,
    sortColumn,
    sortDirection,
    resultFilter,
    searchQuery,
    dateFrom,
    dateTo,
    hideTestSubmissions,
  );

  const { data: analytics } = useFormAnalytics(formId, tenantId);

  const submissions = useMemo(() => pageData?.rows ?? [], [pageData?.rows]);
  const stats = pageData?.summary || EMPTY_SUMMARY;
  const filteredTotal = pageData?.filteredTotal || 0;
  const unfilteredTotal = pageData?.unfilteredTotal || 0;
  const totalPages = pageData?.totalPages || 0;

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds((currentSelection) => {
      const nextSelection = new Set(
        Array.from(currentSelection).filter((submissionId) =>
          submissions.some((submission) => submission.id === submissionId),
        ),
      );

      if (nextSelection.size === currentSelection.size) {
        return currentSelection;
      }

      return nextSelection;
    });
  }, [submissions]);

  const activeFiltersCount = [
    searchQuery ? 1 : 0,
    resultFilter !== "all" ? 1 : 0,
    dateRange.from || dateRange.to ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleClearFilters = () => {
    setSearchQuery("");
    setResultFilter("all");
    setDateRange({ from: undefined, to: undefined });
    setPage(1);
  };

  const handleViewDetails = (submission: FormSubmission) => {
    setSelectedSubmission(submission);
    setDetailModalOpen(true);
  };

  const selectedCount = selectedIds.size;
  const allPageRowsSelected =
    submissions.length > 0 &&
    submissions.every((submission) => selectedIds.has(submission.id));
  const somePageRowsSelected = submissions.some((submission) =>
    selectedIds.has(submission.id),
  );

  const realtimeFilters = useMemo(
    () => ({
      dateFrom,
      dateTo,
      hideTestSubmissions,
      resultFilter,
      searchQuery,
    }),
    [dateFrom, dateTo, hideTestSubmissions, resultFilter, searchQuery],
  );

  const isDefaultRealtimeView =
    page === 1 &&
    sortColumn === DEFAULT_SORT_COLUMN &&
    sortDirection === DEFAULT_SORT_DIRECTION &&
    searchQuery.trim().length === 0 &&
    resultFilter === "all" &&
    !dateFrom &&
    !dateTo;

  const highlightSubmission = useCallback((submissionId: string) => {
    setHighlightedIds((currentIds) => new Set([...currentIds, submissionId]));

    window.setTimeout(() => {
      setHighlightedIds((currentIds) => {
        if (!currentIds.has(submissionId)) {
          return currentIds;
        }

        const nextIds = new Set(currentIds);
        nextIds.delete(submissionId);
        return nextIds;
      });
    }, 4000);
  }, []);

  const handleRealtimeSubmission = useCallback(
    (submission: FormSubmission, options: { animate: boolean }) => {
      if (!submissionMatchesFilters(submission, realtimeFilters)) {
        return;
      }

      if (isDefaultRealtimeView) {
        if (options.animate) {
          highlightSubmission(submission.id);
        }
        setQueuedRealtimeCount(0);
        void refetch();
        return;
      }

      setQueuedRealtimeCount((currentCount) => currentCount + 1);
    },
    [highlightSubmission, isDefaultRealtimeView, realtimeFilters, refetch],
  );

  const { connectionState, isLive } = useFormSubmissionsRealtime({
    channelName: `form-submissions-${formId}`,
    enabled: Boolean(tenantId),
    formId,
    onSubmission: handleRealtimeSubmission,
    tenantId,
  });

  const handleRefreshQueued = useCallback(() => {
    setQueuedRealtimeCount(0);
    void refetch();
  }, [refetch]);

  const handleSortChange = (column: FormSubmissionSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortColumn(column);
    setSortDirection(column === DEFAULT_SORT_COLUMN ? "desc" : "asc");
  };

  const handleToggleSelection = (
    submissionId: string,
    nextChecked: boolean,
  ) => {
    setSelectedIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);

      if (nextChecked) {
        nextSelection.add(submissionId);
      } else {
        nextSelection.delete(submissionId);
      }

      return nextSelection;
    });
  };

  const handleTogglePageSelection = (nextChecked: boolean) => {
    setSelectedIds(() => {
      if (!nextChecked) {
        return new Set();
      }

      return new Set(submissions.map((submission) => submission.id));
    });
  };

  const handleDeleteSelected = async () => {
    if (!tenantId || selectedIds.size === 0) {
      return;
    }

    await deleteSubmissionsMutation.mutateAsync({
      formId,
      submissionIds: Array.from(selectedIds),
      tenantId,
    });

    if (selectedSubmission && selectedIds.has(selectedSubmission.id)) {
      setSelectedSubmission(null);
      setDetailModalOpen(false);
    }

    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
    void refetch();
  };

  const hasAnySubmissions = unfilteredTotal > 0;
  const showingFilteredView =
    activeFiltersCount > 0 ||
    hideTestSubmissions ||
    filteredTotal !== unfilteredTotal ||
    sortColumn !== DEFAULT_SORT_COLUMN ||
    sortDirection !== DEFAULT_SORT_DIRECTION;
  const lastSubmissionAt =
    analytics?.lastSubmission || submissions[0]?.submitted_at || null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Failed to load submissions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Submissions</p>
            {showingFilteredView && (
              <p className="mt-2 text-xs text-muted-foreground">
                {filteredTotal} currently shown
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">
                {stats.accepted}
              </span>
              <Badge
                variant="outline"
                className="text-xs bg-green-50 text-green-700 border-green-200"
              >
                {stats.acceptRate}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">
              {stats.rejected}
            </div>
            <p className="text-sm text-muted-foreground">Rejected</p>
            {stats.rejected > 0 && (
              <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                {stats.rejectionBreakdown.invalid > 0 && (
                  <span>{stats.rejectionBreakdown.invalid} invalid</span>
                )}
                {stats.rejectionBreakdown.rateLimit > 0 && (
                  <span>{stats.rejectionBreakdown.rateLimit} rate limit</span>
                )}
                {stats.rejectionBreakdown.spam > 0 && (
                  <span>{stats.rejectionBreakdown.spam} spam</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {lastSubmissionAt ? (
              <>
                <div className="text-lg font-semibold">
                  {formatDistanceToNow(new Date(lastSubmissionAt), {
                    addSuffix: true,
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(new Date(lastSubmissionAt), "PPpp")}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No submissions yet
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Last 7 days: {stats.last7Days}</span>
              {stats.trend !== 0 && (
                <Badge
                  variant="outline"
                  className={`text-xs ${stats.trend > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}
                >
                  {stats.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(stats.trend)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>
                {showingFilteredView
                  ? `Showing ${filteredTotal} of ${unfilteredTotal} submissions`
                  : `${unfilteredTotal} total submissions`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RealtimeStatusBadge
                connectionState={connectionState}
                isLive={isLive}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-test"
                  checked={hideTestSubmissions}
                  onCheckedChange={setHideTestSubmissions}
                />
                <Label
                  htmlFor="hide-test"
                  className="text-sm text-muted-foreground whitespace-nowrap"
                >
                  Hide test data
                </Label>
              </div>
              <SubmissionExport
                formId={formId}
                form={form}
                tenantId={tenantId}
                formName={form.name}
                totalCount={filteredTotal}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                resultFilter={resultFilter}
                searchQuery={searchQuery}
                dateFrom={dateFrom}
                dateTo={dateTo}
                hideTestSubmissions={hideTestSubmissions}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queuedRealtimeCount > 0 && !isDefaultRealtimeView && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {queuedRealtimeCount === 1
                    ? "1 new submission is available"
                    : `${queuedRealtimeCount} new submissions are available`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Refresh to update the current filtered or paged view.
                </p>
              </div>
              <Button size="sm" onClick={handleRefreshQueued}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh View
              </Button>
            </div>
          )}

          {/* Filters */}
          <SubmissionFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activeFiltersCount={activeFiltersCount}
            onClearFilters={handleClearFilters}
          />

          {selectedCount > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedCount === 1
                    ? "1 submission selected on this page"
                    : `${selectedCount} submissions selected on this page`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Selection is limited to the rows currently loaded on this
                  page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={!tenantId || deleteSubmissionsMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {submissions.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]">
                        <Checkbox
                          checked={
                            allPageRowsSelected
                              ? true
                              : somePageRowsSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) =>
                            handleTogglePageSelection(checked === true)
                          }
                          aria-label="Select current page"
                        />
                      </TableHead>
                      <TableHead className="w-[180px]">
                        <SortableHeader
                          column="submitted_at"
                          currentColumn={sortColumn}
                          currentDirection={sortDirection}
                          label="Timestamp"
                          onSortChange={handleSortChange}
                        />
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        <SortableHeader
                          column="name"
                          currentColumn={sortColumn}
                          currentDirection={sortDirection}
                          label="Name"
                          onSortChange={handleSortChange}
                        />
                      </TableHead>
                      <TableHead className="min-w-[220px]">
                        <SortableHeader
                          column="email"
                          currentColumn={sortColumn}
                          currentDirection={sortDirection}
                          label="Email"
                          onSortChange={handleSortChange}
                        />
                      </TableHead>
                      <TableHead className="w-[180px]">
                        <SortableHeader
                          column="result"
                          currentColumn={sortColumn}
                          currentDirection={sortDirection}
                          label="Result"
                          onSortChange={handleSortChange}
                        />
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        <SortableHeader
                          column="source"
                          currentColumn={sortColumn}
                          currentDirection={sortDirection}
                          label="Source"
                          onSortChange={handleSortChange}
                        />
                      </TableHead>
                      <TableHead className="w-[110px]">Consent</TableHead>
                      <TableHead className="text-right w-[88px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <SubmissionRow
                        key={submission.id}
                        highlighted={highlightedIds.has(submission.id)}
                        isSelected={selectedIds.has(submission.id)}
                        submission={submission}
                        onSelectedChange={(nextChecked) =>
                          handleToggleSelection(submission.id, nextChecked)
                        }
                        onViewDetails={() => handleViewDetails(submission)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {pageData?.page || page} of {totalPages}
                    {isFetching && " · Updating..."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => currentPage - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((currentPage) => currentPage + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : hasAnySubmissions ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                No matching submissions
              </h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search query.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
              <p className="text-muted-foreground">
                When users submit this form, their entries will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
          <CardHeader className="pb-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="justify-between px-0 hover:bg-transparent"
              >
                <div className="text-left">
                  <CardTitle className="text-base">Developer Tools</CardTitle>
                  <CardDescription>
                    Run the built-in test matrix without keeping it on the main
                    submissions surface.
                  </CardDescription>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${diagnosticsOpen ? "rotate-180" : "rotate-0"}`}
                />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-6">
              <FormTestMatrix form={form} />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <SubmissionDetailModal
        form={form}
        submission={selectedSubmission}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={selectedCount === 1 ? "Delete submission" : "Delete submissions"}
        description={
          selectedCount === 1
            ? "This submission will be permanently removed from form_submissions. This action cannot be undone."
            : `${selectedCount} submissions will be permanently removed from form_submissions. This action cannot be undone.`
        }
        confirmText={
          selectedCount === 1 ? "Delete Submission" : "Delete Selected"
        }
        loading={deleteSubmissionsMutation.isPending}
        loadingText="Deleting..."
        onConfirm={() => {
          void handleDeleteSelected();
        }}
      />
    </div>
  );
}

function SortableHeader({
  column,
  currentColumn,
  currentDirection,
  label,
  onSortChange,
}: {
  column: FormSubmissionSortColumn;
  currentColumn: FormSubmissionSortColumn;
  currentDirection: SortDirection;
  label: string;
  onSortChange: (column: FormSubmissionSortColumn) => void;
}) {
  const isActive = currentColumn === column;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 px-3 text-muted-foreground hover:text-foreground"
      onClick={() => onSortChange(column)}
    >
      <span>{label}</span>
      {isActive ? (
        currentDirection === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}

function RealtimeStatusBadge({
  connectionState,
  isLive,
}: {
  connectionState: "connecting" | "live" | "paused";
  isLive: boolean;
}) {
  if (connectionState === "connecting") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Connecting
      </Badge>
    );
  }

  if (!isLive) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <WifiOff className="h-3 w-3" />
        Realtime paused
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
      <Wifi className="h-3 w-3" />
      Live
    </Badge>
  );
}

interface SubmissionRowProps {
  highlighted: boolean;
  isSelected: boolean;
  submission: FormSubmission;
  onSelectedChange: (checked: boolean) => void;
  onViewDetails: () => void;
}

function SubmissionRow({
  highlighted,
  isSelected,
  submission,
  onSelectedChange,
  onViewDetails,
}: SubmissionRowProps) {
  const resultInfo = getSubmissionResultInfo(submission);
  const metadata = submission.metadata || ({} as FormSubmissionMetadata);
  const isRejected = submission.result !== "accepted";
  const isTest = isTestSubmission(submission);
  const name = getSubmissionDisplayName(submission) || "—";
  const email = getSubmissionDisplayEmail(submission);
  const source = getSubmissionDisplaySource(submission);

  return (
    <TableRow
      className={`cursor-pointer hover:bg-muted/50 ${highlighted ? "bg-emerald-50/60" : ""}`}
      onClick={onViewDetails}
    >
      <TableCell onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
          aria-label={`Select submission ${submission.id}`}
        />
      </TableCell>

      {/* Timestamp */}
      <TableCell className="whitespace-nowrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-left">
              <div className="text-sm">
                {format(new Date(submission.submitted_at), "MMM d, HH:mm")}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(submission.submitted_at), {
                  addSuffix: true,
                })}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {format(new Date(submission.submitted_at), "PPpp")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      <TableCell>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{name}</div>
          {isRejected && submission.reason && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {submission.reason}
            </p>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{email}</span>
          {isTest && (
            <Badge variant="outline" className="text-xs bg-muted border-border">
              <TestTube2 className="h-3 w-3 mr-1" />
              Test
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge
          variant={resultInfo.variant}
          className={`flex items-center gap-1 w-fit ${resultInfo.className || ""}`}
        >
          {resultInfo.icon}
          {resultInfo.shortLabel}
        </Badge>
      </TableCell>

      <TableCell>
        <div className="space-y-1">
          <span className="text-sm text-foreground">{source}</span>
          {metadata.utm_campaign && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {metadata.utm_campaign}
            </p>
          )}
        </div>
      </TableCell>

      {/* Consent */}
      <TableCell>
        <ConsentBadges metadata={metadata} />
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ConsentBadges({
  metadata,
}: {
  metadata: Partial<FormSubmissionMetadata>;
}) {
  const hasEmailConsent = metadata?.email_consent === true;
  const hasSmsConsent = metadata?.sms_consent === true;
  const noConsent = !hasEmailConsent && !hasSmsConsent;

  if (noConsent) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <div className="flex gap-1">
      {hasEmailConsent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-xs bg-blue-50 border-blue-200"
              >
                <Mail className="h-3 w-3 text-blue-600" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Email consent given</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {hasSmsConsent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-xs bg-purple-50 border-purple-200"
              >
                <MessageSquare className="h-3 w-3 text-purple-600" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>SMS consent given</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
