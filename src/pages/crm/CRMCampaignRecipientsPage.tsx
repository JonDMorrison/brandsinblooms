import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  FileDown,
  Filter,
  Link as LinkIcon,
  Mail,
  MoreHorizontal,
  MousePointer,
  RefreshCw,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  normalizeDerivedMetrics,
  type DerivedMetrics,
} from "@/hooks/analytics/useCampaignDerivedMetrics";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignEventRealtime } from "@/hooks/useCampaignEventRealtime";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CRMMetricCard } from "@/components/crm/CRMMetricCard";
import {
  ActionDropdown,
  FilterDropdown,
} from "@/components/ui/action-dropdown";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  applyRealtimeMetricsDelta,
  createKnownRecipientEventSets,
  getTrackingEventTimestamp,
  normalizeTrackingEventType,
  toRecipientKey,
  type EmailTrackingEventRow,
} from "@/lib/crm/emailTrackingRealtime";
import {
  buildRecipientCsv,
  buildAbsoluteLocationPath,
  buildRecipientFilterChips,
  buildRecipientFilterState,
  buildRecipientSelectionScope,
  downloadTextFile,
  formatDateStamp,
  formatCampaignHealthSummary,
  hasActiveRecipientFilters,
  sanitizeFileNamePart,
  serializeEventQueryValue,
  type RecipientCompositeFilter,
  type RecipientDeliveryFilter,
  type RecipientEventSelection,
  type RecipientSortColumn,
  type RecipientSortDirection,
  type RecipientTimeRange,
} from "@/lib/crm/campaignRecipientOperations";

type SortColumn = RecipientSortColumn;
type SortDirection = RecipientSortDirection;

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

const ZERO_METRICS: DerivedMetrics = {
  totals: {
    sent: 0,
    sent_events: 0,
    observed_recipients: 0,
    delivered: 0,
    successful_reach: 0,
    opens: 0,
    clicks: 0,
    bounces: 0,
    hard_bounces: 0,
    complaints: 0,
    unsubscribes: 0,
    opens_non_mpp: 0,
    unique_engaged: 0,
    skipped: 0,
  },
  scores: {
    reach: 0,
    interaction: 0,
  },
  rates: {
    delivery: 0,
    open_reported: 0,
    open_adjusted: 0,
    click: 0,
    bounce: 0,
    complaint: 0,
    click_to_open: 0,
  },
  diagnostics: {
    opens_without_delivery: 0,
    clicks_without_delivery: 0,
    missing_send_ledger: false,
  },
  reconciliation: {
    backfill_applied: false,
    backfilled_events: 0,
    last_backfilled_at: null,
  },
  links: [],
  computed_at: new Date(0).toISOString(),
};

type RowRealtimeOverride = {
  latest_event: string;
  latest_event_at: string | null;
};

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

const EVENT_FILTER_OPTIONS: Array<{
  value: RecipientEventSelection;
  label: string;
}> = [
  { value: "delivered", label: "Delivered" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
];

const COMPOSITE_FILTER_OPTIONS: Array<{
  value: Exclude<RecipientCompositeFilter, "all">;
  label: string;
}> = [
  { value: "engaged", label: "Engaged" },
  { value: "unengaged", label: "Unengaged" },
  { value: "issues", label: "Issues" },
];

const TIME_FILTER_OPTIONS: Array<{
  value: RecipientTimeRange;
  label: string;
}> = [
  { value: "all", label: "All time" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
];

const DELIVERY_FILTER_OPTIONS: Array<{
  value: RecipientDeliveryFilter;
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "bounced", label: "Bounced" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const DEFAULT_SORT_COLUMN: SortColumn = "event_time";
const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

const FILTER_SORT_OPTIONS: Array<{
  id: string;
  label: string;
  column: SortColumn;
  direction: SortDirection;
}> = [
  {
    id: "event_time_desc",
    label: "Event Time (newest first)",
    column: "event_time",
    direction: "desc",
  },
  {
    id: "event_time_asc",
    label: "Event Time (oldest first)",
    column: "event_time",
    direction: "asc",
  },
  {
    id: "customer_name_asc",
    label: "Customer Name (A-Z)",
    column: "customer_name",
    direction: "asc",
  },
  {
    id: "customer_name_desc",
    label: "Customer Name (Z-A)",
    column: "customer_name",
    direction: "desc",
  },
  {
    id: "email_asc",
    label: "Email (A-Z)",
    column: "email",
    direction: "asc",
  },
];

interface FilterPanelDraftState {
  compositeFilter: RecipientCompositeFilter;
  selectedEvents: RecipientEventSelection[];
  timeRange: RecipientTimeRange;
  deliveryFilter: RecipientDeliveryFilter;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}

function getCampaignStatusVariant(status: string) {
  switch (status) {
    case "sent":
    case "sent_with_errors":
      return "secondary" as const;
    case "sending":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

function getEventBadgeClass(event: string) {
  switch (event) {
    case "delivered":
      return "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-transparent";
    case "opened":
      return "bg-sky-100 text-sky-900 hover:bg-sky-100 border-transparent";
    case "clicked":
      return "bg-indigo-100 text-indigo-900 hover:bg-indigo-100 border-transparent";
    case "bounced":
      return "bg-red-100 text-red-900 hover:bg-red-100 border-transparent";
    case "complained":
      return "bg-orange-100 text-orange-900 hover:bg-orange-100 border-transparent";
    case "failed":
      return "border-red-300 text-red-900";
    case "unsubscribed":
      return "bg-stone-200 text-stone-900 hover:bg-stone-200 border-transparent";
    case "sending":
      return "bg-amber-100 text-amber-900 hover:bg-amber-100 border-transparent";
    default:
      return "bg-muted text-muted-foreground hover:bg-muted border-transparent";
  }
}

function getEventLabel(event: string) {
  switch (event) {
    case "clicked":
      return "Clicked";
    case "opened":
      return "Opened";
    case "delivered":
      return "Delivered";
    case "sent":
      return "Sent";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Complained";
    case "failed":
      return "Failed";
    case "unsubscribed":
      return "Unsubscribed";
    case "sending":
      return "Sending";
    case "queued":
      return "Queued";
    case "skipped":
      return "Skipped";
    default:
      return event;
  }
}

function getDeliveryDotClass(status: string) {
  switch (status) {
    case "delivered":
      return "bg-emerald-500";
    case "bounced":
    case "failed":
      return "bg-red-500";
    case "complained":
      return "bg-orange-500";
    case "delayed":
      return "bg-amber-500";
    case "sent":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

function getDeliveryLabel(status: string) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Complained";
    case "failed":
      return "Failed";
    case "delayed":
      return "Delayed";
    case "sent":
      return "Sent";
    case "queued":
      return "Queued";
    default:
      return "Unknown";
  }
}

function getEngagementBadgeClass(score: number) {
  if (score >= 90) {
    return "bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-transparent";
  }
  if (score >= 60) {
    return "bg-sky-100 text-sky-900 hover:bg-sky-100 border-transparent";
  }
  if (score >= 25) {
    return "bg-amber-100 text-amber-900 hover:bg-amber-100 border-transparent";
  }
  return "bg-muted text-muted-foreground hover:bg-muted border-transparent";
}

function getEngagementLabel(score: number) {
  if (score >= 90) return "Highly engaged";
  if (score >= 60) return "Engaged";
  if (score >= 25) return "Reached";
  return "Cold";
}

function formatRecipientTimestamp(timestamp: string | null) {
  if (!timestamp) return "No event yet";
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function formatExactUtcTimestamp(timestamp: string | null) {
  if (!timestamp) return "No timestamp";
  return formatInTimeZone(new Date(timestamp), "UTC", "PPpp 'UTC'");
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

export default function CRMCampaignRecipientsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterState = buildRecipientFilterState(searchParams);
  const [searchInput, setSearchInput] = useState(filterState.searchQuery);
  const [rowOverrides, setRowOverrides] = useState<
    Record<string, RowRealtimeOverride>
  >({});
  const [highlightedRecipients, setHighlightedRecipients] = useState<
    Record<string, boolean>
  >({});
  const [optimisticMetrics, setOptimisticMetrics] =
    useState<DerivedMetrics>(ZERO_METRICS);
  const debouncedSearch = useDebounce(searchInput, 300);
  const visibleRecipientKeysRef = useRef<Set<string>>(new Set());
  const highlightTimersRef = useRef<Record<string, number>>({});
  const knownEventRecipientsRef = useRef(createKnownRecipientEventSets());
  const pendingMetricEventsRef = useRef<EmailTrackingEventRow[]>([]);
  const tableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const [knownEventBaselineReady, setKnownEventBaselineReady] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    [],
  );
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [clearSelectionDialogOpen, setClearSelectionDialogOpen] =
    useState(false);
  const [pendingParamUpdates, setPendingParamUpdates] = useState<Record<
    string,
    string | null
  > | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [pendingCopyValue, setPendingCopyValue] = useState<string | null>(null);
  const [pendingCopyCount, setPendingCopyCount] = useState(0);
  const [tagName, setTagName] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const pageSize = [25, 50, 100].includes(Number(searchParams.get("pageSize")))
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
  const [filterDraft, setFilterDraft] = useState<FilterPanelDraftState>({
    compositeFilter: compositeFilter,
    selectedEvents: selectedEvents,
    timeRange: timeRange,
    deliveryFilter: deliveryFilter,
    sortColumn,
    sortDirection,
  });
  const selectionScope = buildRecipientSelectionScope(filterState);
  const detailSearch = searchParams.toString();
  const detailSearchSuffix = detailSearch ? `?${detailSearch}` : "";
  const focusStorageKey = campaignId
    ? `crm-campaign-recipient-focus:${campaignId}`
    : null;

  const buildRecipientDetailPath = (recipientId: string) =>
    `/dashboard/campaigns/${campaignId}/recipients/${recipientId}${detailSearchSuffix}`;

  const rememberRecipientFocus = useCallback(
    (recipientId: string) => {
      if (!focusStorageKey) return;
      window.sessionStorage.setItem(focusStorageKey, recipientId);
    },
    [focusStorageKey],
  );

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });

      if (Object.prototype.hasOwnProperty.call(updates, "q")) {
        next.delete("search");
      }
      if (Object.prototype.hasOwnProperty.call(updates, "event")) {
        next.delete("filter");
      }

      return next;
    });
  };

  const clearSelection = useCallback(() => {
    setSelectedRecipientIds([]);
    setAllMatchingSelected(false);
  }, []);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const requestParamUpdate = useCallback(
    (updates: Record<string, string | null>) => {
      const hasSelection =
        allMatchingSelected || selectedRecipientIds.length > 0;
      const affectsSelection = ["q", "event", "time", "delivery"].some((key) =>
        Object.prototype.hasOwnProperty.call(updates, key),
      );

      if (hasSelection && affectsSelection) {
        setPendingParamUpdates(updates);
        setClearSelectionDialogOpen(true);
        return;
      }

      updateParams(updates);
    },
    [allMatchingSelected, selectedRecipientIds.length],
  );

  useEffect(() => {
    if (debouncedSearch === searchQuery) return;

    requestParamUpdate({
      q: debouncedSearch || null,
      page: "1",
    });
  }, [debouncedSearch, requestParamUpdate, searchQuery]);

  useEffect(() => {
    clearSelection();
  }, [selectionScope, clearSelection]);

  const { data, isLoading, isFetching, refetch } = useQuery({
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
    queryFn: async () => {
      const { data: response, error } = await supabase.rpc(
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
      return (response ?? null) as CampaignRecipientsResponse | null;
    },
    enabled: Boolean(campaignId),
    placeholderData: (previousData) => previousData,
  });

  const campaign = data?.campaign ?? null;
  const rows = data?.rows ?? [];
  const pagination = data?.pagination ?? {
    page,
    page_size: pageSize,
    total_count: 0,
    total_pages: 0,
  };
  const baseMetrics = useMemo(
    () => normalizeDerivedMetrics(campaign?.metrics) ?? ZERO_METRICS,
    [campaign?.metrics],
  );
  const rowsWithRealtime = useMemo(
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
  const metrics = optimisticMetrics;
  const activeFilters = buildRecipientFilterChips(filterState);
  const hasActiveFilters = hasActiveRecipientFilters(filterState);
  const canShowRecipients = ["sent", "sending", "sent_with_errors"].includes(
    campaign?.status ?? "",
  );
  const campaignDate = campaign?.sent_at ?? campaign?.scheduled_at ?? null;
  const selectedRecipientSet = useMemo(
    () => new Set(selectedRecipientIds),
    [selectedRecipientIds],
  );
  const visibleRecipientIds = useMemo(
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
  const selectionCountLabel = `${selectedCount.toLocaleString()} recipient${selectedCount === 1 ? "" : "s"} selected`;
  const healthSummary = formatCampaignHealthSummary(
    metrics,
    campaign?.recipient_count ?? 0,
  );
  const isDefaultSort =
    sortColumn === DEFAULT_SORT_COLUMN &&
    sortDirection === DEFAULT_SORT_DIRECTION;
  const appliedFilterCount =
    (compositeFilter !== "all" || selectedEvents.length > 0 ? 1 : 0) +
    (timeRange !== "all" ? 1 : 0) +
    (deliveryFilter !== "all" ? 1 : 0) +
    (isDefaultSort ? 0 : 1);
  const activeSortLabel =
    FILTER_SORT_OPTIONS.find(
      (option) =>
        option.column === sortColumn && option.direction === sortDirection,
    )?.label ??
    (sortColumn === "latest_event"
      ? `Latest Event (${sortDirection === "asc" ? "A-Z" : "Z-A"})`
      : "Custom sort");

  const syncFilterDraftFromApplied = useCallback(() => {
    setFilterDraft({
      compositeFilter,
      selectedEvents,
      timeRange,
      deliveryFilter,
      sortColumn,
      sortDirection,
    });
  }, [
    compositeFilter,
    deliveryFilter,
    selectedEvents,
    sortColumn,
    sortDirection,
    timeRange,
  ]);

  const { data: segments = [] } = useQuery({
    queryKey: ["crm-recipient-bulk-segments", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const { data: result, error } = await supabase
        .from("crm_segments")
        .select("id, name")
        .eq("tenant_id", tenant?.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return (result ?? []) as CRMSegmentOption[];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["crm-recipient-bulk-tags", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const { data: result, error } = await supabase
        .from("crm_tags")
        .select("id, name")
        .eq("tenant_id", tenant?.id)
        .order("name", { ascending: true })
        .limit(30);

      if (error) throw error;
      return (result ?? []) as CRMTagOption[];
    },
  });

  useEffect(() => {
    setOptimisticMetrics(baseMetrics);
  }, [baseMetrics]);

  useEffect(() => {
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

  useEffect(() => {
    visibleRecipientKeysRef.current = new Set(
      rows.map((row) => toRecipientKey(row.customer_email)).filter(Boolean),
    );
  }, [rows]);

  const loadKnownEventBaseline = useCallback(async () => {
    if (!campaignId || !tenant?.id) return;

    const nextKnownRecipients = createKnownRecipientEventSets();
    const { data: existingEvents, error } = await supabase
      .from("email_tracking_events")
      .select("customer_email, event_type")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenant.id)
      .in("event_type", [
        "open",
        "opened",
        "click",
        "clicked",
        "bounce",
        "bounced",
      ]);

    if (error) {
      console.error("Failed to load realtime campaign baseline", error);
      return;
    }

    for (const event of existingEvents ?? []) {
      const recipientKey = toRecipientKey(event.customer_email);
      const normalizedType = normalizeTrackingEventType(event.event_type);
      if (!recipientKey) continue;
      if (normalizedType === "opened") {
        nextKnownRecipients.opened.add(recipientKey);
      } else if (normalizedType === "clicked") {
        nextKnownRecipients.clicked.add(recipientKey);
      } else if (normalizedType === "bounced") {
        nextKnownRecipients.bounced.add(recipientKey);
      }
    }

    knownEventRecipientsRef.current = nextKnownRecipients;
    setKnownEventBaselineReady(true);
    if (pendingMetricEventsRef.current.length > 0) {
      setOptimisticMetrics((current) => {
        let nextMetrics = current;
        for (const event of pendingMetricEventsRef.current) {
          nextMetrics = applyRealtimeMetricsDelta(
            nextMetrics,
            event,
            knownEventRecipientsRef.current,
          );
        }
        pendingMetricEventsRef.current = [];
        return nextMetrics;
      });
    }
  }, [campaignId, tenant?.id]);

  useEffect(() => {
    setKnownEventBaselineReady(false);
    pendingMetricEventsRef.current = [];
    void loadKnownEventBaseline();
  }, [loadKnownEventBaseline]);

  const handleRealtimeEvent = useCallback(
    (event: EmailTrackingEventRow, options: { animate: boolean }) => {
      const recipientKey = toRecipientKey(event.customer_email);
      const latestEvent = normalizeTrackingEventType(event.event_type);
      const latestEventAt = getTrackingEventTimestamp(event);
      if (!recipientKey) return;

      setRowOverrides((current) => {
        const existingOverride = current[recipientKey];
        if (
          existingOverride &&
          !isEventNewer(existingOverride.latest_event_at, latestEventAt)
        ) {
          return current;
        }

        return {
          ...current,
          [recipientKey]: {
            latest_event: latestEvent,
            latest_event_at: latestEventAt,
          },
        };
      });

      const isVisibleRecipient =
        visibleRecipientKeysRef.current.has(recipientKey);
      if (options.animate && isVisibleRecipient) {
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
        }, 650);
      }

      if (!knownEventBaselineReady) {
        pendingMetricEventsRef.current.push(event);
        return;
      }

      setOptimisticMetrics((current) =>
        applyRealtimeMetricsDelta(
          current,
          event,
          knownEventRecipientsRef.current,
        ),
      );
    },
    [knownEventBaselineReady],
  );

  useCampaignEventRealtime({
    campaignId,
    tenantId: tenant?.id,
    enabled: Boolean(campaignId && tenant?.id),
    channelName: `campaign-recipient-events-${campaignId}`,
    onEvent: handleRealtimeEvent,
  });

  const resolveRecipientRows = useCallback(
    async (recipientIds?: string[] | null) => {
      const { data: result, error } = await supabase.rpc(
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
      return (result ?? []) as RecipientRow[];
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

  const executeCopy = useCallback(async (emails: string[]) => {
    const value = emails.join(", ");
    await navigator.clipboard.writeText(value);
    toast.success(
      `${emails.length.toLocaleString()} emails copied to clipboard.`,
    );
  }, []);

  const handleCopyViewLink = useCallback(async () => {
    await navigator.clipboard.writeText(
      buildAbsoluteLocationPath(
        `${window.location.pathname}${window.location.search}`,
      ),
    );
    toast.success("Filtered recipients link copied");
  }, []);

  const handleCopyRecipientLink = useCallback(
    async (recipientId: string) => {
      await navigator.clipboard.writeText(
        buildAbsoluteLocationPath(buildRecipientDetailPath(recipientId)),
      );
      toast.success("Recipient link copied");
    },
    [buildRecipientDetailPath],
  );

  const focusRelativeRow = useCallback(
    (recipientId: string, direction: 1 | -1) => {
      const index = rowsWithRealtime.findIndex(
        (row) => row.recipient_id === recipientId,
      );
      if (index === -1) return;
      const target = rowsWithRealtime[index + direction];
      if (!target) return;
      const rowElement = tableBodyRef.current?.querySelector<HTMLElement>(
        `[data-recipient-id="${target.recipient_id}"]`,
      );
      rowElement?.focus();
    },
    [rowsWithRealtime],
  );

  const handleCopySelection = useCallback(async () => {
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

      if (emails.length > 500) {
        setPendingCopyValue(emails.join(", "));
        setPendingCopyCount(emails.length);
        setCopyConfirmOpen(true);
        return;
      }

      await executeCopy(emails);
    } catch (error) {
      console.error("Failed to copy selected emails", error);
      toast.error("Unable to copy selected email addresses");
    }
  }, [
    allMatchingSelected,
    executeCopy,
    resolveRecipientRows,
    selectedRecipientIds,
  ]);

  const handleExportSelected = useCallback(async () => {
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
        const rowsToExport = await resolveRecipientRows(selectedRecipientIds);
        const csv = buildRecipientCsv(rowsToExport, campaign?.tenant_timezone);
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

  const handleExportAllRecipients = useCallback(async () => {
    if (!campaignId) return;

    try {
      setIsExporting(true);
      const { data, error } = await supabase.functions.invoke(
        "campaign-recipient-export",
        {
          body: {
            campaignId,
            eventFilter: "all",
            eventFilters: null,
            timeRange: "all",
            deliveryFilter: "all",
            search: null,
          },
        },
      );

      if (error) throw error;
      downloadTextFile(
        data.csvContent,
        data.fileName,
        "text/csv;charset=utf-8",
      );
      toast.success("All recipients exported");
    } catch (error) {
      console.error("Failed to export all recipients", error);
      toast.error("Unable to export all recipients");
    } finally {
      setIsExporting(false);
    }
  }, [campaignId]);

  const handleExportFiltered = useCallback(async () => {
    if (!campaignId || !hasActiveFilters) return;

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
      toast.success("Filtered recipients exported");
    } catch (error) {
      console.error("Failed to export filtered recipients", error);
      toast.error("Unable to export filtered recipients");
    } finally {
      setIsExporting(false);
    }
  }, [
    campaignId,
    compositeFilter,
    deliveryFilter,
    hasActiveFilters,
    searchQuery,
    selectedEvents,
    timeRange,
  ]);

  const runBulkAction = useCallback(
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
          setSelectedSegmentId("");
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

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email address copied");
    } catch (error) {
      console.error("Failed to copy email", error);
      toast.error("Unable to copy email address");
    }
  };

  const handleRefresh = async () => {
    setRowOverrides({});
    setHighlightedRecipients({});
    await Promise.all([refetch(), loadKnownEventBaseline()]);
  };

  const toggleVisibleSelection = (checked: boolean) => {
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
  };

  const toggleRowSelection = (recipientId: string, checked: boolean) => {
    if (allMatchingSelected && !checked) {
      setAllMatchingSelected(false);
      setSelectedRecipientIds(
        visibleRecipientIds.filter((candidate) => candidate !== recipientId),
      );
      return;
    }

    setSelectedRecipientIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(recipientId);
      } else {
        next.delete(recipientId);
      }
      return Array.from(next);
    });
  };

  const headerActionSections = useMemo(
    () => [
      {
        label: "Data",
        items: [
          {
            label: "Refresh Data",
            description: isFetching
              ? "Reloading the current recipients view."
              : "Reload the latest recipients and realtime metrics.",
            icon: RefreshCw,
            disabled: isFetching,
            onSelect: () => {
              void handleRefresh();
            },
          },
          {
            label: "Copy View Link",
            description: "Copy the current filtered recipients URL.",
            icon: LinkIcon,
            onSelect: () => {
              void handleCopyViewLink();
            },
          },
        ],
      },
      {
        label: "Export",
        items: [
          {
            label: "Export All Recipients",
            description: "Download a CSV of the full campaign audience.",
            icon: Download,
            disabled: isExporting,
            onSelect: () => {
              void handleExportAllRecipients();
            },
          },
          {
            label: "Export Filtered",
            description: hasActiveFilters
              ? "Download only the recipients in the current filtered view."
              : "Apply a filter first.",
            icon: FileDown,
            disabled: isExporting || !hasActiveFilters,
            onSelect: () => {
              void handleExportFiltered();
            },
          },
        ],
      },
    ],
    [
      handleCopyViewLink,
      handleExportAllRecipients,
      handleExportFiltered,
      hasActiveFilters,
      isExporting,
      isFetching,
    ],
  );

  const selectionActionSections = useMemo(
    () => [
      {
        label: "Clipboard",
        items: [
          {
            label: "Copy Emails",
            description: "Copy the selected recipient email addresses.",
            icon: Copy,
            onSelect: () => {
              void handleCopySelection();
            },
          },
        ],
      },
      {
        label: "Export",
        items: [
          {
            label: "Export Selected",
            description: "Download the current selected recipients as CSV.",
            icon: Download,
            disabled: isExporting,
            onSelect: () => {
              void handleExportSelected();
            },
          },
        ],
      },
      {
        label: "Organize",
        items: [
          {
            label: "Add Tag",
            description: "Assign a CRM tag to the selected recipients.",
            icon: Tag,
            disabled: isBulkActing,
            onSelect: () => {
              setTagDialogOpen(true);
            },
          },
          {
            label: "Add to Segment",
            description: "Add the selected recipients to an existing segment.",
            icon: Users,
            disabled: isBulkActing,
            onSelect: () => {
              setSegmentDialogOpen(true);
            },
          },
        ],
      },
    ],
    [handleCopySelection, handleExportSelected, isBulkActing, isExporting],
  );

  const handleFilterPanelOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        syncFilterDraftFromApplied();
      }
      setIsFilterPanelOpen(open);
    },
    [syncFilterDraftFromApplied],
  );

  const handleDraftEventToggle = useCallback(
    (eventValue: RecipientEventSelection, nextSelected: boolean) => {
      setFilterDraft((current) => {
        const nextEvents = nextSelected
          ? Array.from(new Set([...current.selectedEvents, eventValue]))
          : current.selectedEvents.filter(
              (currentValue) => currentValue !== eventValue,
            );

        return {
          ...current,
          compositeFilter: "all",
          selectedEvents: EVENT_FILTER_OPTIONS.map(
            (option) => option.value,
          ).filter((optionValue) => nextEvents.includes(optionValue)),
        };
      });
    },
    [],
  );

  const handleApplyFilters = useCallback(() => {
    const nextEventValue =
      serializeEventQueryValue(
        filterDraft.compositeFilter,
        filterDraft.selectedEvents,
      ) || null;
    const currentEventValue =
      serializeEventQueryValue(compositeFilter, selectedEvents) || null;
    const nextTimeValue =
      filterDraft.timeRange === "all" ? null : filterDraft.timeRange;
    const currentTimeValue = timeRange === "all" ? null : timeRange;
    const nextDeliveryValue =
      filterDraft.deliveryFilter === "all" ? null : filterDraft.deliveryFilter;
    const currentDeliveryValue =
      deliveryFilter === "all" ? null : deliveryFilter;
    const nextSortValue =
      filterDraft.sortColumn === DEFAULT_SORT_COLUMN &&
      filterDraft.sortDirection === DEFAULT_SORT_DIRECTION
        ? null
        : filterDraft.sortColumn;
    const currentSortValue =
      sortColumn === DEFAULT_SORT_COLUMN &&
      sortDirection === DEFAULT_SORT_DIRECTION
        ? null
        : sortColumn;
    const nextDirectionValue =
      filterDraft.sortColumn === DEFAULT_SORT_COLUMN &&
      filterDraft.sortDirection === DEFAULT_SORT_DIRECTION
        ? null
        : filterDraft.sortDirection;
    const currentDirectionValue =
      sortColumn === DEFAULT_SORT_COLUMN &&
      sortDirection === DEFAULT_SORT_DIRECTION
        ? null
        : sortDirection;

    const updates: Record<string, string | null> = {};

    if (nextEventValue !== currentEventValue) {
      updates.event = nextEventValue;
    }

    if (nextTimeValue !== currentTimeValue) {
      updates.time = nextTimeValue;
    }

    if (nextDeliveryValue !== currentDeliveryValue) {
      updates.delivery = nextDeliveryValue;
    }

    if (nextSortValue !== currentSortValue) {
      updates.sort = nextSortValue;
    }

    if (nextDirectionValue !== currentDirectionValue) {
      updates.direction = nextDirectionValue;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    requestParamUpdate({
      ...updates,
      page: "1",
    });
  }, [
    compositeFilter,
    deliveryFilter,
    filterDraft,
    requestParamUpdate,
    selectedEvents,
    sortColumn,
    sortDirection,
    timeRange,
  ]);

  const handleClearFilterDraft = useCallback(() => {
    setFilterDraft({
      compositeFilter: "all",
      selectedEvents: [],
      timeRange: "all",
      deliveryFilter: "all",
      sortColumn: DEFAULT_SORT_COLUMN,
      sortDirection: DEFAULT_SORT_DIRECTION,
    });
  }, []);

  const filterSections = useMemo(
    () => [
      {
        id: "event-type",
        title: "Event Type",
        description:
          filterDraft.compositeFilter !== "all"
            ? "Quick groups preserve the previous engaged, unengaged, and issues filters."
            : "Select one or more event types. Sent is not available in the current recipients query.",
        options: [
          {
            id: "event-all",
            label: "All",
            selected:
              filterDraft.compositeFilter === "all" &&
              filterDraft.selectedEvents.length === 0,
            onToggle: () => {
              setFilterDraft((current) => ({
                ...current,
                compositeFilter: "all",
                selectedEvents: [],
              }));
            },
          },
          {
            id: "event-sent",
            label: "Sent",
            selected: false,
            disabled: true,
            onToggle: () => undefined,
          },
          ...EVENT_FILTER_OPTIONS.map((option) => ({
            id: `event-${option.value}`,
            label: option.label,
            selected:
              filterDraft.compositeFilter === "all" &&
              filterDraft.selectedEvents.includes(option.value),
            onToggle: (nextSelected: boolean) => {
              handleDraftEventToggle(option.value, nextSelected);
            },
          })),
        ],
        content: (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Quick Groups
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPOSITE_FILTER_OPTIONS.map((option) => {
                const isSelected = filterDraft.compositeFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setFilterDraft((current) => ({
                        ...current,
                        compositeFilter: isSelected ? "all" : option.value,
                        selectedEvents: [],
                      }));
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${
                      isSelected
                        ? "border-brand-teal bg-brand-teal text-white shadow-sm"
                        : "border-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-teal/5"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        id: "date-range",
        title: "Date Range",
        description:
          "Recipients currently support preset time windows only. Custom dates and 30-day range are not available in the active query.",
        options: [
          ...TIME_FILTER_OPTIONS.map((option) => ({
            id: `time-${option.value}`,
            label: option.label,
            selected: filterDraft.timeRange === option.value,
            onToggle: () => {
              setFilterDraft((current) => ({
                ...current,
                timeRange: option.value,
              }));
            },
          })),
          {
            id: "time-30d",
            label: "Last 30 days",
            selected: false,
            disabled: true,
            onToggle: () => undefined,
          },
        ],
      },
      {
        id: "delivery-status",
        title: "Delivery Status",
        description: "Choose one delivery status at a time for recipients.",
        options: DELIVERY_FILTER_OPTIONS.map((option) => ({
          id: `delivery-${option.value}`,
          label: option.label,
          selected: filterDraft.deliveryFilter === option.value,
          onToggle: () => {
            setFilterDraft((current) => ({
              ...current,
              deliveryFilter: option.value,
            }));
          },
        })),
      },
      {
        id: "sort-by",
        title: "Sort By",
        description: "Sorting now lives here instead of the table headers.",
        content: (
          <div className="space-y-2">
            {FILTER_SORT_OPTIONS.map((option) => {
              const isSelected =
                filterDraft.sortColumn === option.column &&
                filterDraft.sortDirection === option.direction;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setFilterDraft((current) => ({
                      ...current,
                      sortColumn: option.column,
                      sortDirection: option.direction,
                    }));
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-brand-teal bg-brand-teal/10 text-brand-navy"
                      : "border-border bg-white text-brand-navy hover:border-brand-teal/30 hover:bg-brand-teal/5"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-teal" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ),
      },
    ],
    [filterDraft, handleDraftEventToggle],
  );

  useEffect(() => {
    return () => {
      Object.values(highlightTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  if (!campaignId) {
    return null;
  }

  if (!isLoading && (!data || data.not_found || !campaign)) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Mail className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Campaign not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This campaign does not exist or you do not have access to its
            recipients.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/crm/campaigns">Back to Campaigns</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-7 p-6">
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
              <Link to="/crm/campaigns">Campaigns</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground/50" />
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="font-medium text-muted-foreground transition-colors hover:text-brand-navy"
            >
              <Link to={`/crm/campaigns/${campaignId}/analytics`}>
                {campaign?.name ?? "Campaign"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground/50" />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-brand-navy">
              Recipients
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-5 rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-white via-white to-brand-teal/5 p-5 shadow-sm shadow-brand-navy/5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-brand-navy sm:text-[2.15rem]">
                {campaign?.name ?? "Campaign Recipients"}
              </h1>
              {campaign ? (
                <Badge
                  variant={getCampaignStatusVariant(campaign.status)}
                  className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm"
                >
                  {campaign.status}
                </Badge>
              ) : null}
            </div>
          </div>

          <ActionDropdown
            label="Actions"
            variant="outline"
            align="end"
            triggerClassName="self-start border-border/80 bg-white/95 shadow-sm"
            sections={headerActionSections}
          />
        </div>

        <div className="flex flex-wrap items-stretch gap-3 text-sm text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="max-w-[22rem] truncate rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-navy/5">
                  <span className="font-medium text-foreground">Subject:</span>{" "}
                  {campaign?.subject_line || "No subject line"}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                {campaign?.subject_line || "No subject line"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-navy/5">
            <span className="font-medium text-foreground">Send Time:</span>{" "}
            {formatCampaignTimestamp(
              campaignDate,
              campaign?.tenant_timezone ?? null,
            )}
          </div>

          <div className="rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-navy/5">
            <span className="font-medium text-foreground">Recipients:</span>{" "}
            {campaign?.recipient_count ?? 0}
          </div>

          <div className="rounded-2xl border border-border/70 bg-white/90 px-4 py-3 shadow-sm shadow-brand-navy/5">
            <span className="font-medium text-foreground">Segments:</span>{" "}
            {campaign?.segments?.length ? (
              campaign.segments.map((segment, index) => (
                <React.Fragment key={segment.id}>
                  {index > 0 ? ", " : ""}
                  <Link
                    className="underline-offset-4 hover:underline"
                    to={`/crm/segments`}
                  >
                    {segment.name}
                  </Link>
                </React.Fragment>
              ))
            ) : (
              <span>No linked segments</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CRMMetricCard
          label="Sent"
          value={String(metrics.totals.sent)}
          icon={Mail}
          iconClassName="text-brand-navy"
          iconWrapClassName="border-brand-navy/10 bg-brand-navy/5"
        />
        <CRMMetricCard
          label="Delivered"
          value={String(metrics.totals.delivered)}
          subtitle={`${metrics.rates.delivery.toFixed(1)}% rate`}
          icon={CheckCircle2}
          iconClassName="text-emerald-700"
          iconWrapClassName="border-emerald-200 bg-emerald-50"
        />
        <CRMMetricCard
          label="Opened"
          value={String(metrics.totals.opens)}
          subtitle={`${metrics.rates.open_reported.toFixed(1)}% rate`}
          icon={Eye}
          iconClassName="text-sky-700"
          iconWrapClassName="border-sky-200 bg-sky-50"
        />
        <CRMMetricCard
          label="Clicked"
          value={String(metrics.totals.clicks)}
          subtitle={`${metrics.rates.click.toFixed(1)}% rate`}
          icon={MousePointer}
          iconClassName="text-indigo-700"
          iconWrapClassName="border-indigo-200 bg-indigo-50"
        />
        <CRMMetricCard
          label="Bounced"
          value={String(metrics.totals.hard_bounces)}
          subtitle={`${metrics.rates.bounce.toFixed(1)}% rate`}
          icon={AlertTriangle}
          iconClassName="text-red-700"
          iconWrapClassName="border-red-200 bg-red-50"
        />
        <CRMMetricCard
          label="Complained"
          value={String(metrics.totals.complaints)}
          subtitle={
            metrics.totals.complaints > 0
              ? `${metrics.rates.complaint.toFixed(1)}% rate`
              : "No complaints"
          }
          icon={AlertTriangle}
          iconClassName="text-orange-700"
          iconWrapClassName="border-orange-200 bg-orange-50"
        />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-teal/15 bg-gradient-to-r from-brand-teal/10 via-white to-mint/40 px-5 py-4 text-sm text-muted-foreground shadow-sm shadow-brand-navy/5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-teal/15 bg-white/90 text-brand-teal shadow-sm">
          <CheckCircle2 className="h-4.5 w-4.5" />
        </span>
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy/75">
            Campaign Health
          </div>
          <div>{healthSummary}</div>
        </div>
      </div>

      <Card className="overflow-visible rounded-[1.75rem] border border-border/70 shadow-sm shadow-brand-navy/5">
        <CardHeader className="relative z-[60] space-y-4 border-b border-border/60 bg-gradient-to-b from-slate-50/80 to-white pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Recipients
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-white/90 px-3 py-1.5 shadow-sm">
                Showing {pagination.total_count.toLocaleString()} filtered of{" "}
                {(campaign?.recipient_count ?? 0).toLocaleString()} recipients
              </span>
            </div>
          </div>

          <div className="relative min-h-[5.75rem] overflow-visible lg:min-h-[4.5rem]">
            <div
              className={`absolute inset-0 z-[70] transition-all duration-300 ease-out ${
                selectedCount > 0
                  ? "pointer-events-none translate-y-2 scale-[0.98] opacity-0"
                  : "pointer-events-auto translate-y-0 scale-100 opacity-100"
              }`}
              aria-hidden={selectedCount > 0}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-10 rounded-xl border-border bg-white pl-10 pr-10 shadow-sm focus-visible:ring-brand-teal"
                    placeholder="Search recipients by name or email..."
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                  {searchInput ? (
                    <button
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchInput("")}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3 sm:flex-row sm:items-center">
                  <FilterDropdown
                    label="Filter"
                    triggerIcon={Filter}
                    variant="outline"
                    align="end"
                    open={isFilterPanelOpen}
                    onOpenChange={handleFilterPanelOpenChange}
                    badge={
                      appliedFilterCount > 0 ? appliedFilterCount : undefined
                    }
                    sections={filterSections}
                    clearLabel="Clear All"
                    onClear={handleClearFilterDraft}
                    onApply={handleApplyFilters}
                    triggerClassName={`min-w-[118px] justify-between border-border/80 bg-white shadow-sm ${
                      isFilterPanelOpen
                        ? "border-brand-teal bg-brand-teal/5 text-brand-navy ring-2 ring-brand-teal/15"
                        : ""
                    }`}
                  />

                  <NativeSelect
                    aria-label="Rows per page"
                    className="w-full sm:w-[120px]"
                    onChange={(event) =>
                      updateParams({ pageSize: event.target.value, page: "1" })
                    }
                    options={PAGE_SIZE_OPTIONS.map((option) => ({
                      value: String(option),
                      label: `${option} rows`,
                    }))}
                    value={String(pageSize)}
                  />
                </div>
              </div>
            </div>

            <div
              className={`absolute inset-0 z-[65] transition-all duration-300 ease-out ${
                selectedCount > 0
                  ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                  : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
              }`}
              aria-hidden={selectedCount === 0}
            >
              <div className="flex h-full flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 shadow-sm shadow-emerald-100/60 ring-1 ring-emerald-100/80 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:border-l-4 lg:border-l-brand-teal">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-emerald-950">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-teal" />
                    <span className="font-semibold">{selectionCountLabel}</span>
                  </div>
                  {!allMatchingSelected &&
                  selectedCount < pagination.total_count ? (
                    <button
                      className="text-sm font-medium text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                      onClick={() => setAllMatchingSelected(true)}
                      type="button"
                    >
                      Select all {pagination.total_count.toLocaleString()}{" "}
                      matching recipients
                    </button>
                  ) : allMatchingSelected ? (
                    <div className="text-sm text-emerald-700">
                      All {pagination.total_count.toLocaleString()} recipients
                      selected
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2 lg:mt-0">
                  <ActionDropdown
                    label="Bulk Actions"
                    variant="outline"
                    align="end"
                    sections={selectionActionSections}
                    triggerClassName="border-emerald-200 bg-white/90 text-emerald-950 hover:border-emerald-300 hover:bg-white"
                    contentClassName="min-w-[22rem]"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearSelection}
                    className="text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear selection</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="secondary"
                  className="gap-1 rounded-full border border-brand-navy/10 bg-brand-navy/[0.06] px-3 py-1 pr-1 text-brand-navy hover:bg-brand-navy/[0.06]"
                >
                  {chip.label}
                  <button
                    aria-label={`Remove ${chip.label}`}
                    className="rounded-full p-0.5 text-brand-navy/70 transition-colors hover:bg-background/80 hover:text-brand-navy"
                    onClick={() => {
                      if (chip.key === "q") {
                        setSearchInput("");
                        requestParamUpdate({ q: null, page: "1" });
                      } else if (chip.key === "event") {
                        requestParamUpdate({ event: null, page: "1" });
                      } else if (chip.key === "time") {
                        requestParamUpdate({ time: null, page: "1" });
                      } else if (chip.key === "delivery") {
                        requestParamUpdate({ delivery: null, page: "1" });
                      }
                    }}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          {!isDefaultSort ? (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="gap-1 rounded-full border border-brand-teal/25 bg-brand-teal/10 px-3 py-1 text-brand-navy shadow-sm"
              >
                <span>Sorted by: {activeSortLabel}</span>
                <button
                  aria-label="Clear sort"
                  className="rounded-full p-0.5 hover:bg-brand-teal/15"
                  onClick={() =>
                    requestParamUpdate({
                      sort: null,
                      direction: null,
                      page: "1",
                    })
                  }
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="relative z-0 space-y-5 bg-white pt-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 rounded-2xl border border-border/60 bg-slate-50/70 p-4 shadow-sm"
                >
                  <Skeleton className="col-span-4 h-5" />
                  <Skeleton className="col-span-3 h-5" />
                  <Skeleton className="col-span-2 h-5" />
                  <Skeleton className="col-span-2 h-5" />
                  <Skeleton className="col-span-1 h-5" />
                </div>
              ))}
            </div>
          ) : !canShowRecipients || rowsWithRealtime.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-slate-50/60 px-6 py-14 text-center shadow-sm">
              <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-white text-muted-foreground shadow-sm">
                <Mail className="h-6 w-6" />
              </span>
              <h2 className="text-lg font-semibold text-brand-navy">
                No recipients for this campaign
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {campaign?.status === "draft" ||
                campaign?.status === "scheduled"
                  ? "Recipients will appear here after the campaign is sent."
                  : "No recipient rows were found for this campaign yet."}
              </p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {rowsWithRealtime.map((row) => {
                const primaryLabel = row.customer_name || row.customer_email;
                const recipientKey = toRecipientKey(row.customer_email);
                const isHighlighted = Boolean(
                  highlightedRecipients[recipientKey],
                );
                const isSelected =
                  allMatchingSelected ||
                  selectedRecipientSet.has(row.recipient_id);

                return (
                  <Card
                    key={row.recipient_id}
                    className={
                      [
                        isHighlighted
                          ? "bg-emerald-50/70 transition-colors duration-700"
                          : "",
                        isSelected
                          ? "border-primary/30 bg-primary/[0.045] shadow-sm"
                          : "border-border/70 shadow-sm shadow-brand-navy/5",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center justify-between">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleRowSelection(
                              row.recipient_id,
                              checked === true,
                            )
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            className="font-semibold text-foreground underline-offset-4 hover:underline"
                            onClick={() =>
                              rememberRecipientFocus(row.recipient_id)
                            }
                            to={buildRecipientDetailPath(row.recipient_id)}
                          >
                            {primaryLabel}
                          </Link>
                          {row.customer_name ? (
                            <div className="mt-1 text-sm text-muted-foreground">
                              {row.customer_email}
                            </div>
                          ) : null}
                        </div>
                        <Badge
                          className={`${getEventBadgeClass(row.latest_event)} rounded-full px-2.5 py-1 font-medium shadow-sm ${isHighlighted ? "animate-pulse ring-2 ring-emerald-200" : ""}`}
                        >
                          {getEventLabel(row.latest_event)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={getEngagementBadgeClass(
                            row.engagement_score ?? 0,
                          )}
                          variant="outline"
                        >
                          {getEngagementLabel(row.engagement_score ?? 0)} ·{" "}
                          {row.engagement_score ?? 0}
                        </Badge>
                        {row.retry_count ? (
                          <Badge variant="outline">Retry used</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${getDeliveryDotClass(row.delivery_status)}`}
                          />
                          <span>{getDeliveryLabel(row.delivery_status)}</span>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {formatRecipientTimestamp(row.latest_event_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatExactUtcTimestamp(row.latest_event_at)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={buildRecipientDetailPath(row.recipient_id)}>
                            View Email Details
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyEmail(row.customer_email)}
                        >
                          Copy Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleCopyRecipientLink(row.recipient_id)
                          }
                        >
                          Copy Link
                        </Button>
                        {row.customer_id ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/crm/customers/${row.customer_id}`}>
                              Customer
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-visible rounded-2xl border border-border/70 bg-white shadow-sm shadow-brand-navy/5">
              <Table>
                <TableHeader className="bg-slate-50/85">
                  <TableRow className="border-border/70 hover:bg-slate-50/85">
                    <TableHead className="w-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) =>
                          toggleVisibleSelection(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      Customer Name
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      Email
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      Latest Event
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      Event Time
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                      Delivery Status
                    </TableHead>
                    <TableHead className="hidden text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90 lg:table-cell">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody ref={tableBodyRef}>
                  {rowsWithRealtime.map((row) => {
                    const primaryLabel =
                      row.customer_name || row.customer_email;
                    const recipientKey = toRecipientKey(row.customer_email);
                    const isHighlighted = Boolean(
                      highlightedRecipients[recipientKey],
                    );

                    return (
                      <TableRow
                        data-recipient-id={row.recipient_id}
                        key={row.recipient_id}
                        className={
                          [
                            isHighlighted
                              ? "bg-emerald-50/70 transition-colors duration-700"
                              : "hover:bg-slate-50/70",
                            allMatchingSelected ||
                            selectedRecipientSet.has(row.recipient_id)
                              ? "bg-primary/[0.045]"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            focusRelativeRow(row.recipient_id, 1);
                          } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            focusRelativeRow(row.recipient_id, -1);
                          } else if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            rememberRecipientFocus(row.recipient_id);
                            navigate(
                              buildRecipientDetailPath(row.recipient_id),
                            );
                          }
                        }}
                        tabIndex={0}
                      >
                        <TableCell className="align-top">
                          <Checkbox
                            checked={
                              allMatchingSelected ||
                              selectedRecipientSet.has(row.recipient_id)
                            }
                            onCheckedChange={(checked) =>
                              toggleRowSelection(
                                row.recipient_id,
                                checked === true,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Link
                            className="font-medium text-foreground underline-offset-4 transition-colors hover:text-brand-navy hover:underline"
                            onClick={() =>
                              rememberRecipientFocus(row.recipient_id)
                            }
                            to={buildRecipientDetailPath(row.recipient_id)}
                          >
                            {primaryLabel}
                          </Link>
                          {row.customer_name ? (
                            <div className="mt-1 text-xs text-muted-foreground lg:hidden">
                              {row.customer_email}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              className={`${getEngagementBadgeClass(
                                row.engagement_score ?? 0,
                              )} rounded-full px-2.5 py-1 font-medium shadow-sm`}
                              variant="outline"
                            >
                              {getEngagementLabel(row.engagement_score ?? 0)} ·{" "}
                              {row.engagement_score ?? 0}
                            </Badge>
                            {row.retry_count ? (
                              <Badge variant="outline">Retry used</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {row.customer_name ? row.customer_email : "-"}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            className={`${getEventBadgeClass(row.latest_event)} rounded-full px-2.5 py-1 font-medium shadow-sm ${isHighlighted ? "animate-pulse ring-2 ring-emerald-200" : ""}`}
                          >
                            {getEventLabel(row.latest_event)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-2 text-muted-foreground">
                                  <Clock3 className="h-4 w-4 lg:hidden" />
                                  <span className="hidden lg:inline">
                                    {formatRecipientTimestamp(
                                      row.latest_event_at,
                                    )}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {formatExactUtcTimestamp(row.latest_event_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="align-top">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                  <span
                                    className={`inline-block h-2.5 w-2.5 rounded-full ${getDeliveryDotClass(row.delivery_status)}`}
                                  />
                                  <span>
                                    {getDeliveryLabel(row.delivery_status)}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getDeliveryLabel(row.delivery_status)} delivery
                                state
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell align-top text-right">
                          <ActionDropdown
                            label="Recipient actions"
                            ariaLabel={`Actions for ${primaryLabel}`}
                            triggerIcon={MoreHorizontal}
                            variant="ghost"
                            iconOnly
                            align="end"
                            triggerClassName="rounded-full text-muted-foreground hover:bg-brand-navy/5 hover:text-brand-navy"
                            contentClassName="min-w-[15rem]"
                            sections={[
                              {
                                items: [
                                  {
                                    label: "View Email Details",
                                    onSelect: () => {
                                      rememberRecipientFocus(row.recipient_id);
                                      navigate(
                                        buildRecipientDetailPath(
                                          row.recipient_id,
                                        ),
                                      );
                                    },
                                  },
                                  {
                                    label: "Copy Email Address",
                                    onSelect: () => {
                                      void handleCopyEmail(row.customer_email);
                                    },
                                  },
                                  {
                                    label: "Copy Recipient Link",
                                    onSelect: () => {
                                      void handleCopyRecipientLink(
                                        row.recipient_id,
                                      );
                                    },
                                  },
                                  ...(row.customer_id
                                    ? [
                                        {
                                          label: "View Customer Profile",
                                          onSelect: () => {
                                            navigate(
                                              `/crm/customers/${row.customer_id}`,
                                            );
                                          },
                                        },
                                      ]
                                    : []),
                                ],
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {rowsWithRealtime.length} of {pagination.total_count}{" "}
              filtered recipients
            </div>

            <div className="flex items-center gap-2 self-end">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
                className="rounded-full border-border/80 bg-white px-4 shadow-sm"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <div className="min-w-[130px] rounded-full border border-border/70 bg-slate-50 px-4 py-2 text-center text-sm text-muted-foreground shadow-sm">
                Page {pagination.total_pages === 0 ? 0 : pagination.page} of{" "}
                {pagination.total_pages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pagination.total_pages === 0 || page >= pagination.total_pages
                }
                onClick={() => updateParams({ page: String(page + 1) })}
                className="rounded-full border-border/80 bg-white px-4 shadow-sm"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Add a CRM tag to the selected recipients. Recipients without a
              linked customer will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Enter tag name"
              value={tagName}
              onChange={(event) => setTagName(event.target.value)}
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setTagName(tag.name)}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => runBulkAction("add-tag", { tagName })}
              disabled={!tagName.trim() || isBulkActing}
            >
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={segmentDialogOpen} onOpenChange={setSegmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Segment</DialogTitle>
            <DialogDescription>
              Assign the selected recipients to an existing CRM segment.
              Recipients without a linked customer will be skipped.
            </DialogDescription>
          </DialogHeader>

          <NativeSelect
            aria-label="Select CRM segment"
            onChange={(event) => setSelectedSegmentId(event.target.value)}
            options={[
              { value: "", label: "Choose a segment" },
              ...segments.map((segment) => ({
                value: segment.id,
                label: segment.name,
              })),
            ]}
            value={selectedSegmentId}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSegmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                runBulkAction("add-to-segment", {
                  segmentId: selectedSegmentId,
                })
              }
              disabled={!selectedSegmentId || isBulkActing}
            >
              Add to Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={clearSelectionDialogOpen}
        onOpenChange={setClearSelectionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear selection?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing filters will clear the current selection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingParamUpdates(null);
                setSearchInput(searchQuery);
              }}
            >
              Keep selection
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearSelection();
                if (pendingParamUpdates) {
                  updateParams(pendingParamUpdates);
                }
                setPendingParamUpdates(null);
              }}
            >
              Clear and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy a large email list?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy {pendingCopyCount.toLocaleString()} email addresses
              into the clipboard as a single comma-separated value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingCopyValue(null);
                setPendingCopyCount(0);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingCopyValue) return;
                try {
                  await navigator.clipboard.writeText(pendingCopyValue);
                  toast.success(
                    `${pendingCopyCount.toLocaleString()} emails copied to clipboard.`,
                  );
                } catch (error) {
                  console.error("Failed to copy pending email list", error);
                  toast.error("Unable to copy selected email addresses");
                } finally {
                  setPendingCopyValue(null);
                  setPendingCopyCount(0);
                }
              }}
            >
              Copy list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
