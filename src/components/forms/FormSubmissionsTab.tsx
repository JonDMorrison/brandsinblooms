import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Link from "@mui/joy/Link";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  CloseRounded,
  DeleteRounded,
  ExpandMoreRounded,
  FileDownloadRounded,
  SearchRounded,
} from "@mui/icons-material";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  FileJson,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link as RouterLink } from "react-router-dom";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getFileUploadDisplayValue,
  getFormFileUploadReferences,
} from "@/lib/forms/fileUploads";
import {
  getSubmissionColumnValue,
  getSubmissionDiagnosticEntries,
  getSubmissionDisplayEmail,
  getSubmissionDisplayName,
  getSubmissionDisplaySource,
  getSubmissionExportColumns,
  getSubmissionVisibleEntries,
  isTestSubmission,
  submissionMatchesFilters,
} from "@/lib/forms/submissionPresentation";
import type {
  Form,
  FormSubmission,
  FormSubmissionsPageSummary,
  FormSubmissionSortColumn,
  FormSubmissionValue,
  SortDirection,
  SubmissionResult,
} from "@/types/formBuilder";

interface FormSubmissionsTabProps {
  form: Form;
  tenantId?: string;
  onOpenPublishTab?: () => void;
}

type SubmissionResultFilter = "all" | "accepted" | "rejected";

type DeleteDialogState = {
  ids: string[];
  title: string;
  description: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT_COLUMN: FormSubmissionSortColumn = "submitted_at";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";
const DEFAULT_HIDE_TEST_SUBMISSIONS = true;
const NEW_ROW_FADE_MS = 1400;
const SEARCH_DEBOUNCE_MS = 300;
const METRIC_FLASH_MS = 200;
const EMPTY_SUBMISSIONS: FormSubmission[] = [];

type SubmissionMetricKey = "total" | "accepted" | "rejected" | "recent";
type ActiveFilterKey = "search" | "result" | "date" | "tests";

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

function sanitizeFilename(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "form";
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

function buildSubmissionExportRows(form: Form, submissions: FormSubmission[]) {
  const columns = getSubmissionExportColumns(form, submissions);

  return submissions.map((submission) => {
    const row: Record<string, unknown> = {
      submitted_at: submission.submitted_at,
      result: resultConfig[submission.result].label,
      source: getSubmissionDisplaySource(submission),
      customer_name: getSubmissionDisplayName(submission) || "",
      email: getSubmissionDisplayEmail(submission),
      linked_customer_id: submission.customer_id || "",
      is_test: isTestSubmission(submission) ? "Yes" : "No",
    };

    columns.forEach((column) => {
      row[column.label] = getSubmissionColumnValue(submission, column);
    });

    return row;
  });
}

function getAvatarLabel(submission: FormSubmission) {
  const displayName = getSubmissionDisplayName(submission)?.trim();
  if (displayName) {
    const initials = displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    if (initials) {
      return initials;
    }
  }

  const email = getSubmissionDisplayEmail(submission).trim();
  return email[0]?.toUpperCase() || "?";
}

function getSubmissionSourceUrl(submission: Pick<FormSubmission, "metadata">) {
  return submission.metadata.page_url || submission.metadata.referrer || null;
}

function getFileDownloadUrl(value: FormSubmissionValue | unknown) {
  const [reference] = getFormFileUploadReferences(value);
  if (!reference) {
    return null;
  }

  const { data } = supabase.storage
    .from(reference.bucket)
    .getPublicUrl(reference.path);

  return data.publicUrl;
}

function formatFilterDateLabel(value: string) {
  return format(new Date(`${value}T00:00:00`), "MMM d");
}

function getDateRangeChipLabel(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) {
      return formatFilterDateLabel(dateFrom);
    }

    return `${formatFilterDateLabel(dateFrom)} – ${formatFilterDateLabel(dateTo)}`;
  }

  if (dateFrom) {
    return `From ${formatFilterDateLabel(dateFrom)}`;
  }

  if (dateTo) {
    return `Until ${formatFilterDateLabel(dateTo)}`;
  }

  return "";
}

function getTrendChipLabel(value: number) {
  if (value > 0) {
    return `↑ ${Math.abs(value)}%`;
  }

  if (value < 0) {
    return `↓ ${Math.abs(value)}%`;
  }

  return "— 0%";
}

function SubmissionMetricCell(props: {
  index: number;
  label: string;
  value: number;
  subtitle: string;
  flash?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Box
      data-metric-cell
      sx={{
        flex: { xs: "1 1 50%", md: "1 1 0" },
        minWidth: 0,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        borderRight: {
          xs: props.index % 2 === 0 ? "1px solid" : "none",
          md: props.index < 3 ? "1px solid" : "none",
        },
        borderBottom: {
          xs: props.index < 2 ? "1px solid" : "none",
          md: "none",
        },
        borderColor: "neutral.200",
      }}
    >
      <Typography
        level="body-xs"
        sx={{
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "neutral.500",
          fontWeight: "lg",
        }}
      >
        {props.label}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
      >
        <Typography
          level="h3"
          sx={{
            fontWeight: "xl",
            borderRadius: "sm",
            px: 0.5,
            ml: -0.5,
            animation: props.flash
              ? `submissionMetricFlash ${METRIC_FLASH_MS}ms ease`
              : undefined,
            "@keyframes submissionMetricFlash": {
              from: { backgroundColor: "transparent" },
              "50%": { backgroundColor: "var(--joy-palette-primary-softBg)" },
              to: { backgroundColor: "transparent" },
            },
          }}
        >
          {props.value}
        </Typography>
        {props.badge}
      </Stack>
      <Typography level="body-xs" sx={{ color: "neutral.400" }}>
        {props.subtitle}
      </Typography>
    </Box>
  );
}

function MetadataBlock(props: { label: string; value?: React.ReactNode }) {
  let content: React.ReactNode;

  if (props.value === undefined || props.value === null || props.value === "") {
    content = (
      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
        Not captured
      </Typography>
    );
  } else if (
    typeof props.value === "string" ||
    typeof props.value === "number"
  ) {
    content = (
      <Typography
        level="body-sm"
        sx={{
          fontWeight: 600,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {props.value}
      </Typography>
    );
  } else {
    content = <Box sx={{ overflowWrap: "anywhere" }}>{props.value}</Box>;
  }

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography level="body-xs" color="neutral">
        {props.label}
      </Typography>
      {content}
    </Stack>
  );
}

function SubmissionsSkeleton() {
  return (
    <Stack spacing={2}>
      <Sheet
        variant="outlined"
        sx={{
          bgcolor: "background.surface",
          borderColor: "neutral.200",
          borderRadius: "var(--joy-radius-lg)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: { xs: "wrap", md: "nowrap" },
            alignItems: "stretch",
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Box
              key={index}
              sx={{
                flex: { xs: "1 1 50%", md: "1 1 0" },
                minWidth: 0,
                p: 2,
                borderRight: {
                  xs: index % 2 === 0 ? "1px solid" : "none",
                  md: index < 3 ? "1px solid" : "none",
                },
                borderBottom: {
                  xs: index < 2 ? "1px solid" : "none",
                  md: "none",
                },
                borderColor: "neutral.200",
              }}
            >
              <Stack spacing={1}>
                <Skeleton variant="text" width={60} height={12} />
                <Skeleton
                  variant="rectangular"
                  width={64}
                  height={32}
                  sx={{ borderRadius: "sm" }}
                />
                <Skeleton variant="text" width={120} height={12} />
              </Stack>
            </Box>
          ))}
        </Box>
      </Sheet>

      <Sheet
        variant="outlined"
        sx={{
          bgcolor: "background.surface",
          borderColor: "neutral.200",
          borderRadius: "var(--joy-radius-lg)",
          p: 1.5,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Skeleton
          variant="rectangular"
          height={32}
          sx={{
            flex: { xs: "1 1 100%", lg: "1 1 auto" },
            minWidth: 200,
            maxWidth: { xs: "100%", lg: 320 },
            borderRadius: "sm",
          }}
        />
        <Skeleton
          variant="rectangular"
          width={200}
          height={32}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width={140}
          height={32}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width={140}
          height={32}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width={80}
          height={20}
          sx={{ borderRadius: "sm" }}
        />
        <Skeleton
          variant="rectangular"
          width={88}
          height={32}
          sx={{ borderRadius: "sm" }}
        />
      </Sheet>

      <Skeleton variant="text" width={120} height={14} />

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          bgcolor: "background.surface",
          p: 2,
        }}
      >
        <Skeleton
          variant="rectangular"
          height={520}
          sx={{ borderRadius: "md" }}
        />
      </Sheet>
    </Stack>
  );
}

export function FormSubmissionsTab({
  form,
  tenantId,
  onOpenPublishTab,
}: FormSubmissionsTabProps) {
  const { toast } = useToast();
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const tableRegionRef = React.useRef<HTMLDivElement | null>(null);
  const rowRefs = React.useRef(new Map<string, HTMLTableRowElement>());
  const revealTimeoutsRef = React.useRef(new Map<string, number>());
  const filterChipRefs = React.useRef(
    new Map<ActiveFilterKey, HTMLButtonElement>(),
  );
  const pendingBannerScrollRef = React.useRef<number | null>(null);
  const previousSummaryRef = React.useRef<FormSubmissionsPageSummary | null>(
    null,
  );
  const metricFlashTimeoutRef = React.useRef<number | null>(null);

  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [showSearchHint, setShowSearchHint] = React.useState(true);
  const [resultFilter, setResultFilter] =
    React.useState<SubmissionResultFilter>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [hideTestSubmissions, setHideTestSubmissions] = React.useState(
    DEFAULT_HIDE_TEST_SUBMISSIONS,
  );
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [sortColumn, setSortColumn] =
    React.useState<FormSubmissionSortColumn>(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectedSubmission, setSelectedSubmission] =
    React.useState<FormSubmission | null>(null);
  const [pendingRealtimeIds, setPendingRealtimeIds] = React.useState<string[]>(
    [],
  );
  const [newRowIds, setNewRowIds] = React.useState<Set<string>>(new Set());
  const [fadingNewRowIds, setFadingNewRowIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [metricFlashKeys, setMetricFlashKeys] = React.useState<
    Set<SubmissionMetricKey>
  >(new Set());
  const [deleteDialog, setDeleteDialog] =
    React.useState<DeleteDialogState | null>(null);
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);
  const [showRawJson, setShowRawJson] = React.useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] =
    React.useState<HTMLElement | null>(null);
  const [pendingFocusTarget, setPendingFocusTarget] = React.useState<
    ActiveFilterKey | "search" | null
  >(null);

  const serverResultFilter =
    resultFilter === "rejected" ? "rejected" : resultFilter;

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
    serverResultFilter,
    searchQuery,
    dateFrom || null,
    dateTo || null,
    hideTestSubmissions,
  );

  const submissions = pageData?.rows ?? EMPTY_SUBMISSIONS;
  const summary = pageData?.summary;
  const filteredTotal = pageData?.filteredTotal ?? 0;
  const unfilteredTotal = pageData?.unfilteredTotal ?? 0;
  const selectedOnPageCount = submissions.filter((submission) =>
    selectedIds.has(submission.id),
  ).length;
  const selectedCount = selectedIds.size;
  const allRowsSelected =
    submissions.length > 0 && selectedOnPageCount === submissions.length;
  const someRowsSelected = selectedOnPageCount > 0 && !allRowsSelected;

  const activeSubmission = React.useMemo(() => {
    if (!selectedSubmission) {
      return null;
    }

    return (
      submissions.find(
        (submission) => submission.id === selectedSubmission.id,
      ) || selectedSubmission
    );
  }, [selectedSubmission, submissions]);

  const visibleEntries = React.useMemo(
    () =>
      activeSubmission
        ? getSubmissionVisibleEntries(form, activeSubmission)
        : [],
    [activeSubmission, form],
  );
  const diagnosticEntries = React.useMemo(
    () =>
      activeSubmission
        ? getSubmissionDiagnosticEntries(form, activeSubmission)
        : [],
    [activeSubmission, form],
  );
  const exportRows = React.useMemo(
    () => buildSubmissionExportRows(form, submissions),
    [form, submissions],
  );
  const submissionBaseName = sanitizeFilename(
    form.name || form.settings.form_title || "form",
  );

  const realtimeFilters = React.useMemo(
    () => ({
      searchQuery,
      resultFilter: serverResultFilter,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      hideTestSubmissions,
    }),
    [dateFrom, dateTo, hideTestSubmissions, searchQuery, serverResultFilter],
  );

  const { connectionState, isLive, reconnect } = useFormSubmissionsRealtime({
    channelName: `form-submissions-${form.id}`,
    enabled: Boolean(tenantId),
    formId: form.id,
    tenantId,
    onSubmission: (submission) => {
      if (!submissionMatchesFilters(submission, realtimeFilters)) {
        return;
      }

      setPendingRealtimeIds((current) => {
        if (current.includes(submission.id) || newRowIds.has(submission.id)) {
          return current;
        }

        return [submission.id, ...current];
      });
    },
  });

  const showDisconnected = connectionState === "offline";
  const showConnecting = connectionState === "connecting";
  const acceptedOnPageCount = React.useMemo(
    () =>
      submissions.filter((submission) => submission.result === "accepted")
        .length,
    [submissions],
  );
  const rejectedOnPageCount = React.useMemo(
    () =>
      submissions.filter((submission) => submission.result !== "accepted")
        .length,
    [submissions],
  );
  const resultTabCounts = React.useMemo(() => {
    if (resultFilter === "all") {
      return {
        all: filteredTotal,
        accepted: summary?.accepted ?? acceptedOnPageCount,
        rejected: summary?.rejected ?? rejectedOnPageCount,
      };
    }

    return {
      all: filteredTotal,
      accepted:
        resultFilter === "accepted" ? filteredTotal : acceptedOnPageCount,
      rejected:
        resultFilter === "rejected" ? filteredTotal : rejectedOnPageCount,
    };
  }, [
    acceptedOnPageCount,
    filteredTotal,
    rejectedOnPageCount,
    resultFilter,
    summary?.accepted,
    summary?.rejected,
  ]);
  const trimmedSearchQuery = searchQuery.trim();
  const isResultFilterActive = resultFilter !== "all";
  const isDateFilterActive = Boolean(dateFrom || dateTo);
  const isHideTestsFilterActive =
    hideTestSubmissions !== DEFAULT_HIDE_TEST_SUBMISSIONS;
  const activeFilterKeys = React.useMemo(() => {
    const keys: ActiveFilterKey[] = [];

    if (trimmedSearchQuery) {
      keys.push("search");
    }

    if (isResultFilterActive) {
      keys.push("result");
    }

    if (isDateFilterActive) {
      keys.push("date");
    }

    if (isHideTestsFilterActive && hideTestSubmissions) {
      keys.push("tests");
    }

    return keys;
  }, [
    hideTestSubmissions,
    isDateFilterActive,
    isHideTestsFilterActive,
    isResultFilterActive,
    trimmedSearchQuery,
  ]);

  React.useEffect(() => {
    const nextSearchQuery = searchInput.trim();
    const timeoutId = window.setTimeout(() => {
      setSearchQuery((current) =>
        current === nextSearchQuery ? current : nextSearchQuery,
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [
    dateFrom,
    dateTo,
    hideTestSubmissions,
    pageSize,
    resultFilter,
    searchQuery,
    sortColumn,
    sortDirection,
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

  React.useEffect(() => {
    if (!pageData) {
      return;
    }

    if (pageData.totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }

    if (pageData.totalPages > 0 && page > pageData.totalPages) {
      setPage(pageData.totalPages);
    }
  }, [page, pageData]);

  React.useEffect(() => {
    setPendingRealtimeIds([]);
    setNewRowIds(new Set());
    setFadingNewRowIds(new Set());
  }, [dateFrom, dateTo, hideTestSubmissions, resultFilter, searchQuery]);

  React.useEffect(() => {
    setShowDiagnostics(false);
    setShowRawJson(false);
  }, [activeSubmission?.id]);

  React.useEffect(() => {
    setNewRowIds((current) => {
      if (current.size === 0) {
        return current;
      }

      const visibleIds = new Set(
        submissions.map((submission) => submission.id),
      );
      const next = new Set(
        Array.from(current).filter((submissionId) =>
          visibleIds.has(submissionId),
        ),
      );

      return next.size === current.size ? current : next;
    });

    setFadingNewRowIds((current) => {
      if (current.size === 0) {
        return current;
      }

      const visibleIds = new Set(
        submissions.map((submission) => submission.id),
      );
      const next = new Set(
        Array.from(current).filter((submissionId) =>
          visibleIds.has(submissionId),
        ),
      );

      return next.size === current.size ? current : next;
    });
  }, [submissions]);

  React.useEffect(() => {
    const timeoutMap = revealTimeoutsRef.current;

    return () => {
      timeoutMap.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutMap.clear();

      if (metricFlashTimeoutRef.current !== null) {
        window.clearTimeout(metricFlashTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!summary) {
      return;
    }

    const previousSummary = previousSummaryRef.current;
    if (!previousSummary) {
      previousSummaryRef.current = summary;
      return;
    }

    const changedKeys = new Set<SubmissionMetricKey>();

    if (previousSummary.total !== summary.total) {
      changedKeys.add("total");
    }
    if (previousSummary.accepted !== summary.accepted) {
      changedKeys.add("accepted");
    }
    if (previousSummary.rejected !== summary.rejected) {
      changedKeys.add("rejected");
    }
    if (previousSummary.last7Days !== summary.last7Days) {
      changedKeys.add("recent");
    }

    if (changedKeys.size > 0) {
      setMetricFlashKeys(changedKeys);

      if (metricFlashTimeoutRef.current !== null) {
        window.clearTimeout(metricFlashTimeoutRef.current);
      }

      metricFlashTimeoutRef.current = window.setTimeout(() => {
        setMetricFlashKeys(new Set());
      }, METRIC_FLASH_MS);
    }

    previousSummaryRef.current = summary;
  }, [summary]);

  React.useEffect(() => {
    if (!pendingFocusTarget) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (pendingFocusTarget === "search") {
        searchInputRef.current?.focus();
      } else {
        filterChipRefs.current.get(pendingFocusTarget)?.focus();
      }

      setPendingFocusTarget(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeFilterKeys, pendingFocusTarget]);

  React.useEffect(() => {
    if (pendingRealtimeIds.length > 0) {
      pendingBannerScrollRef.current = window.scrollY;
      return;
    }

    pendingBannerScrollRef.current = null;
  }, [pendingRealtimeIds.length]);

  React.useEffect(() => {
    const idsToObserve = Array.from(newRowIds).filter(
      (submissionId) => !fadingNewRowIds.has(submissionId),
    );

    if (idsToObserve.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const submissionId = entry.target.getAttribute("data-submission-id");
          if (!submissionId || revealTimeoutsRef.current.has(submissionId)) {
            return;
          }

          setFadingNewRowIds((current) => {
            if (current.has(submissionId)) {
              return current;
            }

            const next = new Set(current);
            next.add(submissionId);
            return next;
          });

          const timeoutId = window.setTimeout(() => {
            revealTimeoutsRef.current.delete(submissionId);

            setNewRowIds((current) => {
              if (!current.has(submissionId)) {
                return current;
              }

              const next = new Set(current);
              next.delete(submissionId);
              return next;
            });

            setFadingNewRowIds((current) => {
              if (!current.has(submissionId)) {
                return current;
              }

              const next = new Set(current);
              next.delete(submissionId);
              return next;
            });
          }, NEW_ROW_FADE_MS);

          revealTimeoutsRef.current.set(submissionId, timeoutId);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.65 },
    );

    idsToObserve.forEach((submissionId) => {
      const row = rowRefs.current.get(submissionId);
      if (row) {
        observer.observe(row);
      }
    });

    return () => observer.disconnect();
  }, [fadingNewRowIds, newRowIds]);

  const setRowRef = React.useCallback(
    (submissionId: string, node: HTMLTableRowElement | null) => {
      if (node) {
        rowRefs.current.set(submissionId, node);
        return;
      }

      rowRefs.current.delete(submissionId);
    },
    [],
  );

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

  const clearFilters = React.useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setResultFilter("all");
    setDateFrom("");
    setDateTo("");
    setHideTestSubmissions(DEFAULT_HIDE_TEST_SUBMISSIONS);
  }, []);

  const handleRefresh = React.useCallback(() => {
    setPendingRealtimeIds([]);
    void refetch();
  }, [refetch]);

  const handleConnectionRetry = React.useCallback(() => {
    reconnect();
    void refetch();
  }, [reconnect, refetch]);

  const handleShowNewSubmissions = React.useCallback(() => {
    if (pendingRealtimeIds.length === 0) {
      return;
    }

    tableRegionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setPendingRealtimeIds([]);
    setNewRowIds((current) => new Set([...current, ...pendingRealtimeIds]));

    const needsNewestView =
      page !== 1 ||
      sortColumn !== DEFAULT_SORT_COLUMN ||
      sortDirection !== DEFAULT_SORT_DIRECTION;

    if (needsNewestView) {
      setPage(1);
      setSortColumn(DEFAULT_SORT_COLUMN);
      setSortDirection(DEFAULT_SORT_DIRECTION);
      return;
    }

    void refetch();
  }, [page, pendingRealtimeIds, refetch, sortColumn, sortDirection]);

  React.useEffect(() => {
    if (pendingRealtimeIds.length === 0) {
      return;
    }

    const maybeRevealPendingSubmissions = () => {
      if (pendingBannerScrollRef.current === null) {
        return;
      }

      if (Math.abs(window.scrollY - pendingBannerScrollRef.current) < 24) {
        return;
      }

      const top = tableRegionRef.current?.getBoundingClientRect().top;
      if (typeof top !== "number") {
        return;
      }

      if (top >= 0 && top <= 120) {
        handleShowNewSubmissions();
      }
    };

    window.addEventListener("scroll", maybeRevealPendingSubmissions, {
      passive: true,
    });
    window.addEventListener("resize", maybeRevealPendingSubmissions);

    return () => {
      window.removeEventListener("scroll", maybeRevealPendingSubmissions);
      window.removeEventListener("resize", maybeRevealPendingSubmissions);
    };
  }, [handleShowNewSubmissions, pendingRealtimeIds.length]);

  const handleCopySubmissionId = React.useCallback(
    async (submissionId: string) => {
      try {
        await navigator.clipboard.writeText(submissionId);
        toast({
          title: "Submission ID copied",
          description: "The submission ID is ready to paste.",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Clipboard access was unavailable.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const openDeleteDialog = React.useCallback(
    (ids: string[], title: string, description: string) => {
      setDeleteDialog({ ids, title, description });
    },
    [],
  );

  const handleDelete = React.useCallback(async () => {
    if (!tenantId || !deleteDialog || deleteDialog.ids.length === 0) {
      return;
    }

    await deleteMutation.mutateAsync({
      formId: form.id,
      submissionIds: deleteDialog.ids,
      tenantId,
    });

    setSelectedIds((current) => {
      const next = new Set(current);
      deleteDialog.ids.forEach((id) => next.delete(id));
      return next;
    });
    setPendingRealtimeIds((current) =>
      current.filter(
        (submissionId) => !deleteDialog.ids.includes(submissionId),
      ),
    );
    setNewRowIds((current) => {
      const next = new Set(current);
      deleteDialog.ids.forEach((id) => next.delete(id));
      return next;
    });
    setFadingNewRowIds((current) => {
      const next = new Set(current);
      deleteDialog.ids.forEach((id) => next.delete(id));
      return next;
    });

    if (activeSubmission && deleteDialog.ids.includes(activeSubmission.id)) {
      setSelectedSubmission(null);
    }

    setDeleteDialog(null);
  }, [activeSubmission, deleteDialog, deleteMutation, form.id, tenantId]);

  const handleSearchClear = React.useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setShowSearchHint(true);
    searchInputRef.current?.focus();
  }, []);

  const handleDateClear = React.useCallback(() => {
    setDateFrom("");
    setDateTo("");
  }, []);

  const focusAfterFilterRemoval = React.useCallback(
    (filterKey: ActiveFilterKey) => {
      const nextKeys = activeFilterKeys.filter((key) => key !== filterKey);
      setPendingFocusTarget(nextKeys[0] ?? "search");
    },
    [activeFilterKeys],
  );

  const handleClearAllFilters = React.useCallback(() => {
    clearFilters();
    setPendingFocusTarget("search");
  }, [clearFilters]);

  const handleExportMenuToggle = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setExportMenuAnchor((current) => (current ? null : event.currentTarget));
    },
    [],
  );

  const handleExportMenuClose = React.useCallback(() => {
    setExportMenuAnchor(null);
  }, []);

  const handleExportCsv = React.useCallback(() => {
    handleExportMenuClose();

    if (submissions.length === 0) {
      return;
    }

    exportCsv(`${submissionBaseName}-submissions.csv`, exportRows);
  }, [
    exportRows,
    handleExportMenuClose,
    submissionBaseName,
    submissions.length,
  ]);

  const handleExportJson = React.useCallback(() => {
    handleExportMenuClose();

    if (submissions.length === 0) {
      return;
    }

    exportJson(`${submissionBaseName}-submissions.json`, submissions);
  }, [handleExportMenuClose, submissionBaseName, submissions]);

  if (isLoading) {
    return <SubmissionsSkeleton />;
  }

  const hasActiveFilters = Boolean(
    trimmedSearchQuery ||
    isResultFilterActive ||
    isDateFilterActive ||
    isHideTestsFilterActive,
  );

  const trendValue = summary?.trend ?? 0;
  const trendColor =
    trendValue > 0 ? "success" : trendValue < 0 ? "danger" : "neutral";
  const noSubmissionsYet = unfilteredTotal === 0;
  const noMatchingFilters = !noSubmissionsYet && filteredTotal === 0;
  const customerHref = activeSubmission?.customer_id
    ? `/crm/customers/${activeSubmission.customer_id}`
    : null;
  const sourceUrl = activeSubmission
    ? getSubmissionSourceUrl(activeSubmission)
    : null;
  const exportDisabled = submissions.length === 0;
  const resultSummaryText = trimmedSearchQuery
    ? `${filteredTotal} submission${filteredTotal === 1 ? "" : "s"} matching "${trimmedSearchQuery}"`
    : hasActiveFilters
      ? `Showing ${filteredTotal} of ${unfilteredTotal} submissions`
      : `${filteredTotal} submission${filteredTotal === 1 ? "" : "s"}`;
  const resultFilterLabel =
    resultFilter === "accepted" ? "Accepted" : "Rejected";
  const dateRangeChipLabel = getDateRangeChipLabel(dateFrom, dateTo);
  const consentRows = activeSubmission
    ? [
        {
          id: "email",
          label: "Email consent",
          granted: Boolean(activeSubmission.metadata.email_consent),
          required: activeSubmission.metadata.email_consent_required,
          capturedAt: activeSubmission.metadata.email_consent_at,
          text: activeSubmission.metadata.email_consent_text,
        },
        {
          id: "sms",
          label: "SMS consent",
          granted: Boolean(activeSubmission.metadata.sms_consent),
          required: activeSubmission.metadata.sms_consent_required,
          capturedAt: activeSubmission.metadata.sms_consent_at,
          text: activeSubmission.metadata.sms_consent_text,
        },
      ].filter(
        (row) => row.granted || row.required || row.capturedAt || row.text,
      )
    : [];

  return (
    <Stack spacing={2}>
      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          bgcolor: "background.surface",
          overflow: "hidden",
          position: "relative",
          pt: { xs: 4.75, md: 4 },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 1.25,
            right: 1.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            zIndex: 1,
          }}
          aria-live="polite"
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              bgcolor: isLive
                ? "success.400"
                : showConnecting
                  ? "warning.400"
                  : "danger.400",
              animation: showConnecting
                ? "submissionPulse 1.5s infinite"
                : undefined,
              "@keyframes submissionPulse": {
                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                "50%": { opacity: 0.5, transform: "scale(1.3)" },
              },
            }}
          />
          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", fontWeight: "md" }}
          >
            {isLive ? "Live" : showConnecting ? "Reconnecting…" : "Offline"}
          </Typography>
          {showDisconnected ? (
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              onClick={handleConnectionRetry}
              loading={isFetching}
              sx={{ minHeight: "auto", px: 0.5, fontSize: "0.75rem" }}
            >
              Retry
            </Button>
          ) : null}
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", md: "row" },
            flexWrap: { xs: "wrap", md: "nowrap" },
            alignItems: "stretch",
          }}
        >
          <SubmissionMetricCell
            index={0}
            label="Total"
            value={summary?.total ?? 0}
            subtitle="in this form"
            flash={metricFlashKeys.has("total")}
          />
          <SubmissionMetricCell
            index={1}
            label="Accepted"
            value={summary?.accepted ?? 0}
            subtitle="acceptance rate"
            flash={metricFlashKeys.has("accepted")}
            badge={
              <Chip size="sm" variant="soft" color="success">
                {summary?.acceptRate ?? 0}%
              </Chip>
            }
          />
          <SubmissionMetricCell
            index={2}
            label="Rejected"
            value={summary?.rejected ?? 0}
            subtitle={`${summary?.rejectionBreakdown.invalid ?? 0} invalid · ${summary?.rejectionBreakdown.rateLimit ?? 0} rate limited · ${summary?.rejectionBreakdown.spam ?? 0} spam`}
            flash={metricFlashKeys.has("rejected")}
            badge={
              summary?.rejected ? (
                <Chip size="sm" variant="soft" color="danger">
                  {summary?.rejected
                    ? Math.round(
                        (summary.rejected / Math.max(summary.total, 1)) * 100,
                      )
                    : 0}
                  %
                </Chip>
              ) : undefined
            }
          />
          <SubmissionMetricCell
            index={3}
            label="Last 7 days"
            value={summary?.last7Days ?? 0}
            subtitle="vs previous 7 days"
            flash={metricFlashKeys.has("recent")}
            badge={
              <Chip size="sm" variant="soft" color={trendColor}>
                {getTrendChipLabel(trendValue)}
              </Chip>
            }
          />
        </Box>
      </Sheet>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          bgcolor: "background.surface",
          p: 1.5,
          display: "flex",
          flexDirection: "row",
          alignItems: { xs: "stretch", lg: "center" },
          gap: 1.5,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onFocus={() => {
            setIsSearchFocused(true);
            setShowSearchHint(false);
          }}
          onBlur={() => {
            setIsSearchFocused(false);
            if (!searchInput.trim()) {
              setShowSearchHint(true);
            }
          }}
          variant="plain"
          size="sm"
          placeholder="Search submissions…"
          startDecorator={
            <SearchRounded sx={{ fontSize: 18, color: "neutral.500" }} />
          }
          endDecorator={
            searchInput.trim() ? (
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={handleSearchClear}
                aria-label="Clear submission search"
                sx={{ p: 0.25 }}
              >
                <CloseRounded sx={{ fontSize: 16 }} />
              </IconButton>
            ) : showSearchHint ? (
              <Chip
                size="sm"
                variant="plain"
                color="neutral"
                sx={{ pointerEvents: "none" }}
              >
                /
              </Chip>
            ) : null
          }
          slotProps={{
            input: {
              ref: searchInputRef,
              role: "searchbox",
              "aria-label": "Search submissions",
            },
          }}
          sx={{
            flex: { xs: "1 1 100%", lg: "0 1 320px" },
            minWidth: 200,
            maxWidth: { xs: "100%", lg: isSearchFocused ? 400 : 320 },
            "--Input-focusedThickness": "0px",
            transition: "max-width 200ms ease",
          }}
        />

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent={{ xs: "flex-start", lg: "flex-end" }}
          useFlexGap
          flexWrap="wrap"
          sx={{
            flex: { xs: "1 1 100%", lg: "1 1 auto" },
            minWidth: 0,
          }}
        >
          <Tabs
            value={resultFilter}
            onChange={(_, value) => {
              if (value) {
                setResultFilter(value as SubmissionResultFilter);
              }
            }}
            size="sm"
            sx={{
              flex: { xs: "1 1 100%", sm: "0 0 auto" },
              minWidth: 0,
            }}
          >
            <TabList
              disableUnderline
              sx={{
                bgcolor: "background.level1",
                borderRadius: "md",
                p: 0.5,
                gap: 0.5,
                overflowX: "auto",
                boxShadow: "sm",
              }}
            >
              {(
                [
                  ["all", `All (${resultTabCounts.all})`],
                  ["accepted", `Accepted (${resultTabCounts.accepted})`],
                  ["rejected", `Rejected (${resultTabCounts.rejected})`],
                ] as Array<[SubmissionResultFilter, string]>
              ).map(([value, label]) => (
                <Tab
                  key={value}
                  disableIndicator
                  value={value}
                  sx={{
                    flexShrink: 0,
                    borderRadius: "sm",
                    px: 1.5,
                    py: 0.5,
                    fontSize: "xs",
                    fontWeight: "md",
                    transition: "all 150ms ease",
                    "&[aria-selected='true']": {
                      bgcolor: "background.surface",
                      boxShadow: "sm",
                      fontWeight: "lg",
                    },
                  }}
                >
                  {label}
                </Tab>
              ))}
            </TabList>
          </Tabs>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              flexWrap: "nowrap",
              flex: { xs: "1 1 100%", md: "0 0 auto" },
            }}
          >
            <Input
              type="date"
              size="sm"
              variant="outlined"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              slotProps={{ input: { "aria-label": "Filter from date" } }}
              sx={{ width: { xs: 100, sm: 120, md: 140 } }}
            />
            <Typography level="body-sm" sx={{ color: "neutral.400" }}>
              —
            </Typography>
            <Input
              type="date"
              size="sm"
              variant="outlined"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              slotProps={{ input: { "aria-label": "Filter to date" } }}
              sx={{ width: { xs: 100, sm: 120, md: 140 } }}
            />
            {isDateFilterActive ? (
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={handleDateClear}
                aria-label="Clear date range filters"
                sx={{ alignSelf: "center" }}
              >
                <CloseRounded sx={{ fontSize: 16 }} />
              </IconButton>
            ) : null}
          </Box>

          <Tooltip
            title="Exclude submissions flagged as test or QA traffic"
            placement="top"
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flexShrink: 0,
              }}
            >
              <Switch
                size="sm"
                color="neutral"
                checked={hideTestSubmissions}
                onChange={(event) =>
                  setHideTestSubmissions(event.target.checked)
                }
                slotProps={{ input: { "aria-label": "Hide test submissions" } }}
              />
              <Typography
                level="body-xs"
                sx={{
                  fontWeight: "md",
                  display: { xs: "none", sm: "block" },
                }}
              >
                Hide tests
              </Typography>
            </Box>
          </Tooltip>

          <Divider
            orientation="vertical"
            sx={{
              mx: 0.5,
              height: 24,
              display: { xs: "none", lg: "block" },
            }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<FileDownloadRounded sx={{ fontSize: 16 }} />}
              endDecorator={<ExpandMoreRounded sx={{ fontSize: 16 }} />}
              onClick={handleExportMenuToggle}
              aria-label="Export submissions"
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            >
              Export
            </Button>
            <Tooltip title="Export">
              <IconButton
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={handleExportMenuToggle}
                aria-label="Export submissions"
                sx={{ display: { xs: "inline-flex", sm: "none" } }}
              >
                <FileDownloadRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {selectedCount > 0 ? (
              <Button
                size="sm"
                variant="soft"
                color="danger"
                startDecorator={<DeleteRounded sx={{ fontSize: 16 }} />}
                onClick={() =>
                  openDeleteDialog(
                    Array.from(selectedIds),
                    `Delete ${selectedCount} submission${selectedCount === 1 ? "" : "s"}?`,
                    "This action cannot be undone.",
                  )
                }
                disabled={deleteMutation.isPending}
                aria-label={`Delete selected submissions (${selectedCount})`}
              >
                Delete ({selectedCount})
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={handleExportMenuClose}
          onBackdropClick={handleExportMenuClose}
          placement="bottom-end"
          sx={{
            bgcolor: "background.surface",
            minWidth: 180,
            animation: "submissionsExportMenuFade 100ms ease-out",
            "@keyframes submissionsExportMenuFade": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <Tooltip
            title={exportDisabled ? "No submissions to export" : ""}
            disableHoverListener={!exportDisabled}
            disableFocusListener={!exportDisabled}
            disableTouchListener={!exportDisabled}
          >
            <Box>
              <MenuItem disabled={exportDisabled} onClick={handleExportCsv}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ width: "100%" }}
                >
                  <Typography level="body-sm">Export as CSV</Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color="neutral"
                    sx={{ ml: "auto" }}
                  >
                    CSV
                  </Chip>
                </Stack>
              </MenuItem>
            </Box>
          </Tooltip>
          <Tooltip
            title={exportDisabled ? "No submissions to export" : ""}
            disableHoverListener={!exportDisabled}
            disableFocusListener={!exportDisabled}
            disableTouchListener={!exportDisabled}
          >
            <Box>
              <MenuItem disabled={exportDisabled} onClick={handleExportJson}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ width: "100%" }}
                >
                  <Typography level="body-sm">Export as JSON</Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color="neutral"
                    sx={{ ml: "auto" }}
                  >
                    JSON
                  </Chip>
                </Stack>
              </MenuItem>
            </Box>
          </Tooltip>
        </Menu>
      </Sheet>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
          minHeight: 28,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{ minWidth: 0 }}
        >
          <Typography
            level="body-xs"
            sx={{ color: "neutral.500" }}
            aria-live="polite"
          >
            {resultSummaryText}
          </Typography>

          {trimmedSearchQuery ? (
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{
                animation: "submissionChipEnter 150ms ease-out",
                "@keyframes submissionChipEnter": {
                  from: { opacity: 0, transform: "scale(0.85)" },
                  to: { opacity: 1, transform: "scale(1)" },
                },
              }}
              endDecorator={
                <IconButton
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) {
                      filterChipRefs.current.set("search", node);
                      return;
                    }

                    filterChipRefs.current.delete("search");
                  }}
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  aria-label={`Remove filter: search ${trimmedSearchQuery}`}
                  onClick={() => {
                    focusAfterFilterRemoval("search");
                    handleSearchClear();
                  }}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
            >
              {`"${trimmedSearchQuery}"`}
            </Chip>
          ) : null}

          {isResultFilterActive ? (
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{
                animation: "submissionChipEnter 150ms ease-out",
                "@keyframes submissionChipEnter": {
                  from: { opacity: 0, transform: "scale(0.85)" },
                  to: { opacity: 1, transform: "scale(1)" },
                },
              }}
              endDecorator={
                <IconButton
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) {
                      filterChipRefs.current.set("result", node);
                      return;
                    }

                    filterChipRefs.current.delete("result");
                  }}
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  aria-label={`Remove filter: ${resultFilterLabel}`}
                  onClick={() => {
                    focusAfterFilterRemoval("result");
                    setResultFilter("all");
                  }}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
            >
              {resultFilterLabel}
            </Chip>
          ) : null}

          {isDateFilterActive ? (
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{
                animation: "submissionChipEnter 150ms ease-out",
                "@keyframes submissionChipEnter": {
                  from: { opacity: 0, transform: "scale(0.85)" },
                  to: { opacity: 1, transform: "scale(1)" },
                },
              }}
              endDecorator={
                <IconButton
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) {
                      filterChipRefs.current.set("date", node);
                      return;
                    }

                    filterChipRefs.current.delete("date");
                  }}
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  aria-label={`Remove filter: ${dateRangeChipLabel}`}
                  onClick={() => {
                    focusAfterFilterRemoval("date");
                    handleDateClear();
                  }}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
            >
              {dateRangeChipLabel}
            </Chip>
          ) : null}

          {isHideTestsFilterActive && hideTestSubmissions ? (
            <Chip
              size="sm"
              variant="soft"
              color="neutral"
              sx={{
                animation: "submissionChipEnter 150ms ease-out",
                "@keyframes submissionChipEnter": {
                  from: { opacity: 0, transform: "scale(0.85)" },
                  to: { opacity: 1, transform: "scale(1)" },
                },
              }}
              endDecorator={
                <IconButton
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) {
                      filterChipRefs.current.set("tests", node);
                      return;
                    }

                    filterChipRefs.current.delete("tests");
                  }}
                  size="sm"
                  variant="plain"
                  color="neutral"
                  sx={{ p: 0.25 }}
                  aria-label="Remove filter: hiding tests"
                  onClick={() => {
                    focusAfterFilterRemoval("tests");
                    setHideTestSubmissions(DEFAULT_HIDE_TEST_SUBMISSIONS);
                  }}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              }
            >
              Hiding tests
            </Chip>
          ) : null}
        </Stack>

        {hasActiveFilters ? (
          <Button
            size="sm"
            variant={filteredTotal === 0 ? "soft" : "plain"}
            color="neutral"
            onClick={handleClearAllFilters}
          >
            Clear all
          </Button>
        ) : null}
      </Box>

      {pendingRealtimeIds.length > 0 ? (
        <Sheet
          variant="soft"
          color="primary"
          role="status"
          aria-live="polite"
          sx={{
            borderRadius: "md",
            py: 1,
            px: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            animation: "submissionsBannerSlideIn 200ms ease-out",
            "@keyframes submissionsBannerSlideIn": {
              from: { opacity: 0, transform: "translateY(-8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Typography level="body-sm" sx={{ fontWeight: "md" }}>
            {pendingRealtimeIds.length === 1
              ? "1 new submission received"
              : `${pendingRealtimeIds.length} new submissions received`}
          </Typography>
          <Button
            size="sm"
            variant="plain"
            color="primary"
            onClick={handleShowNewSubmissions}
          >
            Show
          </Button>
        </Sheet>
      ) : null}

      <Sheet
        ref={tableRegionRef}
        variant="outlined"
        sx={{
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          overflow: "hidden",
        }}
      >
        {error ? (
          <Sheet
            variant="soft"
            color="danger"
            sx={{ mx: { xs: 2, md: 2.5 }, mt: 2, borderRadius: "18px", p: 1.5 }}
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

        {noSubmissionsYet ? (
          <Stack
            spacing={1.5}
            sx={{
              px: 3,
              py: { xs: 5, md: 6 },
              textAlign: "center",
              alignItems: "center",
            }}
          >
            <Typography level="title-lg">No submissions yet</Typography>
            <Typography level="body-sm" color="neutral" sx={{ maxWidth: 460 }}>
              This form has not collected any submissions yet. Publish it to
              start capturing responses, then return here to review and export
              them.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {onOpenPublishTab ? (
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={onOpenPublishTab}
                >
                  Go to Publish tab
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
        ) : noMatchingFilters ? (
          <Stack
            spacing={1.5}
            sx={{
              px: 3,
              py: { xs: 5, md: 6 },
              textAlign: "center",
              alignItems: "center",
            }}
          >
            <Typography level="title-lg">
              No submissions match these filters
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ maxWidth: 460 }}>
              Broaden the current filters or clear them to get back to the full
              queue.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                size="sm"
                variant="solid"
                color="primary"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
        ) : (
          <>
            <JoyTable stickyHeader>
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell sx={{ width: 52 }}>
                    <Checkbox
                      checked={allRowsSelected}
                      indeterminate={someRowsSelected}
                      onChange={(event) =>
                        togglePageSelection(event.target.checked)
                      }
                    />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={
                      sortColumn === "name" ? sortDirection : "none"
                    }
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
                  <JoyTableHeaderCell align="right" sx={{ width: 64 }}>
                    Actions
                  </JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>

              <JoyTableBody>
                {submissions.map((submission) => {
                  const displayName =
                    getSubmissionDisplayName(submission) || "Anonymous";
                  const displayEmail = getSubmissionDisplayEmail(submission);
                  const sourceLabel = getSubmissionDisplaySource(submission);
                  const sourceHref = getSubmissionSourceUrl(submission);
                  const status = resultConfig[submission.result];
                  const customerLink = submission.customer_id
                    ? `/crm/customers/${submission.customer_id}`
                    : null;
                  const isNew = newRowIds.has(submission.id);
                  const isFading = fadingNewRowIds.has(submission.id);

                  return (
                    <JoyTableRow
                      key={submission.id}
                      ref={(node) => setRowRef(submission.id, node)}
                      data-submission-id={submission.id}
                      clickable
                      onClick={() => setSelectedSubmission(submission)}
                      sx={
                        isNew
                          ? {
                              position: "relative",
                              "& > td": {
                                backgroundColor: "primary.softBg",
                              },
                              "&::before": {
                                content: '""',
                                position: "absolute",
                                left: 0,
                                top: 8,
                                bottom: 8,
                                width: 4,
                                borderRadius: 999,
                                backgroundColor: "primary.500",
                                animation: isFading
                                  ? `submissionNewAccentFade ${NEW_ROW_FADE_MS}ms ease forwards`
                                  : undefined,
                              },
                              "@keyframes submissionNewAccentFade": {
                                from: { opacity: 1 },
                                to: { opacity: 0 },
                              },
                            }
                          : undefined
                      }
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
                        <Stack
                          direction="row"
                          spacing={1.25}
                          alignItems="center"
                        >
                          <Avatar
                            size="sm"
                            variant="soft"
                            color={
                              submission.customer_id ? "primary" : "neutral"
                            }
                          >
                            {getAvatarLabel(submission)}
                          </Avatar>
                          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <Typography
                                level="body-sm"
                                sx={{ fontWeight: 700 }}
                              >
                                {displayName}
                              </Typography>
                              {isTestSubmission(submission) ? (
                                <Chip size="sm" variant="soft" color="warning">
                                  Test
                                </Chip>
                              ) : null}
                            </Stack>
                            {customerLink ? (
                              <Link
                                component={RouterLink}
                                to={customerLink}
                                onClick={(event) => event.stopPropagation()}
                                level="body-xs"
                                sx={{ fontWeight: 600 }}
                              >
                                View linked customer
                              </Link>
                            ) : (
                              <Typography level="body-xs" color="neutral">
                                No linked customer yet
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {displayEmail}
                        </Typography>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Chip size="sm" variant="soft" color={status.color}>
                          {status.label}
                        </Chip>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Tooltip title={sourceHref || "No source URL captured"}>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                            sx={{ maxWidth: 220 }}
                          >
                            <Typography level="body-sm" noWrap>
                              {sourceLabel}
                            </Typography>
                            {sourceHref ? (
                              <ExternalLink size={14} strokeWidth={1.8} />
                            ) : null}
                          </Stack>
                        </Tooltip>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Tooltip
                          title={format(
                            new Date(submission.submitted_at),
                            "PPP p",
                          )}
                        >
                          <Stack spacing={0.35}>
                            <Typography
                              level="body-sm"
                              sx={{ fontWeight: 600 }}
                            >
                              {formatDistanceToNow(
                                new Date(submission.submitted_at),
                                {
                                  addSuffix: true,
                                },
                              )}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {format(
                                new Date(submission.submitted_at),
                                "MMM d, yyyy",
                              )}
                            </Typography>
                          </Stack>
                        </Tooltip>
                      </JoyTableCell>

                      <JoyTableCell
                        align="right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Dropdown>
                          <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{
                              root: {
                                variant: "plain",
                                color: "neutral",
                                size: "sm",
                              },
                            }}
                          >
                            <MoreHorizontal size={18} />
                          </MenuButton>
                          <Menu
                            placement="bottom-end"
                            sx={{ bgcolor: "background.surface" }}
                          >
                            <MenuItem
                              onClick={() => setSelectedSubmission(submission)}
                            >
                              Open details
                            </MenuItem>
                            <MenuItem
                              onClick={() =>
                                void handleCopySubmissionId(submission.id)
                              }
                            >
                              Copy submission ID
                            </MenuItem>
                            <MenuItem
                              onClick={() =>
                                openDeleteDialog(
                                  [submission.id],
                                  "Delete this submission?",
                                  "This permanently removes the submission record and refreshes analytics after the delete completes.",
                                )
                              }
                            >
                              Delete
                            </MenuItem>
                          </Menu>
                        </Dropdown>
                      </JoyTableCell>
                    </JoyTableRow>
                  );
                })}
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
          </>
        )}
      </Sheet>

      <JoyDrawer
        open={Boolean(activeSubmission)}
        onClose={() => setSelectedSubmission(null)}
        size="lg"
        title={
          activeSubmission
            ? getSubmissionDisplayName(activeSubmission) ||
              getSubmissionDisplayEmail(activeSubmission)
            : "Submission details"
        }
        description={
          activeSubmission
            ? `Submitted ${formatDistanceToNow(
                new Date(activeSubmission.submitted_at),
                {
                  addSuffix: true,
                },
              )}`
            : undefined
        }
        startDecorator={
          activeSubmission ? (
            <Avatar
              size="md"
              variant="soft"
              color={activeSubmission.customer_id ? "primary" : "neutral"}
            >
              {getAvatarLabel(activeSubmission)}
            </Avatar>
          ) : undefined
        }
      >
        {activeSubmission ? (
          <Stack spacing={2.5}>
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "22px",
                p: 2.25,
                backgroundColor: "background.surface",
              }}
            >
              <Stack spacing={1.75}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Chip
                    size="sm"
                    variant="soft"
                    color={resultConfig[activeSubmission.result].color}
                  >
                    {resultConfig[activeSubmission.result].label}
                  </Chip>
                  {isTestSubmission(activeSubmission) ? (
                    <Chip size="sm" variant="soft" color="warning">
                      Test submission
                    </Chip>
                  ) : null}
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  <MetadataBlock
                    label="Submitted"
                    value={format(
                      new Date(activeSubmission.submitted_at),
                      "PPP p",
                    )}
                  />
                  <MetadataBlock
                    label="Source"
                    value={getSubmissionDisplaySource(activeSubmission)}
                  />
                  <MetadataBlock
                    label="Submission ID"
                    value={
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {activeSubmission.id}
                        </Typography>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="neutral"
                          onClick={() =>
                            void handleCopySubmissionId(activeSubmission.id)
                          }
                        >
                          <Copy size={14} />
                        </IconButton>
                      </Stack>
                    }
                  />
                  <MetadataBlock
                    label="Linked customer"
                    value={
                      customerHref ? (
                        <Link
                          component={RouterLink}
                          to={customerHref}
                          level="body-sm"
                          sx={{ fontWeight: 600 }}
                        >
                          Open CRM customer
                        </Link>
                      ) : (
                        "Not linked"
                      )
                    }
                  />
                  <MetadataBlock
                    label="Source URL"
                    value={
                      sourceUrl ? (
                        <Link
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          level="body-sm"
                          sx={{ fontWeight: 600 }}
                        >
                          {sourceUrl}
                        </Link>
                      ) : undefined
                    }
                  />
                  <MetadataBlock
                    label="IP hash"
                    value={activeSubmission.ip_hash || undefined}
                  />
                </Box>
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "22px",
                p: 2.25,
                backgroundColor: "background.surface",
              }}
            >
              <Stack spacing={1.5}>
                <Typography level="title-md">Captured fields</Typography>
                {visibleEntries.length === 0 ? (
                  <Typography level="body-sm" color="neutral">
                    No visible field values were captured for this submission.
                  </Typography>
                ) : (
                  visibleEntries.map((entry) => {
                    const fileReferences = getFormFileUploadReferences(
                      entry.rawValue,
                    );

                    return (
                      <Sheet
                        key={entry.id}
                        variant="soft"
                        sx={{ borderRadius: "18px", px: 1.5, py: 1.35 }}
                      >
                        <Stack spacing={0.75}>
                          <Typography level="body-xs" color="neutral">
                            {entry.label}
                          </Typography>

                          {entry.kind === "file" &&
                          fileReferences.length > 0 ? (
                            <Stack spacing={0.85}>
                              {fileReferences.map((reference) => {
                                const downloadUrl = getFileDownloadUrl([
                                  reference,
                                ]);

                                return (
                                  <Stack
                                    key={reference.upload_id}
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={0.75}
                                    justifyContent="space-between"
                                    alignItems={{
                                      xs: "flex-start",
                                      sm: "center",
                                    }}
                                  >
                                    <Typography
                                      level="body-sm"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {getFileUploadDisplayValue([reference])}
                                    </Typography>
                                    {downloadUrl ? (
                                      <Link
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        level="body-sm"
                                        sx={{ fontWeight: 600 }}
                                      >
                                        Download
                                      </Link>
                                    ) : null}
                                  </Stack>
                                );
                              })}
                            </Stack>
                          ) : (
                            <Typography
                              level="body-sm"
                              sx={{
                                fontWeight: 600,
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {entry.displayValue}
                            </Typography>
                          )}
                        </Stack>
                      </Sheet>
                    );
                  })
                )}
              </Stack>
            </Sheet>

            {consentRows.length > 0 ? (
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "22px",
                  p: 2.25,
                  backgroundColor: "background.surface",
                }}
              >
                <Stack spacing={1.5}>
                  <Typography level="title-md">Consent details</Typography>
                  {consentRows.map((row) => (
                    <Sheet
                      key={row.id}
                      variant="soft"
                      sx={{ borderRadius: "18px", px: 1.5, py: 1.35 }}
                    >
                      <Stack spacing={0.75}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                            {row.label}
                          </Typography>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={row.granted ? "success" : "neutral"}
                          >
                            {row.granted ? "Granted" : "Not granted"}
                          </Chip>
                          {row.required ? (
                            <Chip size="sm" variant="soft" color="warning">
                              Required
                            </Chip>
                          ) : null}
                        </Stack>
                        {row.capturedAt ? (
                          <Typography level="body-sm" color="neutral">
                            Captured {format(new Date(row.capturedAt), "PPP p")}
                          </Typography>
                        ) : null}
                        {row.text ? (
                          <Typography
                            level="body-sm"
                            sx={{ whiteSpace: "pre-wrap" }}
                          >
                            {row.text}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Sheet>
                  ))}
                </Stack>
              </Sheet>
            ) : null}

            {diagnosticEntries.length > 0 ? (
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "22px",
                  p: 2.25,
                  backgroundColor: "background.surface",
                }}
              >
                <Stack spacing={1.25}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography level="title-md">
                      Hidden and diagnostic fields
                    </Typography>
                    <Button
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => setShowDiagnostics((current) => !current)}
                    >
                      {showDiagnostics
                        ? "Hide"
                        : `Show ${diagnosticEntries.length}`}
                    </Button>
                  </Stack>
                  {showDiagnostics ? (
                    <Stack spacing={0.85}>
                      {diagnosticEntries.map((entry) => (
                        <Sheet
                          key={entry.id}
                          variant="soft"
                          sx={{ borderRadius: "18px", px: 1.5, py: 1.35 }}
                        >
                          <Stack spacing={0.45}>
                            <Typography level="body-xs" color="neutral">
                              {entry.label}
                            </Typography>
                            <Typography
                              level="body-sm"
                              sx={{
                                fontWeight: 600,
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {entry.displayValue}
                            </Typography>
                          </Stack>
                        </Sheet>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Sheet>
            ) : null}

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "22px",
                p: 2.25,
                backgroundColor: "background.surface",
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Typography level="title-md">Raw JSON</Typography>
                  <Button
                    size="sm"
                    variant="plain"
                    color="neutral"
                    startDecorator={<FileJson size={15} />}
                    onClick={() => setShowRawJson((current) => !current)}
                  >
                    {showRawJson ? "Hide raw JSON" : "Show raw JSON"}
                  </Button>
                </Stack>
                {showRawJson ? (
                  <Sheet
                    component="pre"
                    variant="soft"
                    sx={{
                      m: 0,
                      p: 2,
                      borderRadius: "18px",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontFamily: "var(--joy-fontFamily-code)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {JSON.stringify(activeSubmission, null, 2)}
                  </Sheet>
                ) : null}
              </Stack>
            </Sheet>

            <Sheet
              variant="soft"
              color="danger"
              sx={{ borderRadius: "22px", p: 2.25 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Stack spacing={0.4}>
                  <Typography level="title-sm">Delete submission</Typography>
                  <Typography level="body-sm">
                    Remove this record permanently and recalculate the form
                    analytics.
                  </Typography>
                </Stack>
                <Button
                  size="sm"
                  variant="solid"
                  color="danger"
                  startDecorator={<Trash2 size={15} />}
                  onClick={() =>
                    openDeleteDialog(
                      [activeSubmission.id],
                      "Delete this submission?",
                      "This permanently removes the submission record and refreshes analytics after the delete completes.",
                    )
                  }
                  disabled={deleteMutation.isPending}
                >
                  Delete submission
                </Button>
              </Stack>
            </Sheet>
          </Stack>
        ) : null}
      </JoyDrawer>

      <Modal open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <ModalDialog
          sx={{
            bgcolor: "background.surface",
            borderRadius: "var(--joy-radius-lg)",
            p: 2.5,
            minWidth: { xs: "min(100vw - 32px, 320px)", sm: 420 },
            animation: "submissionsDeleteDialogIn 150ms ease-out",
            "@keyframes submissionsDeleteDialogIn": {
              from: { opacity: 0, transform: "scale(0.95)" },
              to: { opacity: 1, transform: "scale(1)" },
            },
          }}
        >
          <Stack spacing={2}>
            <Stack spacing={0.75}>
              <Typography level="title-md">
                {deleteDialog?.title || "Delete submission?"}
              </Typography>
              <Typography level="body-sm" color="neutral">
                {deleteDialog?.description ||
                  "This permanently removes the selected submission records and refreshes analytics after the delete completes."}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setDeleteDialog(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="solid"
                color="danger"
                startDecorator={<DeleteRounded sx={{ fontSize: 16 }} />}
                onClick={() => void handleDelete()}
                loading={deleteMutation.isPending}
              >
                {deleteDialog?.ids.length === 1 ? "Delete" : "Delete all"}
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
