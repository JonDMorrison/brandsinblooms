import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  Download,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Search,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RecipientStatusChip, normalizeRecipientStatus, type RecipientLiveStatus } from "@/components/crm/campaigns/RecipientStatusChip";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { PageContainer } from "@/components/joy/PageContainer";
import { CAMPAIGN_STATUS, getCampaignStatusLabel } from "@/constants/campaignStatuses";
import { normalizeDerivedMetrics } from "@/hooks/analytics/useCampaignDerivedMetrics";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  buildRecipientFilterState,
  downloadTextFile,
  serializeEventQueryValue,
  type RecipientDeliveryFilter,
  type RecipientEventSelection,
  type RecipientSortColumn,
  type RecipientSortDirection,
} from "@/lib/crm/campaignRecipientOperations";
import {
  getTrackingEventTimestamp,
  normalizeTrackingEventType,
  toRecipientKey,
  type EmailTrackingEventRow,
} from "@/lib/crm/emailTrackingRealtime";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type EmailMessageRow = Database["public"]["Tables"]["email_messages"]["Row"];

interface RecipientRow {
  recipient_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  send_status: string | null;
  latest_event: string | null;
  latest_event_at: string | null;
  delivery_status: string | null;
  sent_at: string | null;
  created_at: string | null;
  all_events?: string[] | null;
}

interface CampaignSummary {
  id: string;
  name: string | null;
  subject_line: string | null;
  status: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  metrics?: unknown;
  recipient_count?: number | null;
  tenant_timezone?: string | null;
  segments?: Array<{ id: string; name: string }>;
}

interface CampaignProgressRow {
  id: string;
  tenant_id: string | null;
  status: string | null;
  total_recipients: number | null;
  messages_sent: number | null;
  messages_failed: number | null;
  messages_skipped: number | null;
  queue_started_at: string | null;
  queue_completed_at: string | null;
  send_started_at: string | null;
  send_completed_at: string | null;
  worker_heartbeat_at: string | null;
  estimated_completion_at: string | null;
  stall_count: number | null;
  metrics: unknown;
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
  not_found?: boolean;
}

type StatusFilter = "all" | "delivered" | "opened" | "bounced" | "failed" | "queued";
type ConnectionState = "connecting" | "live" | "reconnecting";

interface SummaryMetrics {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  failed: number;
}

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "bounced", label: "Bounced" },
  { key: "failed", label: "Failed" },
  { key: "queued", label: "Queued" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCampaignNameForDisplay(name: string | null | undefined) {
  const trimmed = (name || "").trim();
  return trimmed || "Untitled campaign";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (Math.abs(differenceInHours(new Date(), date)) < 24) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "MMM d, yyyy h:mm a");
}

function getActiveStatusFilter(
  deliveryFilter: RecipientDeliveryFilter,
  selectedEvents: RecipientEventSelection[],
): StatusFilter {
  if (selectedEvents.includes("opened")) return "opened";
  if (deliveryFilter === "delivered") return "delivered";
  if (deliveryFilter === "bounced") return "bounced";
  if (deliveryFilter === "failed") return "failed";
  if (deliveryFilter === "pending") return "queued";
  return "all";
}

function getFilterParams(filter: StatusFilter): {
  event: string | null;
  delivery: RecipientDeliveryFilter;
} {
  switch (filter) {
    case "delivered":
      return { event: null, delivery: "delivered" };
    case "opened":
      return { event: "opened", delivery: "all" };
    case "bounced":
      return { event: null, delivery: "bounced" };
    case "failed":
      return { event: null, delivery: "failed" };
    case "queued":
      return { event: null, delivery: "pending" };
    default:
      return { event: null, delivery: "all" };
  }
}

function getRowStatus(row: RecipientRow): RecipientLiveStatus {
  const eventStatus = normalizeRecipientStatus(row.latest_event);

  if (["clicked", "opened", "delivered", "bounced", "complained", "unsubscribed"].includes(eventStatus)) {
    return eventStatus;
  }

  if (row.send_status === "failed" || row.delivery_status === "failed") return "failed";
  if (row.send_status === "sending") return "sending";
  if (row.send_status === "queued") return "queued";
  if (row.send_status === "skipped") return "skipped";
  if (row.delivery_status === "delivered") return "delivered";
  if (row.delivery_status === "bounced") return "bounced";
  if (row.send_status === "sent") return "sent";
  return eventStatus === "unknown" ? "queued" : eventStatus;
}

function isRetryableRow(row: RecipientRow) {
  const status = getRowStatus(row);
  return status === "failed" || status === "bounced" || row.send_status === "failed";
}

function eventToDeliveryStatus(eventType: string, current: string | null | undefined) {
  const normalized = normalizeTrackingEventType(eventType);
  if (normalized === "bounced") return "bounced";
  if (normalized === "complained") return "delivered";
  if (["delivered", "opened", "clicked"].includes(normalized)) return "delivered";
  return current || null;
}

function eventIsRelevantToStatus(eventType: string) {
  return [
    "sent",
    "delivered",
    "opened",
    "clicked",
    "bounced",
    "complained",
    "unsubscribed",
    "deferred",
    "rejected",
  ].includes(normalizeTrackingEventType(eventType));
}

function createRowFromMessage(message: EmailMessageRow): RecipientRow {
  const payload = message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
    ? (message.payload as Record<string, unknown>)
    : {};
  const customerName = typeof payload.customer_name === "string"
    ? payload.customer_name
    : typeof payload.customerName === "string"
      ? payload.customerName
      : null;

  return {
    recipient_id: message.id,
    customer_id: message.customer_id,
    customer_name: customerName,
    customer_email: message.email,
    send_status: message.status,
    latest_event: message.status === "failed" ? "failed" : message.status,
    latest_event_at: message.sent_at || message.last_attempt_at || message.updated_at,
    delivery_status: message.status === "failed" ? "failed" : message.status === "queued" ? "pending" : "sent",
    sent_at: message.sent_at,
    created_at: message.created_at,
    all_events: message.status === "sent" ? ["sent"] : [],
  };
}

function shouldShowLiveInsertedRow(
  row: RecipientRow,
  page: number,
  searchQuery: string,
  activeFilter: StatusFilter,
) {
  if (page !== 1 || searchQuery.trim()) return false;
  if (activeFilter === "all") return true;
  const status = getRowStatus(row);
  if (activeFilter === "queued") {
    return status === "queued" || status === "sending" || row.delivery_status === "pending";
  }
  return status === activeFilter;
}

function buildSummaryMetrics(
  campaign: CampaignSummary | null | undefined,
  progress: CampaignProgressRow | null | undefined,
  totalCount: number,
): SummaryMetrics {
  const derived = normalizeDerivedMetrics(progress?.metrics ?? campaign?.metrics);
  return {
    total: toNumber(progress?.total_recipients ?? campaign?.recipient_count, totalCount),
    sent: toNumber(progress?.messages_sent, derived?.totals.sent ?? 0),
    delivered: derived?.totals.delivered ?? 0,
    opened: derived?.totals.opens ?? 0,
    bounced: derived?.totals.bounces ?? derived?.totals.hard_bounces ?? 0,
    failed: toNumber(progress?.messages_failed, 0),
  };
}

function clampMetric(value: number) {
  return Math.max(0, Math.round(value));
}

function mutateMetric(
  metrics: SummaryMetrics,
  key: keyof SummaryMetrics,
  delta: number,
): SummaryMetrics {
  return { ...metrics, [key]: clampMetric(metrics[key] + delta) };
}

function getCampaignStatusColor(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case CAMPAIGN_STATUS.SENDING:
    case CAMPAIGN_STATUS.QUEUED:
    case CAMPAIGN_STATUS.PARTIALLY_QUEUED:
      return "primary" as const;
    case CAMPAIGN_STATUS.SENT:
      return "success" as const;
    case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
    case CAMPAIGN_STATUS.PAUSED:
      return "warning" as const;
    case CAMPAIGN_STATUS.FAILED:
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function isActiveSendStatus(status: string | null | undefined) {
  return [CAMPAIGN_STATUS.QUEUED, CAMPAIGN_STATUS.PARTIALLY_QUEUED, CAMPAIGN_STATUS.SENDING].includes(
    (status || "") as typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS],
  );
}

export default function CRMCampaignRecipientsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = React.useMemo(() => buildRecipientFilterState(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = React.useState(filters.searchQuery);
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const sortColumn = (searchParams.get("sort") as RecipientSortColumn | null) || "event_time";
  const sortDirection = (searchParams.get("dir") as RecipientSortDirection | null) || "desc";
  const activeFilter = getActiveStatusFilter(filters.deliveryFilter, filters.selectedEvents);
  const eventQueryValue = serializeEventQueryValue(filters.compositeFilter, filters.selectedEvents);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [rowPatches, setRowPatches] = React.useState<Record<string, Partial<RecipientRow>>>({});
  const [liveRowsById, setLiveRowsById] = React.useState<Record<string, RecipientRow>>({});
  const [highlightedRows, setHighlightedRows] = React.useState<Record<string, number>>({});
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("connecting");
  const [summaryMetrics, setSummaryMetrics] = React.useState<SummaryMetrics>({
    total: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    bounced: 0,
    failed: 0,
  });
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRetryingSelected, setIsRetryingSelected] = React.useState(false);

  const rowsRef = React.useRef<RecipientRow[]>([]);
  const messageStatusByIdRef = React.useRef<Map<string, string>>(new Map());
  const metricEventKeysRef = React.useRef<Set<string>>(new Set());
  const pollWhenDisconnected = connectionState === "reconnecting";

  React.useEffect(() => {
    setSearchInput(filters.searchQuery);
  }, [filters.searchQuery]);

  React.useEffect(() => {
    if (debouncedSearch === filters.searchQuery) return;
    const nextParams = new URLSearchParams(searchParams);
    if (debouncedSearch.trim()) nextParams.set("q", debouncedSearch.trim());
    else nextParams.delete("q");
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
  }, [debouncedSearch, filters.searchQuery, searchParams, setSearchParams]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [campaignId, filters.searchQuery, filters.deliveryFilter, eventQueryValue, page]);

  const recipientsQuery = useQuery({
    queryKey: [
      "campaign-recipients-live-page",
      campaignId,
      page,
      filters.searchQuery,
      filters.compositeFilter,
      eventQueryValue,
      filters.timeRange,
      filters.deliveryFilter,
      sortColumn,
      sortDirection,
    ],
    enabled: Boolean(campaignId),
    refetchInterval: pollWhenDisconnected ? 10_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_recipients_page" as any, {
        p_campaign_id: campaignId,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_search: filters.searchQuery || null,
        p_event_filter: filters.compositeFilter,
        p_sort_column: sortColumn,
        p_sort_direction: sortDirection,
        p_event_filters: filters.selectedEvents.length ? filters.selectedEvents : null,
        p_time_range: filters.timeRange,
        p_delivery_filter: filters.deliveryFilter,
      } as any);

      if (error) throw error;
      return data as CampaignRecipientsResponse;
    },
  });

  const campaignProgressQuery = useQuery({
    queryKey: ["campaign-recipients-progress", campaignId],
    enabled: Boolean(campaignId),
    refetchInterval: pollWhenDisconnected ? 10_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          "id, tenant_id, status, total_recipients, messages_sent, messages_failed, messages_skipped, queue_started_at, queue_completed_at, send_started_at, send_completed_at, worker_heartbeat_at, estimated_completion_at, stall_count, metrics",
        )
        .eq("id", campaignId)
        .maybeSingle();

      if (error) throw error;
      return data as CampaignProgressRow | null;
    },
  });

  const baseRows = recipientsQuery.data?.rows ?? [];
  const pagination = recipientsQuery.data?.pagination ?? {
    page,
    page_size: PAGE_SIZE,
    total_count: 0,
    total_pages: 0,
  };
  const campaign = recipientsQuery.data?.campaign ?? null;
  const progress = campaignProgressQuery.data ?? null;
  const campaignStatus = progress?.status ?? campaign?.status ?? null;
  const campaignName = normalizeCampaignNameForDisplay(campaign?.name);

  const rows = React.useMemo(() => {
    const baseIds = new Set(baseRows.map((row) => row.recipient_id));
    const merged = baseRows.map((row) => ({ ...row, ...(rowPatches[row.recipient_id] || {}) }));
    const liveRows = Object.values(liveRowsById).filter(
      (row) => !baseIds.has(row.recipient_id) && shouldShowLiveInsertedRow(row, page, filters.searchQuery, activeFilter),
    );
    return [...liveRows, ...merged].slice(0, PAGE_SIZE);
  }, [activeFilter, baseRows, filters.searchQuery, liveRowsById, page, rowPatches]);

  React.useEffect(() => {
    rowsRef.current = rows;
    rows.forEach((row) => {
      if (row.send_status) messageStatusByIdRef.current.set(row.recipient_id, row.send_status);
      const recipientKey = toRecipientKey(row.customer_email);
      (row.all_events || []).forEach((event) => {
        const normalized = normalizeTrackingEventType(event);
        metricEventKeysRef.current.add(`${normalized}:${recipientKey}`);
      });
    });
  }, [rows]);

  React.useEffect(() => {
    setSummaryMetrics(buildSummaryMetrics(campaign, progress, pagination.total_count));
  }, [campaign, pagination.total_count, progress]);

  const markRowHighlighted = React.useCallback((recipientId: string) => {
    setHighlightedRows((current) => ({ ...current, [recipientId]: Date.now() }));
    window.setTimeout(() => {
      setHighlightedRows((current) => {
        const next = { ...current };
        delete next[recipientId];
        return next;
      });
    }, 2400);
  }, []);

  const updateVisibleRowFromEvent = React.useCallback(
    (event: EmailTrackingEventRow) => {
      if (!eventIsRelevantToStatus(event.event_type)) return;
      const recipientKey = toRecipientKey(event.customer_email);
      if (!recipientKey) return;

      const normalizedEvent = normalizeTrackingEventType(event.event_type);
      const eventAt = getTrackingEventTimestamp(event);
      const visibleRow = rowsRef.current.find((row) => toRecipientKey(row.customer_email) === recipientKey);

      if (visibleRow) {
        setRowPatches((current) => {
          const previous = current[visibleRow.recipient_id] || {};
          const allEvents = Array.from(new Set([...(visibleRow.all_events || []), ...(previous.all_events || []), normalizedEvent]));
          return {
            ...current,
            [visibleRow.recipient_id]: {
              ...previous,
              latest_event: normalizedEvent,
              latest_event_at: eventAt,
              delivery_status: eventToDeliveryStatus(event.event_type, previous.delivery_status ?? visibleRow.delivery_status),
              sent_at: visibleRow.sent_at || event.sent_at || previous.sent_at || null,
              all_events: allEvents,
            },
          };
        });
        markRowHighlighted(visibleRow.recipient_id);
      }

      const metricKey = `${normalizedEvent}:${recipientKey}`;
      if (metricEventKeysRef.current.has(metricKey)) return;
      metricEventKeysRef.current.add(metricKey);

      setSummaryMetrics((current) => {
        if (normalizedEvent === "delivered") return mutateMetric(current, "delivered", 1);
        if (normalizedEvent === "opened") return mutateMetric(current, "opened", 1);
        if (normalizedEvent === "bounced") return mutateMetric(current, "bounced", 1);
        return current;
      });
    },
    [markRowHighlighted],
  );

  const updateRowFromMessage = React.useCallback(
    (message: EmailMessageRow) => {
      const previousStatus = messageStatusByIdRef.current.get(message.id);
      messageStatusByIdRef.current.set(message.id, message.status);

      const visibleRow = rowsRef.current.find((row) => row.recipient_id === message.id);
      const nextPatch: Partial<RecipientRow> = {
        send_status: message.status,
        sent_at: message.sent_at,
        latest_event: message.status === "failed" ? "failed" : message.status,
        latest_event_at: message.sent_at || message.last_attempt_at || message.updated_at,
        delivery_status: message.status === "failed" ? "failed" : message.status === "queued" ? "pending" : visibleRow?.delivery_status || "sent",
      };

      if (visibleRow) {
        setRowPatches((current) => ({
          ...current,
          [message.id]: {
            ...(current[message.id] || {}),
            ...nextPatch,
          },
        }));
        markRowHighlighted(message.id);
      } else {
        const liveRow = createRowFromMessage(message);
        if (shouldShowLiveInsertedRow(liveRow, page, filters.searchQuery, activeFilter)) {
          setLiveRowsById((current) => ({ ...current, [message.id]: liveRow }));
          markRowHighlighted(message.id);
        }
      }

      if (previousStatus === message.status) return;
      setSummaryMetrics((current) => {
        if (message.status === "sent") return mutateMetric(current, "sent", 1);
        if (message.status === "failed") return mutateMetric(current, "failed", 1);
        return current;
      });
    },
    [activeFilter, filters.searchQuery, markRowHighlighted, page],
  );

  React.useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-recipients-live:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_tracking_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const event = payload.new as EmailTrackingEventRow;
          const tenantId = campaignProgressQuery.data?.tenant_id;
          if (tenantId && event.tenant_id && event.tenant_id !== tenantId) return;
          updateVisibleRowFromEvent(event);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "email_messages",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const message = payload.new as EmailMessageRow;
          const tenantId = campaignProgressQuery.data?.tenant_id;
          if (tenantId && message.tenant_id && message.tenant_id !== tenantId) return;
          updateRowFromMessage(message);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crm_campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          queryClient.setQueryData(["campaign-recipients-progress", campaignId], payload.new as CampaignProgressRow);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnectionState("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionState("reconnecting");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, campaignProgressQuery.data?.tenant_id, queryClient, updateRowFromMessage, updateVisibleRowFromEvent]);

  const selectedRows = React.useMemo(
    () => rows.filter((row) => selectedIds.has(row.recipient_id)),
    [rows, selectedIds],
  );
  const retryableSelection = selectedRows.filter(isRetryableRow);
  const canRetrySelected = selectedRows.length > 0 && retryableSelection.length === selectedRows.length;
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.recipient_id));
  const someVisibleSelected = rows.some((row) => selectedIds.has(row.recipient_id));
  const progressTotal = Math.max(summaryMetrics.total, 0);
  const progressValue = progressTotal > 0 ? Math.min(100, (summaryMetrics.sent / progressTotal) * 100) : 0;
  const isSending = campaignStatus === CAMPAIGN_STATUS.SENDING;
  const isActive = isActiveSendStatus(campaignStatus);

  const updateParams = React.useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const nextParams = new URLSearchParams(searchParams);
      mutator(nextParams);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleFilterChange = (filter: StatusFilter) => {
    const params = getFilterParams(filter);
    updateParams((nextParams) => {
      nextParams.set("page", "1");
      nextParams.delete("filter");
      if (params.event) nextParams.set("event", params.event);
      else nextParams.delete("event");
      if (params.delivery !== "all") nextParams.set("delivery", params.delivery);
      else nextParams.delete("delivery");
    });
  };

  const handleSort = (column: RecipientSortColumn) => {
    updateParams((nextParams) => {
      const currentColumn = (nextParams.get("sort") as RecipientSortColumn | null) || "event_time";
      const currentDirection = (nextParams.get("dir") as RecipientSortDirection | null) || "desc";
      const nextDirection = currentColumn === column && currentDirection === "desc" ? "asc" : "desc";
      nextParams.set("sort", column);
      nextParams.set("dir", nextDirection);
      nextParams.set("page", "1");
    });
  };

  const handlePageChange = (nextPage: number) => {
    updateParams((nextParams) => {
      nextParams.set("page", String(nextPage));
    });
  };

  const toggleRowSelection = (recipientId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recipientId)) next.delete(recipientId);
      else next.add(recipientId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) rows.forEach((row) => next.delete(row.recipient_id));
      else rows.forEach((row) => next.add(row.recipient_id));
      return next;
    });
  };

  const buildDetailPath = (recipientId: string) => {
    const params = new URLSearchParams(searchParams);
    return `/crm/campaigns/${campaignId}/recipients/${recipientId}${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const handleExport = async (recipientIds: string[]) => {
    if (!campaignId || recipientIds.length === 0) return;
    try {
      setIsExporting(true);
      const { data, error } = await supabase.functions.invoke("campaign-recipient-export", {
        body: {
          campaignId,
          recipientIds,
          search: filters.searchQuery || null,
          eventFilter: filters.compositeFilter,
          eventFilters: filters.selectedEvents.length ? filters.selectedEvents : null,
          timeRange: filters.timeRange,
          deliveryFilter: filters.deliveryFilter,
        },
      });

      if (error) throw error;
      const result = data as { ok?: boolean; csvContent?: string; fileName?: string; rowCount?: number; error?: string };
      if (!result.ok || !result.csvContent) throw new Error(result.error || "Unable to export recipients");
      downloadTextFile(result.csvContent, result.fileName || `campaign-recipients-${campaignId}.csv`, "text/csv;charset=utf-8");
      toast.success(`Exported ${result.rowCount ?? recipientIds.length} recipient${(result.rowCount ?? recipientIds.length) === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const retryRecipientIds = async (recipientIds: string[]) => {
    if (!campaignId || recipientIds.length === 0) return;
    const { data, error } = await supabase.functions.invoke("campaign-recipient-bulk-actions", {
      body: {
        action: "retry",
        campaignId,
        recipientIds,
      },
    });

    if (error) throw error;
    const result = data as { ok?: boolean; updatedCount?: number; skippedCount?: number; error?: string };
    if (!result.ok) throw new Error(result.error || "Unable to retry selected recipients");
    toast.success(`Queued ${result.updatedCount ?? recipientIds.length} retry${(result.updatedCount ?? recipientIds.length) === 1 ? "" : "s"}`);
    void recipientsQuery.refetch();
    void campaignProgressQuery.refetch();
  };

  const handleRetrySelected = async () => {
    if (retryableSelection.length === 0) return;
    if (!canRetrySelected) {
      toast.error("Only failed or bounced recipients can be retried.");
      return;
    }

    try {
      setIsRetryingSelected(true);
      await retryRecipientIds(retryableSelection.map((row) => row.recipient_id));
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRetryingSelected(false);
    }
  };

  const handleRetryRow = async (row: RecipientRow) => {
    if (!isRetryableRow(row)) return;
    try {
      setIsRetryingSelected(true);
      await retryRecipientIds([row.recipient_id]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRetryingSelected(false);
    }
  };

  if (!campaignId) {
    return (
      <PageContainer>
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 4, textAlign: "center" }}>
          <Typography level="title-md">Campaign not found</Typography>
        </Sheet>
      </PageContainer>
    );
  }

  return (
    <PageContainer fullWidth sx={{ pb: 4 }}>
      <Sheet variant="plain" sx={{ minHeight: "100%" }}>
        <Stack spacing={2.5}>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <JoyButton
                component={Link}
                to={`/crm/campaigns/${campaignId}`}
                bloomVariant="ghost"
                color="neutral"
                size="sm"
                startDecorator={<ChevronLeft size={16} />}
              >
                Campaign
              </JoyButton>
              <Typography level="title-lg" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {recipientsQuery.isLoading ? <Skeleton width={260} /> : campaignName}
              </Typography>
              <JoyChip variant="soft" color={getCampaignStatusColor(campaignStatus)}>
                {getCampaignStatusLabel(campaignStatus || "draft")}
              </JoyChip>
              {isSending ? (
                <Tooltip title="Campaign is actively sending">
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: "success.500",
                      boxShadow: "0 0 0 0 rgba(46, 125, 50, 0.4)",
                      animation: "campaign-live-pulse 1.6s ease-out infinite",
                      "@keyframes campaign-live-pulse": {
                        "0%": { boxShadow: "0 0 0 0 rgba(46, 125, 50, 0.4)" },
                        "70%": { boxShadow: "0 0 0 8px rgba(46, 125, 50, 0)" },
                        "100%": { boxShadow: "0 0 0 0 rgba(46, 125, 50, 0)" },
                      },
                    }}
                  />
                </Tooltip>
              ) : null}
              {connectionState !== "live" ? (
                <Typography level="body-xs" color="neutral" sx={{ ml: "auto" }}>
                  Reconnecting...
                </Typography>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={2.5} useFlexGap flexWrap="wrap" sx={{ color: "neutral.600" }}>
              <Typography level="body-sm">Total: {summaryMetrics.total.toLocaleString()}</Typography>
              <Typography level="body-sm">Sent: {summaryMetrics.sent.toLocaleString()}</Typography>
              <Typography level="body-sm">Delivered: {summaryMetrics.delivered.toLocaleString()}</Typography>
              <Typography level="body-sm">Opened: {summaryMetrics.opened.toLocaleString()}</Typography>
              <Typography level="body-sm">Bounced: {summaryMetrics.bounced.toLocaleString()}</Typography>
              <Typography level="body-sm">Failed: {summaryMetrics.failed.toLocaleString()}</Typography>
            </Stack>

            {isActive && progressTotal > 0 ? (
              <Stack spacing={0.75}>
                <LinearProgress determinate value={progressValue} thickness={4} />
                <Typography level="body-xs" color="neutral">
                  {summaryMetrics.sent.toLocaleString()} of {progressTotal.toLocaleString()} messages accepted by the send pipeline
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 1.5 }}>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }}>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {STATUS_FILTERS.map((filter) => (
                  <JoyChip
                    key={filter.key}
                    role="button"
                    tabIndex={0}
                    variant={activeFilter === filter.key ? "solid" : "soft"}
                    color={activeFilter === filter.key ? "primary" : "neutral"}
                    onClick={() => handleFilterChange(filter.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") handleFilterChange(filter.key);
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    {filter.label}
                  </JoyChip>
                ))}
              </Stack>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search recipients"
                startDecorator={<Search size={16} />}
                sx={{ width: { xs: "100%", lg: 320 } }}
              />
            </Stack>
          </Sheet>

          {selectedIds.size > 0 ? (
            <Sheet variant="soft" color="primary" sx={{ borderRadius: "lg", px: 2, py: 1.25 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
                <Typography level="body-sm" fontWeight="md">
                  {selectedIds.size.toLocaleString()} recipient{selectedIds.size === 1 ? "" : "s"} selected
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Tooltip title={canRetrySelected ? "Retry selected failed or bounced recipients" : "Only failed or bounced recipients can be retried"}>
                    <span>
                      <JoyButton
                        size="sm"
                        bloomVariant="secondary"
                        disabled={!canRetrySelected || isRetryingSelected}
                        loading={isRetryingSelected}
                        startDecorator={<RotateCcw size={15} />}
                        onClick={() => void handleRetrySelected()}
                      >
                        Retry Selected
                      </JoyButton>
                    </span>
                  </Tooltip>
                  <JoyButton
                    size="sm"
                    bloomVariant="secondary"
                    disabled={isExporting}
                    loading={isExporting}
                    startDecorator={<Download size={15} />}
                    onClick={() => void handleExport(Array.from(selectedIds))}
                  >
                    Export Selected
                  </JoyButton>
                  <JoyButton size="sm" bloomVariant="ghost" color="neutral" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </JoyButton>
                </Stack>
              </Stack>
            </Sheet>
          ) : null}

          <Sheet variant="outlined" sx={{ borderRadius: "lg", overflow: "hidden" }}>
            <JoyTable aria-label="Campaign recipients" containerSx={{ border: 0, borderRadius: 0 }}>
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell sx={{ width: 48 }}>
                    <Checkbox
                      size="sm"
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={toggleVisibleSelection}
                      slotProps={{ input: { "aria-label": "Select all visible recipients" } }}
                    />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={sortColumn === "customer_name" ? sortDirection : "none"}
                    onSort={() => handleSort("customer_name")}
                  >
                    Recipient
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={sortColumn === "latest_event" ? sortDirection : "none"}
                    onSort={() => handleSort("latest_event")}
                    sx={{ width: 170 }}
                  >
                    Status
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={sortColumn === "event_time" ? sortDirection : "none"}
                    onSort={() => handleSort("event_time")}
                    sx={{ width: 190 }}
                  >
                    Sent At
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 230 }}>Last Event</JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 72, textAlign: "right" }}>Actions</JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {recipientsQuery.isLoading ? (
                  Array.from({ length: 15 }).map((_, index) => (
                    <JoyTableRow key={index}>
                      <JoyTableCell><Skeleton width={18} height={18} /></JoyTableCell>
                      <JoyTableCell><Skeleton width="72%" /></JoyTableCell>
                      <JoyTableCell><Skeleton width={92} height={28} /></JoyTableCell>
                      <JoyTableCell><Skeleton width={126} /></JoyTableCell>
                      <JoyTableCell><Skeleton width="80%" /></JoyTableCell>
                      <JoyTableCell><Skeleton width={32} /></JoyTableCell>
                    </JoyTableRow>
                  ))
                ) : recipientsQuery.isError ? (
                  <JoyTableRow>
                    <JoyTableCell colSpan={6} sx={{ py: 5, textAlign: "center" }}>
                      <Stack spacing={1} alignItems="center">
                        <Typography level="title-sm">Could not load recipients</Typography>
                        <Typography level="body-sm" color="neutral">
                          {getErrorMessage(recipientsQuery.error)}
                        </Typography>
                        <JoyButton size="sm" bloomVariant="secondary" onClick={() => void recipientsQuery.refetch()}>
                          Retry
                        </JoyButton>
                      </Stack>
                    </JoyTableCell>
                  </JoyTableRow>
                ) : rows.length === 0 ? (
                  <JoyTableRow>
                    <JoyTableCell colSpan={6} sx={{ py: 6, textAlign: "center" }}>
                      <Stack spacing={1} alignItems="center">
                        <Mail size={22} />
                        <Typography level="title-sm">No recipients match this view</Typography>
                        <Typography level="body-sm" color="neutral">
                          Adjust the search or status filter to inspect more recipient activity.
                        </Typography>
                      </Stack>
                    </JoyTableCell>
                  </JoyTableRow>
                ) : (
                  rows.map((row) => {
                    const status = getRowStatus(row);
                    const isHighlighted = Boolean(highlightedRows[row.recipient_id]);
                    const isSelected = selectedIds.has(row.recipient_id);
                    return (
                      <JoyTableRow
                        key={row.recipient_id}
                        clickable
                        onClick={() => navigate(buildDetailPath(row.recipient_id))}
                        sx={{
                          "& > td": {
                            backgroundColor: isHighlighted ? "primary.50" : undefined,
                          },
                        }}
                      >
                        <JoyTableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            size="sm"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(row.recipient_id)}
                            slotProps={{ input: { "aria-label": `Select ${row.customer_email}` } }}
                          />
                        </JoyTableCell>
                        <JoyTableCell>
                          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography level="body-sm" fontWeight="md" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.customer_name || row.customer_email}
                            </Typography>
                            <Typography level="body-xs" color="neutral" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.customer_email}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell>
                          <RecipientStatusChip status={status} />
                        </JoyTableCell>
                        <JoyTableCell>
                          <Typography level="body-sm" color="neutral">
                            {formatTimestamp(row.sent_at)}
                          </Typography>
                        </JoyTableCell>
                        <JoyTableCell>
                          <Stack spacing={0.25} alignItems="flex-start">
                            {normalizeRecipientStatus(row.latest_event) === "unknown" ? (
                              <Typography level="body-sm" color="neutral">No event yet</Typography>
                            ) : (
                              <RecipientStatusChip status={row.latest_event} size="sm" />
                            )}
                            <Typography level="body-xs" color="neutral">
                              {formatTimestamp(row.latest_event_at)}
                            </Typography>
                          </Stack>
                        </JoyTableCell>
                        <JoyTableCell onClick={(event) => event.stopPropagation()} sx={{ textAlign: "right" }}>
                          <Dropdown>
                            <MenuButton slots={{ root: IconButton }} slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}>
                              <MoreHorizontal size={18} />
                            </MenuButton>
                            <Menu placement="bottom-end">
                              <MenuItem onClick={() => navigate(buildDetailPath(row.recipient_id))}>View Details</MenuItem>
                              <MenuItem disabled={!isRetryableRow(row)} onClick={() => void handleRetryRow(row)}>
                                Retry
                              </MenuItem>
                              <MenuItem onClick={() => void handleExport([row.recipient_id])}>Export CSV</MenuItem>
                            </Menu>
                          </Dropdown>
                        </JoyTableCell>
                      </JoyTableRow>
                    );
                  })
                )}
              </JoyTableBody>
            </JoyTable>
          </Sheet>

          <JoyTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={pagination.total_count}
            onPageChange={handlePageChange}
            showPageSizeSelector={false}
            disabled={recipientsQuery.isFetching}
          />
        </Stack>
      </Sheet>
    </PageContainer>
  );
}