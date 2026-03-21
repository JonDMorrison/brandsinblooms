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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  Filter,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {subtitle ? (
        <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = sortColumn === column;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto px-0 py-0 font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground"
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === "asc" ? (
          <ArrowUp className="ml-2 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="ml-2 h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
      )}
    </Button>
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
    (searchParams.get("sort") as SortColumn | null) ?? "event_time";
  const sortDirection =
    (searchParams.get("direction") as SortDirection | null) ?? "desc";
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
  const selectionDescription = allMatchingSelected
    ? `All ${pagination.total_count.toLocaleString()} recipients matching the current filters are selected.`
    : `${selectedCount.toLocaleString()} recipient${selectedCount === 1 ? "" : "s"} selected.`;
  const healthSummary = formatCampaignHealthSummary(
    metrics,
    campaign?.recipient_count ?? 0,
  );

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

  const { connectionState, isLive, bannerState, dismissBanner } =
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
    toast.success(`${emails.length.toLocaleString()} email addresses copied`);
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

  const handleExportCurrentPage = useCallback(() => {
    const csv = buildRecipientCsv(rowsWithRealtime, campaign?.tenant_timezone);
    const fileName = `${sanitizeFileNamePart(campaign?.name || "campaign")}-recipients-page-${formatDateStamp()}.csv`;
    downloadTextFile(csv, fileName, "text/csv;charset=utf-8");
    toast.success("Current page exported");
  }, [campaign?.name, campaign?.tenant_timezone, rowsWithRealtime]);

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

  const handleSort = (column: SortColumn) => {
    const nextDirection: SortDirection =
      sortColumn === column && sortDirection === "desc" ? "asc" : "desc";

    updateParams({
      sort: column,
      direction: nextDirection,
      page: "1",
    });
  };

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

  const eventFilterLabel =
    compositeFilter !== "all"
      ? COMPOSITE_FILTER_OPTIONS.find(
          (option) => option.value === compositeFilter,
        )?.label || "Event"
      : selectedEvents.length > 0
        ? `Event (${selectedEvents.length})`
        : "Event";
  const timeFilterLabel =
    TIME_FILTER_OPTIONS.find((option) => option.value === timeRange)?.label ||
    "Time";
  const deliveryFilterLabel =
    DELIVERY_FILTER_OPTIONS.find((option) => option.value === deliveryFilter)
      ?.label || "Delivery";

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
    <div className="container mx-auto space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/crm/campaigns">Campaigns</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/crm/campaigns/${campaignId}/analytics`}>
                {campaign?.name ?? "Campaign"}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Recipients</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {campaign?.name ?? "Campaign Recipients"}
            </h1>
            {campaign ? (
              <Badge variant={getCampaignStatusVariant(campaign.status)}>
                {campaign.status}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="max-w-[18rem] truncate rounded-md border bg-card px-3 py-2">
                    <span className="font-medium text-foreground">
                      Subject:
                    </span>{" "}
                    {campaign?.subject_line || "No subject line"}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  {campaign?.subject_line || "No subject line"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="rounded-md border bg-card px-3 py-2">
              <span className="font-medium text-foreground">Send Time:</span>{" "}
              {formatCampaignTimestamp(
                campaignDate,
                campaign?.tenant_timezone ?? null,
              )}
            </div>

            <div className="rounded-md border bg-card px-3 py-2">
              <span className="font-medium text-foreground">Recipients:</span>{" "}
              {campaign?.recipient_count ?? 0}
            </div>

            <div className="rounded-md border bg-card px-3 py-2">
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

        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            onClick={() => navigate(`/crm/campaigns/${campaignId}/analytics`)}
          >
            Back to Campaign
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCurrentPage}>
                Export current page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportAllRecipients}
                disabled={isExporting}
              >
                Export all recipients
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isLive
                  ? "bg-emerald-500"
                  : connectionState === "connecting"
                    ? "bg-amber-500"
                    : "bg-slate-400"
              }`}
            />
            <span>
              {isLive
                ? "Live"
                : connectionState === "connecting"
                  ? "Connecting..."
                  : "Paused - Refresh to sync"}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {bannerState === "paused" ? (
        <Alert className="border-orange-200 bg-orange-50 text-orange-900">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>Live updates paused. Click Refresh to load latest data.</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                Refresh
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissBanner}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Sent" value={String(metrics.totals.sent)} />
        <StatCard
          label="Delivered"
          value={String(metrics.totals.delivered)}
          subtitle={`${metrics.rates.delivery.toFixed(1)}% rate`}
        />
        <StatCard
          label="Opened"
          value={String(metrics.totals.opens)}
          subtitle={`${metrics.rates.open_reported.toFixed(1)}% rate`}
        />
        <StatCard
          label="Clicked"
          value={String(metrics.totals.clicks)}
          subtitle={`${metrics.rates.click.toFixed(1)}% rate`}
        />
        <StatCard
          label="Bounced"
          value={String(metrics.totals.hard_bounces)}
          subtitle={`${metrics.rates.bounce.toFixed(1)}% rate`}
        />
        <StatCard
          label="Complained"
          value={String(metrics.totals.complaints)}
          subtitle={
            metrics.totals.complaints > 0
              ? `${metrics.rates.complaint.toFixed(1)}% rate`
              : "No complaints"
          }
        />
      </div>

      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {healthSummary}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Recipients
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {pagination.total_count.toLocaleString()} filtered of{" "}
                {(campaign?.recipient_count ?? 0).toLocaleString()} recipients
              </span>
              <Button size="sm" variant="outline" onClick={handleCopyViewLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy View Link
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-10"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    <Filter className="mr-2 h-4 w-4" />
                    {eventFilterLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Event filters</DropdownMenuLabel>
                  {COMPOSITE_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() =>
                        requestParamUpdate({
                          event: option.value,
                          page: "1",
                        })
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {EVENT_FILTER_OPTIONS.map((option) => {
                    const checked =
                      compositeFilter === "all" &&
                      selectedEvents.includes(option.value);

                    return (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={checked}
                        onCheckedChange={(checkedValue) => {
                          const nextEvents = checkedValue
                            ? [...selectedEvents, option.value]
                            : selectedEvents.filter(
                                (eventValue) => eventValue !== option.value,
                              );

                          requestParamUpdate({
                            event:
                              serializeEventQueryValue("all", nextEvents) ||
                              null,
                            page: "1",
                          });
                        }}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      requestParamUpdate({ event: null, page: "1" })
                    }
                  >
                    Clear event filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    {timeFilterLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {TIME_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() =>
                        requestParamUpdate({
                          time: option.value === "all" ? null : option.value,
                          page: "1",
                        })
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    {deliveryFilterLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {DELIVERY_FILTER_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() =>
                        requestParamUpdate({
                          delivery:
                            option.value === "all" ? null : option.value,
                          page: "1",
                        })
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

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

              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    requestParamUpdate({
                      q: null,
                      event: null,
                      time: null,
                      delivery: null,
                      page: "1",
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {chip.label}
                  <button
                    aria-label={`Remove ${chip.label}`}
                    className="rounded-full p-0.5 hover:bg-background/60"
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
        </CardHeader>

        <CardContent className="space-y-4">
          {selectedCount > 0 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {selectionDescription}
                </div>
                {allVisibleSelected &&
                !allMatchingSelected &&
                pagination.total_count > rowsWithRealtime.length ? (
                  <button
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setAllMatchingSelected(true)}
                    type="button"
                  >
                    Select all {pagination.total_count.toLocaleString()}{" "}
                    matching recipients
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopySelection}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Emails
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportSelected}
                  disabled={isExporting}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTagDialogOpen(true)}
                  disabled={isBulkActing}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Add Tag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSegmentDialogOpen(true)}
                  disabled={isBulkActing}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Add to Segment
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear selection
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 rounded-lg border p-4"
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
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <Mail className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
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
                        isSelected ? "border-primary/40 bg-primary/5" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  >
                    <CardContent className="space-y-3 p-4">
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
                          className={`${getEventBadgeClass(row.latest_event)} ${isHighlighted ? "animate-pulse ring-2 ring-emerald-200" : ""}`}
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
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
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
                    <TableHead>
                      <SortHeader
                        label="Customer Name"
                        column="customer_name"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Email"
                        column="email"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Latest Event"
                        column="latest_event"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortHeader
                        label="Event Time"
                        column="event_time"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>Delivery Status</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
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
                              : "",
                            allMatchingSelected ||
                            selectedRecipientSet.has(row.recipient_id)
                              ? "bg-primary/5"
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
                            className="font-medium text-foreground underline-offset-4 hover:underline"
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
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {row.customer_name ? row.customer_email : "-"}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            className={`${getEventBadgeClass(row.latest_event)} ${isHighlighted ? "animate-pulse ring-2 ring-emerald-200" : ""}`}
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  rememberRecipientFocus(row.recipient_id);
                                  navigate(
                                    buildRecipientDetailPath(row.recipient_id),
                                  );
                                }}
                              >
                                View Email Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleCopyEmail(row.customer_email)
                                }
                              >
                                Copy Email Address
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleCopyRecipientLink(row.recipient_id)
                                }
                              >
                                Copy Recipient Link
                              </DropdownMenuItem>
                              {row.customer_id ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(
                                      `/crm/customers/${row.customer_id}`,
                                    )
                                  }
                                >
                                  View Customer Profile
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
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
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <div className="min-w-[110px] text-center text-sm text-muted-foreground">
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
                    `${pendingCopyCount.toLocaleString()} email addresses copied`,
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
