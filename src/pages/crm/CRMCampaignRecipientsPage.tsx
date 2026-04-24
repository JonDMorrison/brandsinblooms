import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  Link as LinkIcon,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  Tag,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyDebouncedInput } from "@/components/joy/JoyDebouncedInput";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
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
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { PageContainer } from "@/components/joy/PageContainer";
import { useDebounce } from "@/hooks/useDebounce";
import { useCampaignEventRealtime } from "@/hooks/useCampaignEventRealtime";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  getTrackingEventTimestamp,
  normalizeTrackingEventType,
  toRecipientKey,
  type EmailTrackingEventRow,
} from "@/lib/crm/emailTrackingRealtime";
import {
  buildAbsoluteLocationPath,
  buildRecipientCsv,
  buildRecipientFilterState,
  buildRecipientSelectionScope,
  downloadTextFile,
  formatDateStamp,
  sanitizeFileNamePart,
  serializeEventQueryValue,
  type CampaignRecipientExportRow,
  type RecipientCompositeFilter,
  type RecipientDeliveryFilter,
  type RecipientEventSelection,
  type RecipientSortColumn,
  type RecipientSortDirection,
  type RecipientTimeRange,
} from "@/lib/crm/campaignRecipientOperations";
import { retryCampaignRecipientMessage } from "@/lib/email/emailRetryService";

type SortColumn = RecipientSortColumn;
type SortDirection = RecipientSortDirection;
type EngagementFilterValue =
  | "all"
  | "opened"
  | "clicked"
  | "no_engagement"
  | "issues";

interface RecipientRow {
  recipient_id: string;
  current_message_id?: string | null;
  retry_message_id?: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  send_status: string;
  latest_event: string;
  latest_event_at: string | null;
  delivery_status: string;
  sent_at: string | null;
  last_attempt_at?: string | null;
  created_at: string;
  attempts?: number;
  resend_id?: string | null;
  error_message?: string | null;
  retry_count?: number;
  retry_status?: string | null;
  can_retry?: boolean;
  has_hard_bounce?: boolean;
  hard_bounce_reason?: string | null;
  engagement_score?: number;
  all_events?: string[];
}

interface CampaignSegment {
  id: string;
  name: string;
}

interface CampaignSummary {
  id: string;
  name: string;
  subject_line: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  metrics: unknown;
  tenant_timezone: string | null;
  segments: CampaignSegment[];
  recipient_count: number;
}

interface CampaignRecipientsResponse {
  campaign: CampaignSummary | null;
  rows: RecipientRow[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
  filters: {
    search: string | null;
    event_filter: RecipientCompositeFilter;
    event_filters?: RecipientEventSelection[];
    time_range?: RecipientTimeRange;
    delivery_filter?: RecipientDeliveryFilter;
    sort_column: SortColumn;
    sort_direction: SortDirection;
  };
  not_found: boolean;
}

interface CRMSegmentOption {
  id: string;
  name: string;
}

interface CRMTagOption {
  id: string;
  name: string;
}

type RowRealtimeOverride = {
  latest_event: string;
  latest_event_at: string | null;
};

type RecipientEventTimestamps = Record<
  string,
  {
    openedAt: string | null;
    clickedAt: string | null;
  }
>;

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_SORT_COLUMN: SortColumn = "event_time";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

function isEventNewer(
  currentTimestamp: string | null,
  nextTimestamp: string | null,
) {
  if (!nextTimestamp) return false;
  if (!currentTimestamp) return true;
  return (
    new Date(nextTimestamp).getTime() >= new Date(currentTimestamp).getTime()
  );
}

function formatCampaignTimestamp(
  timestamp: string | null,
  timezone: string | null,
) {
  if (!timestamp) return "Not sent yet";
  const zone = timezone || "UTC";
  return formatInTimeZone(
    new Date(timestamp),
    zone,
    timezone ? "PPpp zzz" : "PPpp 'UTC'",
  );
}

function formatRelativeTimestamp(timestamp: string | null) {
  if (!timestamp) return "-";
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function getDeliveryLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "failed":
      return "Failed";
    case "pending":
    case "delayed":
      return "Pending";
    default:
      return status || "Unknown";
  }
}

function getDeliveryTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "delivered":
      return "success";
    case "bounced":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function getEngagementFilterValue(
  compositeFilter: RecipientCompositeFilter,
  selectedEvents: RecipientEventSelection[],
): EngagementFilterValue {
  if (compositeFilter === "unengaged") return "no_engagement";
  if (compositeFilter === "issues") return "issues";
  if (selectedEvents.includes("clicked")) return "clicked";
  if (selectedEvents.includes("opened")) return "opened";
  return "all";
}

function getSortValue(sortColumn: SortColumn, sortDirection: SortDirection) {
  if (sortColumn === "customer_name") return "name";
  return sortDirection === "asc" ? "oldest" : "newest";
}

function recipientToExportRow(row: RecipientRow): CampaignRecipientExportRow {
  return {
    recipient_id: row.recipient_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    latest_event: row.latest_event,
    latest_event_at: row.latest_event_at,
    delivery_status: row.delivery_status,
    all_events: row.all_events,
  };
}

function TableSkeleton() {
  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      {Array.from({ length: 10 }).map((_, index) => (
        <Stack
          key={index}
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "neutral.100",
          }}
        >
          <Skeleton variant="circular" width={18} height={18} />
          <Skeleton variant="circular" width={30} height={30} />
          <Skeleton width="24%" />
          <Skeleton width="12%" />
          <Skeleton width="12%" />
          <Skeleton width="12%" />
          <Skeleton
            width={28}
            height={28}
            variant="circular"
            sx={{ ml: "auto" }}
          />
        </Stack>
      ))}
    </Stack>
  );
}

export default function CRMCampaignRecipientsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterState = buildRecipientFilterState(searchParams);
  const [searchInput, setSearchInput] = React.useState(filterState.searchQuery);
  const debouncedSearch = useDebounce(searchInput, 300);
  const [rowOverrides, setRowOverrides] = React.useState<
    Record<string, RowRealtimeOverride>
  >({});
  const [highlightedRecipients, setHighlightedRecipients] = React.useState<
    Record<string, boolean>
  >({});
  const [selectedRecipientIds, setSelectedRecipientIds] = React.useState<
    string[]
  >([]);
  const [allMatchingSelected, setAllMatchingSelected] = React.useState(false);
  const [clearSelectionDialogOpen, setClearSelectionDialogOpen] =
    React.useState(false);
  const [pendingParamUpdates, setPendingParamUpdates] = React.useState<Record<
    string,
    string | null
  > | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState("");
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<
    string | null
  >(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isBulkActing, setIsBulkActing] = React.useState(false);
  const [retryingRecipientId, setRetryingRecipientId] = React.useState<
    string | null
  >(null);
  const [suppressingRecipientId, setSuppressingRecipientId] = React.useState<
    string | null
  >(null);
  const [pendingRealtimeCount, setPendingRealtimeCount] = React.useState(0);
  const highlightTimersRef = React.useRef<Record<string, number>>({});
  const tableBodyRef = React.useRef<HTMLTableSectionElement | null>(null);

  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(
    Number(searchParams.get("pageSize")),
  )
    ? Number(searchParams.get("pageSize"))
    : 25;
  const searchQuery = filterState.searchQuery;
  const compositeFilter = filterState.compositeFilter;
  const selectedEvents = filterState.selectedEvents;
  const timeRange = filterState.timeRange;
  const deliveryFilter = filterState.deliveryFilter;
  const sortColumn =
    (searchParams.get("sort") as SortColumn | null) ?? DEFAULT_SORT_COLUMN;
  const sortDirection =
    (searchParams.get("direction") as SortDirection | null) ??
    DEFAULT_SORT_DIRECTION;
  const selectionScope = buildRecipientSelectionScope(filterState);
  const detailSearch = searchParams.toString();
  const detailSearchSuffix = detailSearch ? `?${detailSearch}` : "";
  const focusStorageKey = campaignId
    ? `crm-campaign-recipient-focus:${campaignId}`
    : null;

  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        if (Object.prototype.hasOwnProperty.call(updates, "q"))
          next.delete("search");
        if (Object.prototype.hasOwnProperty.call(updates, "event"))
          next.delete("filter");
        return next;
      });
    },
    [setSearchParams],
  );

  const clearSelection = React.useCallback(() => {
    setSelectedRecipientIds([]);
    setAllMatchingSelected(false);
  }, []);

  const requestParamUpdate = React.useCallback(
    (updates: Record<string, string | null>) => {
      const hasSelection =
        allMatchingSelected || selectedRecipientIds.length > 0;
      const affectsSelection = [
        "q",
        "event",
        "time",
        "delivery",
        "sort",
        "direction",
      ].some((key) => Object.prototype.hasOwnProperty.call(updates, key));

      if (hasSelection && affectsSelection) {
        setPendingParamUpdates(updates);
        setClearSelectionDialogOpen(true);
        return;
      }

      updateParams(updates);
    },
    [allMatchingSelected, selectedRecipientIds.length, updateParams],
  );

  React.useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    if (debouncedSearch === searchQuery) return;
    requestParamUpdate({ q: debouncedSearch || null, page: "1" });
  }, [debouncedSearch, requestParamUpdate, searchQuery]);

  React.useEffect(() => {
    clearSelection();
  }, [clearSelection, selectionScope]);

  React.useEffect(() => {
    return () => {
      Object.values(highlightTimersRef.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, []);

  const buildRecipientDetailPath = React.useCallback(
    (recipientId: string) =>
      `/dashboard/campaigns/${campaignId}/recipients/${recipientId}${detailSearchSuffix}`,
    [campaignId, detailSearchSuffix],
  );

  const rememberRecipientFocus = React.useCallback(
    (recipientId: string) => {
      if (!focusStorageKey) return;
      window.sessionStorage.setItem(focusStorageKey, recipientId);
    },
    [focusStorageKey],
  );

  const recipientsQuery = useQuery({
    queryKey: [
      "campaign-recipients-page",
      campaignId,
      page,
      pageSize,
      searchQuery,
      compositeFilter,
      selectedEvents,
      timeRange,
      deliveryFilter,
      sortColumn,
      sortDirection,
    ],
    enabled: Boolean(campaignId),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_campaign_recipients_page" as any,
        {
          p_campaign_id: campaignId,
          p_page: page,
          p_page_size: pageSize,
          p_search: searchQuery || null,
          p_event_filter: compositeFilter,
          p_sort_column: sortColumn,
          p_sort_direction: sortDirection,
          p_event_filters: selectedEvents.length ? selectedEvents : null,
          p_time_range: timeRange,
          p_delivery_filter: deliveryFilter,
        } as any,
      );

      if (error) throw error;
      return (data ?? null) as CampaignRecipientsResponse | null;
    },
  });

  const campaign = recipientsQuery.data?.campaign ?? null;
  const rows = recipientsQuery.data?.rows ?? [];
  const pagination = recipientsQuery.data?.pagination ?? {
    page,
    page_size: pageSize,
    total_count: 0,
    total_pages: 0,
  };

  const visibleEmails = React.useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.customer_email).filter(Boolean)),
      ),
    [rows],
  );

  const recipientEventTimestampsQuery = useQuery({
    queryKey: [
      "campaign-recipient-event-timestamps",
      campaignId,
      visibleEmails,
    ],
    enabled: Boolean(campaignId) && visibleEmails.length > 0,
    queryFn: async (): Promise<RecipientEventTimestamps> => {
      const { data, error } = await supabase
        .from("email_tracking_events")
        .select("customer_email, event_type, created_at")
        .eq("campaign_id", campaignId)
        .in("customer_email", visibleEmails)
        .in("event_type", ["open", "opened", "click", "clicked"]);

      if (error) throw error;

      const timestamps: RecipientEventTimestamps = {};
      for (const event of data ?? []) {
        const key = toRecipientKey(event.customer_email);
        if (!key) continue;
        const current = timestamps[key] ?? { openedAt: null, clickedAt: null };
        if (
          ["open", "opened"].includes(event.event_type) &&
          isEventNewer(current.openedAt, event.created_at)
        ) {
          current.openedAt = event.created_at;
        }
        if (
          ["click", "clicked"].includes(event.event_type) &&
          isEventNewer(current.clickedAt, event.created_at)
        ) {
          current.clickedAt = event.created_at;
        }
        timestamps[key] = current;
      }
      return timestamps;
    },
  });

  const rowsWithRealtime = React.useMemo(
    () =>
      rows.map((row) => {
        const override = rowOverrides[toRecipientKey(row.customer_email)];
        if (!override) return row;
        if (!isEventNewer(row.latest_event_at, override.latest_event_at))
          return row;
        return {
          ...row,
          latest_event: override.latest_event,
          latest_event_at: override.latest_event_at,
        };
      }),
    [rowOverrides, rows],
  );

  const selectedRecipientSet = React.useMemo(
    () => new Set(selectedRecipientIds),
    [selectedRecipientIds],
  );
  const visibleRecipientIds = React.useMemo(
    () => rowsWithRealtime.map((row) => row.recipient_id),
    [rowsWithRealtime],
  );
  const allVisibleSelected =
    visibleRecipientIds.length > 0 &&
    (allMatchingSelected ||
      visibleRecipientIds.every((recipientId) =>
        selectedRecipientSet.has(recipientId),
      ));
  const someVisibleSelected =
    !allVisibleSelected &&
    visibleRecipientIds.some((recipientId) =>
      selectedRecipientSet.has(recipientId),
    );
  const selectedCount = allMatchingSelected
    ? pagination.total_count
    : selectedRecipientIds.length;
  const engagementFilterValue = getEngagementFilterValue(
    compositeFilter,
    selectedEvents,
  );
  const sortValue = getSortValue(sortColumn, sortDirection);
  const canShowRecipients = ["sent", "sending", "sent_with_errors"].includes(
    campaign?.status ?? "",
  );

  const segmentsQuery = useQuery({
    queryKey: ["crm-recipient-bulk-segments", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("id, name")
        .eq("tenant_id", tenant?.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CRMSegmentOption[];
    },
  });

  const tagsQuery = useQuery({
    queryKey: ["crm-recipient-bulk-tags", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tags")
        .select("id, name")
        .eq("tenant_id", tenant?.id)
        .order("name", { ascending: true })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as CRMTagOption[];
    },
  });

  React.useEffect(() => {
    if (!focusStorageKey || rowsWithRealtime.length === 0) return;
    const recipientId = window.sessionStorage.getItem(focusStorageKey);
    if (!recipientId) return;
    const rowElement = tableBodyRef.current?.querySelector<HTMLElement>(
      `[data-recipient-id="${recipientId}"]`,
    );
    if (rowElement) {
      rowElement.focus();
      window.sessionStorage.removeItem(focusStorageKey);
    }
  }, [focusStorageKey, rowsWithRealtime]);

  const handleRealtimeEvent = React.useCallback(
    (event: EmailTrackingEventRow, options: { animate: boolean }) => {
      const recipientKey = toRecipientKey(event.customer_email);
      const latestEvent = normalizeTrackingEventType(event.event_type);
      const latestEventAt = getTrackingEventTimestamp(event);
      if (!recipientKey || latestEvent === "unknown") return;

      setRowOverrides((current) => {
        const existing = current[recipientKey];
        if (existing && !isEventNewer(existing.latest_event_at, latestEventAt))
          return current;
        return {
          ...current,
          [recipientKey]: {
            latest_event: latestEvent,
            latest_event_at: latestEventAt,
          },
        };
      });

      if (options.animate) {
        setPendingRealtimeCount((current) => current + 1);
        window.clearTimeout(highlightTimersRef.current[recipientKey]);
        setHighlightedRecipients((current) => ({
          ...current,
          [recipientKey]: true,
        }));
        highlightTimersRef.current[recipientKey] = window.setTimeout(() => {
          setHighlightedRecipients((current) => {
            const next = { ...current };
            delete next[recipientKey];
            return next;
          });
          delete highlightTimersRef.current[recipientKey];
        }, 900);
      }
    },
    [],
  );

  const realtime = useCampaignEventRealtime({
    campaignId,
    tenantId: tenant?.id,
    enabled: Boolean(campaignId && tenant?.id),
    channelName: `campaign-recipient-events-${campaignId}`,
    onEvent: handleRealtimeEvent,
  });

  const resolveRecipientRows = React.useCallback(
    async (recipientIds?: string[] | null) => {
      const { data, error } = await supabase.rpc(
        "get_campaign_recipient_matches" as any,
        {
          p_campaign_id: campaignId,
          p_search: searchQuery || null,
          p_event_filters: selectedEvents.length ? selectedEvents : null,
          p_event_filter: compositeFilter,
          p_time_range: timeRange,
          p_delivery_filter: deliveryFilter,
          p_recipient_ids: recipientIds?.length ? recipientIds : null,
        } as any,
      );
      if (error) throw error;
      return (data ?? []) as RecipientRow[];
    },
    [
      campaignId,
      compositeFilter,
      deliveryFilter,
      searchQuery,
      selectedEvents,
      timeRange,
    ],
  );

  const handleRefresh = React.useCallback(async () => {
    setPendingRealtimeCount(0);
    await recipientsQuery.refetch();
    await recipientEventTimestampsQuery.refetch();
  }, [recipientEventTimestampsQuery, recipientsQuery]);

  const toggleVisibleSelection = React.useCallback(
    (checked: boolean) => {
      if (!checked) {
        clearSelection();
        return;
      }
      setAllMatchingSelected(false);
      setSelectedRecipientIds((current) => {
        const next = new Set(current);
        visibleRecipientIds.forEach((recipientId) => next.add(recipientId));
        return Array.from(next);
      });
    },
    [clearSelection, visibleRecipientIds],
  );

  const toggleRowSelection = React.useCallback(
    (recipientId: string, checked: boolean) => {
      if (allMatchingSelected && !checked) {
        setAllMatchingSelected(false);
        setSelectedRecipientIds(
          visibleRecipientIds.filter((candidate) => candidate !== recipientId),
        );
        return;
      }
      setSelectedRecipientIds((current) => {
        const next = new Set(current);
        if (checked) next.add(recipientId);
        else next.delete(recipientId);
        return Array.from(next);
      });
    },
    [allMatchingSelected, visibleRecipientIds],
  );

  const handleCopyViewLink = React.useCallback(async () => {
    await navigator.clipboard.writeText(
      buildAbsoluteLocationPath(
        `${window.location.pathname}${window.location.search}`,
      ),
    );
    toast.success("Filtered recipients link copied");
  }, []);

  const handleCopyEmail = React.useCallback(async (email: string) => {
    await navigator.clipboard.writeText(email);
    toast.success("Email address copied");
  }, []);

  const handleCopySelection = React.useCallback(async () => {
    try {
      const rowsToCopy = allMatchingSelected
        ? await resolveRecipientRows(null)
        : await resolveRecipientRows(selectedRecipientIds);
      const emails = Array.from(
        new Set(rowsToCopy.map((row) => row.customer_email).filter(Boolean)),
      );
      if (emails.length === 0) {
        toast.error("No email addresses found for this selection");
        return;
      }
      await navigator.clipboard.writeText(emails.join(", "));
      toast.success(`${emails.length.toLocaleString()} emails copied`);
    } catch (error) {
      console.error("Failed to copy selected emails", error);
      toast.error("Unable to copy selected email addresses");
    }
  }, [allMatchingSelected, resolveRecipientRows, selectedRecipientIds]);

  const handleExportSelected = React.useCallback(async () => {
    if (!campaignId) return;
    try {
      setIsExporting(true);
      if (allMatchingSelected) {
        const { data, error } = await supabase.functions.invoke(
          "campaign-recipient-export",
          {
            body: {
              campaignId,
              search: searchQuery || null,
              eventFilter: compositeFilter,
              eventFilters: selectedEvents.length ? selectedEvents : null,
              timeRange,
              deliveryFilter,
            },
          },
        );
        if (error) throw error;
        downloadTextFile(
          data.csvContent,
          data.fileName,
          "text/csv;charset=utf-8",
        );
      } else {
        const resolvedRows = await resolveRecipientRows(selectedRecipientIds);
        const csv = buildRecipientCsv(
          resolvedRows.map((row) => recipientToExportRow(row)),
          campaign?.tenant_timezone,
        );
        const fileName = `${sanitizeFileNamePart(campaign?.name || "campaign")}-recipients-selected-${formatDateStamp()}.csv`;
        downloadTextFile(csv, fileName, "text/csv;charset=utf-8");
      }
      toast.success("Recipient export ready");
    } catch (error) {
      console.error("Failed to export recipients", error);
      toast.error("Unable to export selected recipients");
    } finally {
      setIsExporting(false);
    }
  }, [
    allMatchingSelected,
    campaign?.name,
    campaign?.tenant_timezone,
    campaignId,
    compositeFilter,
    deliveryFilter,
    resolveRecipientRows,
    searchQuery,
    selectedEvents,
    selectedRecipientIds,
    timeRange,
  ]);

  const handleExportAll = React.useCallback(async () => {
    if (!campaignId) return;
    try {
      setIsExporting(true);
      const { data, error } = await supabase.functions.invoke(
        "campaign-recipient-export",
        {
          body: {
            campaignId,
            search: searchQuery || null,
            eventFilter: compositeFilter,
            eventFilters: selectedEvents.length ? selectedEvents : null,
            timeRange,
            deliveryFilter,
          },
        },
      );
      if (error) throw error;
      downloadTextFile(
        data.csvContent,
        data.fileName,
        "text/csv;charset=utf-8",
      );
      toast.success("Recipients exported");
    } catch (error) {
      console.error("Failed to export recipients", error);
      toast.error("Unable to export recipients");
    } finally {
      setIsExporting(false);
    }
  }, [
    campaignId,
    compositeFilter,
    deliveryFilter,
    searchQuery,
    selectedEvents,
    timeRange,
  ]);

  const runBulkAction = React.useCallback(
    async (
      action: "add-tag" | "add-to-segment",
      payload: Record<string, unknown>,
    ) => {
      if (!campaignId) return;
      try {
        setIsBulkActing(true);
        const { data, error } = await supabase.functions.invoke(
          "campaign-recipient-bulk-actions",
          {
            body: {
              action,
              campaignId,
              recipientIds: allMatchingSelected ? null : selectedRecipientIds,
              search: searchQuery || null,
              eventFilter: compositeFilter,
              eventFilters: selectedEvents.length ? selectedEvents : null,
              timeRange,
              deliveryFilter,
              ...payload,
            },
          },
        );
        if (error) throw error;
        const processed = Number(data?.processedCount ?? 0);
        const skipped = Number(data?.skippedCount ?? 0);
        const suffix =
          skipped > 0
            ? ` ${skipped} skipped because they have no linked customer record.`
            : "";
        if (action === "add-tag") {
          toast.success(
            `Added tag to ${processed.toLocaleString()} customers.${suffix}`,
          );
          setTagDialogOpen(false);
          setTagName("");
        } else {
          toast.success(
            `Added ${processed.toLocaleString()} customers to the segment.${suffix}`,
          );
          setSegmentDialogOpen(false);
          setSelectedSegmentId(null);
        }
      } catch (error) {
        console.error("Failed to run bulk recipient action", error);
        toast.error("Unable to complete the bulk action");
      } finally {
        setIsBulkActing(false);
      }
    },
    [
      allMatchingSelected,
      campaignId,
      compositeFilter,
      deliveryFilter,
      searchQuery,
      selectedEvents,
      selectedRecipientIds,
      timeRange,
    ],
  );

  const handleRetryRecipient = React.useCallback(
    async (row: RecipientRow) => {
      if (!campaignId) return;
      try {
        setRetryingRecipientId(row.recipient_id);
        const result = await retryCampaignRecipientMessage(
          campaignId,
          row.recipient_id,
        );
        if (result.blockedReason) {
          toast.error(result.blockedReason);
          return;
        }
        toast.success(
          result.jobsCreated > 0 ? "Retry queued" : "Recipient retry updated",
        );
        await handleRefresh();
      } catch (error) {
        console.error("Failed to retry recipient", error);
        toast.error(
          error instanceof Error ? error.message : "Unable to retry recipient",
        );
      } finally {
        setRetryingRecipientId(null);
      }
    },
    [campaignId, handleRefresh],
  );

  const handleSuppressEmail = React.useCallback(
    async (row: RecipientRow) => {
      if (!tenant?.id) return;
      try {
        setSuppressingRecipientId(row.recipient_id);
        const { data: existing, error: existingError } = await supabase
          .from("suppression_list")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("email", row.customer_email)
          .eq("channel", "email")
          .is("lifted_at", null)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existing) {
          const { error } = await supabase.from("suppression_list").insert({
            tenant_id: tenant.id,
            email: row.customer_email,
            suppression_type: "manual",
            channel: "email",
            reason: `Manual suppression from campaign recipients page (${campaign?.name || "campaign"})`,
            auto_suppressed: false,
            suppressed_at: new Date().toISOString(),
          });
          if (error) throw error;
        }
        toast.success(`${row.customer_email} suppressed`);
      } catch (error) {
        console.error("Failed to suppress email", error);
        toast.error("Unable to suppress recipient email");
      } finally {
        setSuppressingRecipientId(null);
      }
    },
    [campaign?.name, tenant?.id],
  );

  const handleEngagementChange = React.useCallback(
    (value: string) => {
      switch (value as EngagementFilterValue) {
        case "opened":
          requestParamUpdate({
            event: serializeEventQueryValue("all", ["opened"]),
            page: "1",
          });
          return;
        case "clicked":
          requestParamUpdate({
            event: serializeEventQueryValue("all", ["clicked"]),
            page: "1",
          });
          return;
        case "no_engagement":
          requestParamUpdate({ event: "unengaged", page: "1" });
          return;
        case "issues":
          requestParamUpdate({ event: "issues", page: "1" });
          return;
        default:
          requestParamUpdate({ event: null, page: "1" });
      }
    },
    [requestParamUpdate],
  );

  const handleSortChange = React.useCallback(
    (value: string) => {
      switch (value) {
        case "name":
          requestParamUpdate({
            sort: "customer_name",
            direction: "asc",
            page: "1",
          });
          return;
        case "oldest":
          requestParamUpdate({
            sort: "event_time",
            direction: "asc",
            page: "1",
          });
          return;
        default:
          requestParamUpdate({
            sort: "event_time",
            direction: "desc",
            page: "1",
          });
      }
    },
    [requestParamUpdate],
  );

  if (!campaignId) return null;

  if (
    !recipientsQuery.isLoading &&
    (!recipientsQuery.data || recipientsQuery.data.not_found || !campaign)
  ) {
    return (
      <PageContainer fullWidth>
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 6 }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar variant="soft" color="neutral">
              <Mail size={18} />
            </Avatar>
            <Typography level="title-lg">Campaign not found</Typography>
            <Typography level="body-sm" color="neutral">
              This campaign does not exist or you do not have access to its
              recipients.
            </Typography>
            <JoyButton component={Link} to="/crm/campaigns">
              Back to Campaigns
            </JoyButton>
          </Stack>
        </Sheet>
      </PageContainer>
    );
  }

  return (
    <PageContainer fullWidth>
      <Stack spacing={2.5} sx={{ pb: 6 }}>
        {recipientsQuery.isFetching || isExporting || isBulkActing ? (
          <LinearProgress thickness={3} />
        ) : null}

        <Stack
          direction={{ xs: "column", xl: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={1.25}>
            <JoyButton
              component={Link}
              to={`/crm/campaigns/${campaignId}/report`}
              bloomVariant="link"
              color="neutral"
            >
              <ChevronLeft size={16} />
              Back to report
            </JoyButton>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography level="title-lg">
                {campaign?.name || <Skeleton width={220} />}
              </Typography>
              {campaign ? (
                <JoyChip variant="soft" color="neutral">
                  {pagination.total_count.toLocaleString()} recipients
                </JoyChip>
              ) : null}
              <JoyChip
                variant="soft"
                color={realtime.isLive ? "success" : "neutral"}
                size="sm"
                sx={
                  realtime.isLive
                    ? {
                        "@keyframes recipientLivePulse": {
                          "0%": { opacity: 0.72 },
                          "50%": { opacity: 1 },
                          "100%": { opacity: 0.72 },
                        },
                        animation:
                          "recipientLivePulse 1.8s ease-in-out infinite",
                      }
                    : undefined
                }
              >
                {realtime.isLive ? "Live" : "Realtime paused"}
              </JoyChip>
            </Stack>
            {campaign ? (
              <Typography level="body-sm" color="neutral">
                Sent{" "}
                {formatCampaignTimestamp(
                  campaign.sent_at ?? campaign.scheduled_at,
                  campaign.tenant_timezone,
                )}
              </Typography>
            ) : null}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <JoyButton
              onClick={() => void handleExportAll()}
              disabled={isExporting}
            >
              <Download size={16} />
              Export CSV
            </JoyButton>
            <JoyDropdownMenu>
              <JoyDropdownMenuTrigger variant="plain" color="neutral">
                <MoreHorizontal size={18} />
              </JoyDropdownMenuTrigger>
              <JoyDropdownMenuContent>
                <JoyDropdownMenuItem
                  startDecorator={<RefreshCw size={16} />}
                  onClick={() => void handleRefresh()}
                >
                  Refresh data
                </JoyDropdownMenuItem>
                <JoyDropdownMenuItem
                  startDecorator={<LinkIcon size={16} />}
                  onClick={() => void handleCopyViewLink()}
                >
                  Copy filtered view link
                </JoyDropdownMenuItem>
              </JoyDropdownMenuContent>
            </JoyDropdownMenu>
          </Stack>
        </Stack>

        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2 }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.25}
            useFlexGap
          >
            <JoyDebouncedInput
              value={searchInput}
              onValueChange={setSearchInput}
              onDebouncedChange={(value) =>
                requestParamUpdate({ q: value || null, page: "1" })
              }
              placeholder="Search name or email"
              startDecorator={<Search size={16} />}
              sx={{ minWidth: { xs: "100%", lg: 280 }, flex: 1 }}
            />
            <JoySelect
              value={deliveryFilter}
              onValueChange={(value) =>
                requestParamUpdate({
                  delivery: value === "all" ? null : value,
                  page: "1",
                })
              }
              options={[
                { value: "all", label: "All statuses" },
                { value: "delivered", label: "Delivered" },
                { value: "bounced", label: "Bounced" },
                { value: "failed", label: "Failed" },
                { value: "pending", label: "Pending" },
              ]}
              sx={{ minWidth: 160 }}
            />
            <JoySelect
              value={engagementFilterValue}
              onValueChange={handleEngagementChange}
              options={[
                { value: "all", label: "All engagement" },
                { value: "opened", label: "Opened" },
                { value: "clicked", label: "Clicked" },
                { value: "no_engagement", label: "No engagement" },
                { value: "issues", label: "Issues" },
              ]}
              sx={{ minWidth: 170 }}
            />
            <JoySelect
              value={timeRange}
              onValueChange={(value) =>
                requestParamUpdate({
                  time: value === "all" ? null : value,
                  page: "1",
                })
              }
              options={[
                { value: "all", label: "All time" },
                { value: "1h", label: "Last hour" },
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
              ]}
              sx={{ minWidth: 150 }}
            />
            <JoySelect
              value={sortValue}
              onValueChange={handleSortChange}
              options={[
                { value: "newest", label: "Newest" },
                { value: "oldest", label: "Oldest" },
                { value: "name", label: "Name" },
              ]}
              sx={{ minWidth: 130 }}
            />
          </Stack>
        </Sheet>

        {pendingRealtimeCount > 0 ? (
          <Sheet
            variant="soft"
            color="info"
            onClick={() => void handleRefresh()}
            sx={{
              borderRadius: "md",
              px: 1.5,
              py: 1,
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            <Typography level="body-sm" fontWeight="md">
              {pendingRealtimeCount.toLocaleString()} new event
              {pendingRealtimeCount === 1 ? "" : "s"} - refresh view
            </Typography>
          </Sheet>
        ) : null}

        <Sheet
          variant="outlined"
          sx={{ borderRadius: "lg", overflow: "hidden" }}
        >
          {recipientsQuery.isLoading ? (
            <TableSkeleton />
          ) : !canShowRecipients || rowsWithRealtime.length === 0 ? (
            <Stack spacing={1.5} alignItems="center" sx={{ px: 4, py: 8 }}>
              <Avatar variant="soft" color="neutral">
                <Mail size={18} />
              </Avatar>
              <Typography level="title-md">No recipients yet</Typography>
              <Typography level="body-sm" color="neutral" textAlign="center">
                {campaign?.status === "draft" ||
                campaign?.status === "scheduled"
                  ? "Recipients will appear here after the campaign is sent."
                  : "No recipients matched the current filters."}
              </Typography>
            </Stack>
          ) : (
            <>
              <JoyTable variant="plain" borderAxis="none" stickyHeader>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell sx={{ width: 44 }}>
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                              ? "indeterminate"
                              : false
                        }
                        onChange={(event) =>
                          toggleVisibleSelection(event.target.checked)
                        }
                      />
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={
                        sortColumn === "customer_name"
                          ? sortDirection === "asc"
                            ? "asc"
                            : "desc"
                          : "none"
                      }
                      onSort={() =>
                        requestParamUpdate({
                          sort: "customer_name",
                          direction:
                            sortColumn === "customer_name" &&
                            sortDirection === "asc"
                              ? "desc"
                              : "asc",
                          page: "1",
                        })
                      }
                    >
                      Customer
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell>Delivery Status</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Opened</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Clicked</JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={
                        sortColumn === "event_time"
                          ? sortDirection === "asc"
                            ? "asc"
                            : "desc"
                          : "none"
                      }
                      onSort={() =>
                        requestParamUpdate({
                          sort: "event_time",
                          direction:
                            sortColumn === "event_time" &&
                            sortDirection === "desc"
                              ? "asc"
                              : "desc",
                          page: "1",
                        })
                      }
                    >
                      Latest Event
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="right">
                      Actions
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody ref={tableBodyRef}>
                  {rowsWithRealtime.map((row) => {
                    const recipientKey = toRecipientKey(row.customer_email);
                    const eventTimestamps = recipientEventTimestampsQuery
                      .data?.[recipientKey] ?? {
                      openedAt: null,
                      clickedAt: null,
                    };
                    const isSelected =
                      allMatchingSelected ||
                      selectedRecipientSet.has(row.recipient_id);
                    const isHighlighted = Boolean(
                      highlightedRecipients[recipientKey],
                    );
                    const isWorking =
                      retryingRecipientId === row.recipient_id ||
                      suppressingRecipientId === row.recipient_id;

                    return (
                      <JoyTableRow
                        key={row.recipient_id}
                        data-recipient-id={row.recipient_id}
                        clickable
                        sx={{
                          ...(isSelected
                            ? {
                                "& > td": {
                                  backgroundColor:
                                    "rgba(var(--joy-palette-primary-mainChannel) / 0.05)",
                                },
                              }
                            : undefined),
                          ...(isHighlighted
                            ? {
                                "& > td": {
                                  backgroundColor:
                                    "rgba(var(--joy-palette-success-mainChannel) / 0.08)",
                                },
                              }
                            : undefined),
                        }}
                      >
                        <JoyTableCell>
                          <Checkbox
                            checked={isSelected}
                            onChange={(event) =>
                              toggleRowSelection(
                                row.recipient_id,
                                event.target.checked,
                              )
                            }
                          />
                        </JoyTableCell>
                        <JoyTableCell>
                          <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                          >
                            <Avatar size="sm" variant="soft" color="neutral">
                              <UserRound size={16} />
                            </Avatar>
                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                              <Typography
                                component={Link}
                                to={buildRecipientDetailPath(row.recipient_id)}
                                onClick={() =>
                                  rememberRecipientFocus(row.recipient_id)
                                }
                                level="body-sm"
                                fontWeight="md"
                                sx={{
                                  textDecoration: "none",
                                  color: "neutral.800",
                                }}
                              >
                                {row.customer_name || row.customer_email}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {row.customer_email}
                              </Typography>
                            </Stack>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell>
                          {row.delivery_status === "bounced" &&
                          row.hard_bounce_reason ? (
                            <JoyTooltip title={row.hard_bounce_reason}>
                              <span>
                                <JoyStatusChip
                                  status={getDeliveryLabel(row.delivery_status)}
                                  tone={getDeliveryTone(row.delivery_status)}
                                />
                              </span>
                            </JoyTooltip>
                          ) : (
                            <JoyStatusChip
                              status={getDeliveryLabel(row.delivery_status)}
                              tone={getDeliveryTone(row.delivery_status)}
                            />
                          )}
                        </JoyTableCell>
                        <JoyTableCell>
                          <Typography level="body-sm">
                            {formatRelativeTimestamp(eventTimestamps.openedAt)}
                          </Typography>
                        </JoyTableCell>
                        <JoyTableCell>
                          <Typography level="body-sm">
                            {formatRelativeTimestamp(eventTimestamps.clickedAt)}
                          </Typography>
                        </JoyTableCell>
                        <JoyTableCell>
                          <Stack spacing={0.25}>
                            <Typography level="body-sm">
                              {row.latest_event
                                ? row.latest_event.replace(/[_-]+/g, " ")
                                : "-"}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {formatRelativeTimestamp(row.latest_event_at)}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell align="right">
                          <JoyDropdownMenu>
                            <JoyDropdownMenuTrigger
                              variant="plain"
                              color="neutral"
                            >
                              {isWorking ? (
                                <CircularProgress size="sm" />
                              ) : (
                                <MoreHorizontal size={16} />
                              )}
                            </JoyDropdownMenuTrigger>
                            <JoyDropdownMenuContent>
                              <JoyDropdownMenuItem
                                startDecorator={<Eye size={16} />}
                                onClick={() => {
                                  rememberRecipientFocus(row.recipient_id);
                                  navigate(
                                    buildRecipientDetailPath(row.recipient_id),
                                  );
                                }}
                              >
                                View Detail
                              </JoyDropdownMenuItem>
                              {row.customer_id ? (
                                <JoyDropdownMenuItem
                                  startDecorator={<Users size={16} />}
                                  onClick={() =>
                                    navigate(
                                      `/crm/customers/${row.customer_id}`,
                                    )
                                  }
                                >
                                  View Customer
                                </JoyDropdownMenuItem>
                              ) : null}
                              {row.delivery_status === "failed" &&
                              row.can_retry ? (
                                <JoyDropdownMenuItem
                                  startDecorator={<RefreshCw size={16} />}
                                  onClick={() => void handleRetryRecipient(row)}
                                >
                                  Retry Send
                                </JoyDropdownMenuItem>
                              ) : null}
                              <JoyDropdownMenuItem
                                startDecorator={<AlertTriangle size={16} />}
                                onClick={() => void handleSuppressEmail(row)}
                              >
                                Suppress Email
                              </JoyDropdownMenuItem>
                              <JoyDropdownMenuItem
                                startDecorator={<Copy size={16} />}
                                onClick={() =>
                                  void handleCopyEmail(row.customer_email)
                                }
                              >
                                Copy Email
                              </JoyDropdownMenuItem>
                            </JoyDropdownMenuContent>
                          </JoyDropdownMenu>
                        </JoyTableCell>
                      </JoyTableRow>
                    );
                  })}
                </JoyTableBody>
              </JoyTable>

              <JoyTablePagination
                page={page}
                pageSize={pageSize}
                totalCount={pagination.total_count}
                onPageChange={(nextPage) =>
                  updateParams({ page: String(nextPage) })
                }
                onPageSizeChange={(nextPageSize) =>
                  updateParams({ pageSize: String(nextPageSize), page: "1" })
                }
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </Sheet>

        {selectedCount > 0 ? (
          <Sheet
            variant="soft"
            color="primary"
            sx={{
              position: "fixed",
              left: 24,
              right: 24,
              bottom: 24,
              zIndex: (theme) => theme.vars.zIndex.modal - 1,
              borderRadius: "md",
              px: 2,
              py: 1.5,
              boxShadow: "var(--joy-shadow-lg)",
            }}
          >
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", lg: "center" }}
            >
              <Stack spacing={0.5}>
                <Typography level="body-sm" fontWeight="lg">
                  {allMatchingSelected
                    ? `${pagination.total_count.toLocaleString()} selected across all matches`
                    : `${selectedCount.toLocaleString()} selected on this page`}
                </Typography>
                {!allMatchingSelected &&
                selectedCount < pagination.total_count ? (
                  <JoyButton
                    bloomVariant="link"
                    color="primary"
                    onClick={() => setAllMatchingSelected(true)}
                  >
                    Select all {pagination.total_count.toLocaleString()}{" "}
                    matching recipients
                  </JoyButton>
                ) : null}
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                useFlexGap
              >
                <JoyButton
                  bloomVariant="secondary"
                  onClick={() => setTagDialogOpen(true)}
                  disabled={isBulkActing}
                >
                  <Tag size={16} />
                  Add Tag
                </JoyButton>
                <JoyButton
                  bloomVariant="secondary"
                  onClick={() => setSegmentDialogOpen(true)}
                  disabled={isBulkActing}
                >
                  <Users size={16} />
                  Add to Segment
                </JoyButton>
                <JoyButton
                  bloomVariant="secondary"
                  onClick={() => void handleExportSelected()}
                  disabled={isExporting}
                >
                  <Download size={16} />
                  Export Selected
                </JoyButton>
                <JoyButton
                  bloomVariant="ghost"
                  color="neutral"
                  onClick={() => void handleCopySelection()}
                >
                  <Copy size={16} />
                  Copy Emails
                </JoyButton>
                <JoyButton
                  bloomVariant="ghost"
                  color="neutral"
                  onClick={clearSelection}
                >
                  <X size={16} />
                  Clear
                </JoyButton>
              </Stack>
            </Stack>
          </Sheet>
        ) : null}

        <JoyAlertDialog
          open={clearSelectionDialogOpen}
          onClose={() => {
            setClearSelectionDialogOpen(false);
            setPendingParamUpdates(null);
          }}
          onConfirm={() => {
            clearSelection();
            setClearSelectionDialogOpen(false);
            if (pendingParamUpdates) updateParams(pendingParamUpdates);
            setPendingParamUpdates(null);
          }}
          title="Clear current selection?"
          description="Changing filters or sort order will clear the current selection scope."
          confirmLabel="Clear selection"
          cancelLabel="Keep selection"
          variant="warning"
        />

        <JoyDialog
          open={tagDialogOpen}
          onClose={() => setTagDialogOpen(false)}
          title="Add Tag"
          description="Assign a CRM tag to the selected recipients."
          size="sm"
        >
          <JoyDialogContent>
            <JoyAutocomplete
              freeSolo
              options={tagsQuery.data?.map((tag) => tag.name) ?? []}
              value={tagName}
              onInputChange={(_event, value) => setTagName(value)}
              onChange={(_event, value) =>
                setTagName(typeof value === "string" ? value : (value ?? ""))
              }
              placeholder="Choose or create a tag"
            />
          </JoyDialogContent>
          <JoyDialogActions>
            <JoyButton
              bloomVariant="ghost"
              color="neutral"
              onClick={() => setTagDialogOpen(false)}
            >
              Cancel
            </JoyButton>
            <JoyButton
              disabled={!tagName.trim() || isBulkActing}
              onClick={() =>
                void runBulkAction("add-tag", { tagName: tagName.trim() })
              }
            >
              Add Tag
            </JoyButton>
          </JoyDialogActions>
        </JoyDialog>

        <JoyDialog
          open={segmentDialogOpen}
          onClose={() => setSegmentDialogOpen(false)}
          title="Add to Segment"
          description="Add the selected recipients to an existing segment."
          size="sm"
        >
          <JoyDialogContent>
            <JoyAutocomplete
              options={segmentsQuery.data ?? []}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option.name
              }
              value={
                (segmentsQuery.data ?? []).find(
                  (segment) => segment.id === selectedSegmentId,
                ) ?? null
              }
              onChange={(_event, value) =>
                setSelectedSegmentId(value?.id ?? null)
              }
              placeholder="Choose a segment"
            />
          </JoyDialogContent>
          <JoyDialogActions>
            <JoyButton
              bloomVariant="ghost"
              color="neutral"
              onClick={() => setSegmentDialogOpen(false)}
            >
              Cancel
            </JoyButton>
            <JoyButton
              disabled={!selectedSegmentId || isBulkActing}
              onClick={() =>
                void runBulkAction("add-to-segment", {
                  segmentId: selectedSegmentId,
                })
              }
            >
              Add to Segment
            </JoyButton>
          </JoyDialogActions>
        </JoyDialog>
      </Stack>
    </PageContainer>
  );
}
