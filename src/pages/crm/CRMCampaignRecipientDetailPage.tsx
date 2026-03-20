import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MoreHorizontal,
  MousePointer,
  RefreshCw,
  Send,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignEventRealtime } from "@/hooks/useCampaignEventRealtime";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  extractBounceReason,
  extractTrackingLinkUrl,
  getTrackingEventTimestamp,
  normalizeTrackingEventType,
  type EmailTrackingEventRow,
} from "@/lib/crm/emailTrackingRealtime";
import {
  buildAbsoluteLocationPath,
  buildRecipientFilterState,
  downloadTextFile,
  formatDateStamp,
  sanitizeFileNamePart,
} from "@/lib/crm/campaignRecipientOperations";
import { retryCampaignRecipientMessage } from "@/lib/email/emailRetryService";

interface CampaignSegment {
  id: string;
  name: string;
}

interface CampaignDetail {
  id: string;
  name: string;
  subject_line: string | null;
  content: string | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  tenant_timezone: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  delivery_method: string | null;
  domain_id: string | null;
  domain_name: string | null;
  segments: CampaignSegment[];
}

interface RecipientDetail {
  recipient_id: string;
  current_message_id?: string | null;
  retry_message_id?: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string;
  phone: string | null;
  send_status: string;
  latest_event: string;
  latest_event_at: string | null;
  delivery_status: string;
  sent_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
  attempts: number;
  resend_id: string | null;
  domain_id: string | null;
  error_message: string | null;
  has_hard_bounce?: boolean;
  hard_bounce_reason?: string | null;
  retry_count?: number;
  retry_status?: string | null;
  can_retry?: boolean;
  engagement_score?: number;
  has_sent: boolean;
  has_delivered: boolean;
  has_opened: boolean;
  has_clicked: boolean;
  has_bounced: boolean;
  has_complained: boolean;
  has_unsubscribed: boolean;
  total_spent: number | null;
  lifetime_value: number | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  custom_fields: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
}

interface NavigationContext {
  position: number;
  total_filtered_count: number;
  previous_recipient_id: string | null;
  previous_label: string | null;
  next_recipient_id: string | null;
  next_label: string | null;
}

interface Insights {
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  complained: boolean;
  unsubscribed: boolean;
  has_mpp_open: boolean;
  open_count: number;
  click_count: number;
  bounce_count: number;
  complaint_count: number;
  first_open_at: string | null;
  last_open_at: string | null;
  first_click_at: string | null;
  last_click_at: string | null;
}

interface TimelineEntry {
  event_type: string;
  event_at: string | null;
  label: string;
  metadata?: {
    provider_message_id?: string;
    link_url?: string;
    is_mpp_guess?: boolean;
    event_data?: Record<string, unknown>;
    attempts?: number;
  } | null;
}

interface ActivityLogEntry {
  id: string;
  event_type: string;
  event_at: string | null;
  provider_message_id: string | null;
  webhook_delivery_id: string | null;
  link_id: string | null;
  link_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  is_mpp_guess: boolean;
  event_data: Record<string, unknown> | null;
}

interface CampaignRecipientDetailResponse {
  campaign: CampaignDetail | null;
  recipient: RecipientDetail | null;
  navigation: NavigationContext | null;
  insights: Insights | null;
  timeline: TimelineEntry[];
  activity_log: ActivityLogEntry[];
  not_found: boolean;
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
    case "open":
      return "Opened";
    case "delivered":
      return "Delivered";
    case "sent":
      return "Sent";
    case "bounced":
    case "bounce":
      return "Bounced";
    case "complained":
    case "complaint":
      return "Complaint";
    case "failed":
      return "Failed";
    case "unsubscribed":
      return "Unsubscribed";
    case "sending":
      return "Sending";
    case "queued":
      return "Queued";
    case "attempted":
      return "Attempted";
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

function formatRelativeTimestamp(timestamp: string | null) {
  if (!timestamp) return "No timestamp";
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

function formatExactTimestamp(
  timestamp: string | null,
  timezone?: string | null,
) {
  if (!timestamp) return "No timestamp";
  const zone = timezone || "UTC";
  return formatInTimeZone(
    new Date(timestamp),
    zone,
    timezone ? "PPpp zzz" : "PPpp 'UTC'",
  );
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDurationBetween(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return "Not available";
  return formatDistanceStrict(new Date(startAt), new Date(endAt));
}

function createTimelineEntryFromEvent(
  event: EmailTrackingEventRow,
): TimelineEntry {
  const normalizedType = normalizeTrackingEventType(event.event_type);
  return {
    event_type: normalizedType,
    event_at: getTrackingEventTimestamp(event),
    label: getEventLabel(normalizedType),
    metadata: {
      provider_message_id: event.provider_message_id || undefined,
      link_url: extractTrackingLinkUrl(event) || undefined,
      is_mpp_guess: event.is_mpp_guess,
      event_data:
        event.event_data &&
        typeof event.event_data === "object" &&
        !Array.isArray(event.event_data)
          ? (event.event_data as Record<string, unknown>)
          : null,
    },
  };
}

function createActivityLogEntryFromEvent(
  event: EmailTrackingEventRow,
): ActivityLogEntry {
  return {
    id: event.id,
    event_type: normalizeTrackingEventType(event.event_type),
    event_at: getTrackingEventTimestamp(event),
    provider_message_id: event.provider_message_id,
    webhook_delivery_id: event.webhook_delivery_id,
    link_id: event.link_id,
    link_url: extractTrackingLinkUrl(event),
    user_agent: event.user_agent,
    ip_address: typeof event.ip_address === "string" ? event.ip_address : null,
    is_mpp_guess: event.is_mpp_guess,
    event_data:
      event.event_data &&
      typeof event.event_data === "object" &&
      !Array.isArray(event.event_data)
        ? (event.event_data as Record<string, unknown>)
        : null,
  };
}

function appendTimelineEntry(entries: TimelineEntry[], entry: TimelineEntry) {
  const exists = entries.some(
    (candidate) =>
      candidate.event_type === entry.event_type &&
      candidate.event_at === entry.event_at &&
      candidate.metadata?.provider_message_id ===
        entry.metadata?.provider_message_id &&
      candidate.metadata?.link_url === entry.metadata?.link_url,
  );
  if (exists) return entries;

  return [...entries, entry].sort((left, right) => {
    const leftTime = left.event_at ? new Date(left.event_at).getTime() : 0;
    const rightTime = right.event_at ? new Date(right.event_at).getTime() : 0;
    return leftTime - rightTime;
  });
}

function appendActivityEntry(
  entries: ActivityLogEntry[],
  entry: ActivityLogEntry,
) {
  if (entries.some((candidate) => candidate.id === entry.id)) return entries;
  return [...entries, entry].sort((left, right) => {
    const leftTime = left.event_at ? new Date(left.event_at).getTime() : 0;
    const rightTime = right.event_at ? new Date(right.event_at).getTime() : 0;
    return leftTime - rightTime;
  });
}

function DetailStat({
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-4 text-xs leading-5 text-foreground">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

export default function CRMCampaignRecipientDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { campaignId, recipientId } = useParams<{
    campaignId: string;
    recipientId: string;
  }>();
  const [searchParams] = useSearchParams();
  const filterState = buildRecipientFilterState(searchParams);
  const [activeTab, setActiveTab] = useState("preview");
  const [isActivityExpanded, setIsActivityExpanded] = useState(true);
  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const search = filterState.searchQuery || null;
  const filter = filterState.compositeFilter;
  const eventFilters = filterState.selectedEvents;
  const timeRange = filterState.timeRange;
  const deliveryFilter = filterState.deliveryFilter;
  const sortColumn = searchParams.get("sort") ?? "event_time";
  const sortDirection = searchParams.get("direction") ?? "desc";
  const searchSuffix = location.search || "";

  const recipientsPath = campaignId
    ? `/dashboard/campaigns/${campaignId}/recipients${searchSuffix}`
    : "/crm/campaigns";

  const buildRecipientPath = (id: string | null) =>
    id
      ? `/dashboard/campaigns/${campaignId}/recipients/${id}${searchSuffix}`
      : recipientsPath;

  const [liveRecipient, setLiveRecipient] = useState<RecipientDetail | null>(
    null,
  );
  const [liveInsights, setLiveInsights] = useState<Insights | null>(null);
  const [liveTimeline, setLiveTimeline] = useState<TimelineEntry[]>([]);
  const [liveActivityLog, setLiveActivityLog] = useState<ActivityLogEntry[]>(
    [],
  );
  const [highlightedTimelineKeys, setHighlightedTimelineKeys] = useState<
    Record<string, boolean>
  >({});
  const [highlightedActivityKeys, setHighlightedActivityKeys] = useState<
    Record<string, boolean>
  >({});
  const highlightTimersRef = useRef<Record<string, number>>({});

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "campaign-recipient-detail",
      campaignId,
      recipientId,
      search,
      filter,
      eventFilters,
      timeRange,
      deliveryFilter,
      sortColumn,
      sortDirection,
    ],
    queryFn: async () => {
      const { data: response, error } = await supabase.rpc(
        "get_campaign_recipient_detail" as any,
        {
          p_campaign_id: campaignId,
          p_recipient_id: recipientId,
          p_search: search,
          p_event_filter: filter,
          p_sort_column: sortColumn,
          p_sort_direction: sortDirection,
          p_event_filters: eventFilters.length ? eventFilters : null,
          p_time_range: timeRange,
          p_delivery_filter: deliveryFilter,
        } as any,
      );

      if (error) throw error;
      return (response ?? null) as CampaignRecipientDetailResponse | null;
    },
    enabled: Boolean(campaignId && recipientId),
  });

  const campaign = data?.campaign ?? null;
  const recipient = data?.recipient ?? null;
  const navigation = data?.navigation ?? null;
  const insights = liveInsights;
  const timeline = liveTimeline;
  const activityLog = liveActivityLog;

  useEffect(() => {
    setLiveRecipient(data?.recipient ?? null);
    setLiveInsights(data?.insights ?? null);
    setLiveTimeline(data?.timeline ?? []);
    setLiveActivityLog([...(data?.activity_log ?? [])].reverse());
  }, [data]);

  const payload = useMemo(
    () => (liveRecipient?.payload ?? {}) as Record<string, unknown>,
    [liveRecipient?.payload],
  );
  const payloadSubject =
    typeof payload.subject === "string" ? payload.subject : null;
  const payloadHtml = typeof payload.html === "string" ? payload.html : null;
  const payloadFrom = typeof payload.from === "string" ? payload.from : null;
  const payloadReplyTo =
    typeof payload.reply_to === "string" ? payload.reply_to : null;
  const payloadTo = Array.isArray(payload.to)
    ? payload.to
        .filter((value): value is string => typeof value === "string")
        .join(", ")
    : typeof payload.to === "string"
      ? payload.to
      : (liveRecipient?.customer_email ?? "-");

  const previewSubject =
    payloadSubject || campaign?.subject_line || "No subject line";
  const rawPreviewHtml = payloadHtml || campaign?.content || "";
  const previewHtml = activeTab === "preview" ? rawPreviewHtml : "";
  const previewSource = payloadHtml
    ? "snapshot"
    : campaign?.content
      ? "current_campaign"
      : "unavailable";

  const handleMarkdownExport = useCallback(() => {
    if (!campaign || !liveRecipient) return;

    const markdown = [
      "# Campaign Recipient Export",
      "",
      "## Campaign",
      `- Name: ${campaign.name}`,
      `- Subject: ${campaign.subject_line || "No subject line"}`,
      `- Status: ${campaign.status}`,
      `- Sent At: ${formatExactTimestamp(campaign.sent_at || campaign.scheduled_at || campaign.created_at, campaign.tenant_timezone)}`,
      "",
      "## Recipient",
      `- Name: ${liveRecipient.customer_name || "Unknown"}`,
      `- Email: ${liveRecipient.customer_email}`,
      `- Latest Event: ${getEventLabel(liveRecipient.latest_event)}`,
      `- Latest Event Time: ${formatExactTimestamp(liveRecipient.latest_event_at, campaign.tenant_timezone)}`,
      `- Delivery Status: ${getDeliveryLabel(liveRecipient.delivery_status)}`,
      `- Customer ID: ${liveRecipient.customer_id || "Not linked"}`,
      `- Phone: ${liveRecipient.phone || "-"}`,
      "",
      "## Insights",
      `- Opened: ${insights?.opened ? "Yes" : "No"}`,
      `- Clicked: ${insights?.clicked ? "Yes" : "No"}`,
      `- Bounced: ${insights?.bounced ? "Yes" : "No"}`,
      `- Complained: ${insights?.complained ? "Yes" : "No"}`,
      `- Unsubscribed: ${insights?.unsubscribed ? "Yes" : "No"}`,
      `- Open Count: ${insights?.open_count ?? 0}`,
      `- Click Count: ${insights?.click_count ?? 0}`,
      "",
      "## Timeline",
      ...timeline.map(
        (entry) =>
          `- ${entry.event_at ? formatExactTimestamp(entry.event_at, campaign.tenant_timezone) : "No timestamp"}: ${entry.label}`,
      ),
      "",
      "## Activity Log",
      ...activityLog.map(
        (entry) =>
          `- ${entry.event_at ? formatExactTimestamp(entry.event_at, campaign.tenant_timezone) : "No timestamp"}: ${getEventLabel(entry.event_type)}${entry.link_url ? ` (${entry.link_url})` : ""}`,
      ),
    ].join("\n");

    const fileName = `${sanitizeFileNamePart(campaign.name)}-${sanitizeFileNamePart(liveRecipient.customer_email)}-${formatDateStamp()}.md`;
    downloadTextFile(markdown, fileName, "text/markdown;charset=utf-8");
    toast.success("Recipient markdown exported");
  }, [activityLog, campaign, insights, liveRecipient, timeline]);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch (error) {
      console.error(`Failed to copy ${label.toLowerCase()}`, error);
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(
      buildAbsoluteLocationPath(
        `${window.location.pathname}${window.location.search}`,
      ),
    );
    toast.success("Recipient link copied");
  }, []);

  const handleRetryRecipient = useCallback(async () => {
    if (!campaignId || !recipientId) return;

    try {
      setIsRetrying(true);
      const result = await retryCampaignRecipientMessage(
        campaignId,
        recipientId,
      );

      if (result.blockedReason) {
        if (result.blockedReason === "already_retried") {
          toast.error("This recipient has already used its retry.");
        } else if (result.blockedReason === "not_retryable") {
          toast.error("Only failed or bounced recipients can be retried.");
        } else {
          toast.error("Unable to queue a retry for this recipient.");
        }
        return;
      }

      toast.success("Retry queued for this recipient");
      setIsRetryDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["campaign-recipient-detail", campaignId, recipientId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["campaign-recipients-page", campaignId],
        }),
      ]);
      await refetch();
    } catch (error) {
      console.error("Failed to retry recipient", error);
      toast.error("Unable to queue a retry for this recipient");
    } finally {
      setIsRetrying(false);
    }
  }, [campaignId, queryClient, recipientId, refetch]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleRealtimeEvent = useCallback(
    (event: EmailTrackingEventRow, options: { animate: boolean }) => {
      const normalizedType = normalizeTrackingEventType(event.event_type);
      const eventAt = getTrackingEventTimestamp(event);
      const timelineEntry = createTimelineEntryFromEvent(event);
      const activityEntry = createActivityLogEntryFromEvent(event);
      const timelineKey = `${timelineEntry.event_type}-${timelineEntry.event_at}-${activityEntry.id}`;

      setLiveRecipient((current) => {
        if (!current) return current;

        const nextRecipient = { ...current };
        nextRecipient.latest_event = normalizedType;
        nextRecipient.latest_event_at = eventAt;
        if (event.provider_message_id && !nextRecipient.resend_id) {
          nextRecipient.resend_id = event.provider_message_id;
        }

        if (normalizedType === "delivered") {
          nextRecipient.has_delivered = true;
          nextRecipient.delivery_status = "delivered";
        } else if (normalizedType === "opened") {
          nextRecipient.has_opened = true;
        } else if (normalizedType === "clicked") {
          nextRecipient.has_clicked = true;
        } else if (normalizedType === "bounced") {
          nextRecipient.has_bounced = true;
          nextRecipient.delivery_status = "bounced";
          nextRecipient.error_message = extractBounceReason(event);
        } else if (normalizedType === "complained") {
          nextRecipient.has_complained = true;
          nextRecipient.delivery_status = "complained";
        } else if (normalizedType === "unsubscribed") {
          nextRecipient.has_unsubscribed = true;
        }

        return nextRecipient;
      });

      setLiveInsights((current) => {
        if (!current) return current;

        const nextInsights = { ...current };
        if (normalizedType === "opened") {
          nextInsights.opened = true;
          nextInsights.open_count += 1;
          nextInsights.first_open_at = nextInsights.first_open_at || eventAt;
          nextInsights.last_open_at = eventAt;
          nextInsights.has_mpp_open =
            nextInsights.has_mpp_open || event.is_mpp_guess;
        } else if (normalizedType === "clicked") {
          nextInsights.clicked = true;
          nextInsights.click_count += 1;
          nextInsights.first_click_at = nextInsights.first_click_at || eventAt;
          nextInsights.last_click_at = eventAt;
        } else if (normalizedType === "bounced") {
          nextInsights.bounced = true;
          nextInsights.bounce_count += 1;
        } else if (normalizedType === "complained") {
          nextInsights.complained = true;
          nextInsights.complaint_count += 1;
        } else if (normalizedType === "unsubscribed") {
          nextInsights.unsubscribed = true;
        }

        return nextInsights;
      });

      setLiveTimeline((current) => appendTimelineEntry(current, timelineEntry));
      setLiveActivityLog((current) =>
        appendActivityEntry(current, activityEntry),
      );

      if (options.animate) {
        setHighlightedTimelineKeys((current) => ({
          ...current,
          [timelineKey]: true,
        }));
        setHighlightedActivityKeys((current) => ({
          ...current,
          [activityEntry.id]: true,
        }));
        window.clearTimeout(highlightTimersRef.current[timelineKey]);
        window.clearTimeout(highlightTimersRef.current[activityEntry.id]);
        highlightTimersRef.current[timelineKey] = window.setTimeout(() => {
          setHighlightedTimelineKeys((current) => {
            const next = { ...current };
            delete next[timelineKey];
            return next;
          });
          delete highlightTimersRef.current[timelineKey];
        }, 700);
        highlightTimersRef.current[activityEntry.id] = window.setTimeout(() => {
          setHighlightedActivityKeys((current) => {
            const next = { ...current };
            delete next[activityEntry.id];
            return next;
          });
          delete highlightTimersRef.current[activityEntry.id];
        }, 700);
      }
    },
    [],
  );

  const { connectionState, isLive, bannerState, dismissBanner } =
    useCampaignEventRealtime({
      campaignId,
      tenantId: tenant?.id,
      recipientEmail: liveRecipient?.customer_email,
      enabled: Boolean(
        campaignId && tenant?.id && liveRecipient?.customer_email,
      ),
      channelName: `campaign-recipient-detail-events-${campaignId}-${recipientId}`,
      onEvent: handleRealtimeEvent,
    });

  useEffect(() => {
    return () => {
      Object.values(highlightTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [recipientId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && navigation?.previous_recipient_id) {
        event.preventDefault();
        navigate(buildRecipientPath(navigation.previous_recipient_id));
      } else if (event.key === "ArrowRight" && navigation?.next_recipient_id) {
        event.preventDefault();
        navigate(buildRecipientPath(navigation.next_recipient_id));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buildRecipientPath, navigate, navigation]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">Loading recipient detail...</div>
    );
  }

  if (!data || data.not_found || !campaign || !liveRecipient) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Mail className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Recipient detail not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This recipient or campaign does not exist, or you do not have
            access.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/crm/campaigns">Back to Campaigns</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
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
                <Link to={recipientsPath}>{campaign.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {liveRecipient.customer_name || liveRecipient.customer_email}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-3xl font-semibold tracking-tight"
                ref={headingRef}
                tabIndex={-1}
              >
                {liveRecipient.customer_name || liveRecipient.customer_email}
              </h1>
              <Badge className={getEventBadgeClass(liveRecipient.latest_event)}>
                {getEventLabel(liveRecipient.latest_event)}
              </Badge>
              <Badge variant="outline">{campaign.status}</Badge>
              <Badge variant="outline">
                Engagement {liveRecipient.engagement_score ?? 0}
              </Badge>
              {liveRecipient.retry_count ? (
                <Badge variant="outline">Retry used</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="font-medium text-foreground">Campaign:</span>{" "}
                {campaign.name}
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="font-medium text-foreground">Recipient:</span>{" "}
                {liveRecipient.customer_email}
              </div>
              <div className="rounded-md border bg-card px-3 py-2">
                <span className="font-medium text-foreground">Send Time:</span>{" "}
                {formatExactTimestamp(
                  campaign.sent_at ||
                    campaign.scheduled_at ||
                    campaign.created_at,
                  campaign.tenant_timezone,
                )}
              </div>
              {navigation ? (
                <div className="rounded-md border bg-card px-3 py-2">
                  <span className="font-medium text-foreground">
                    List Position:
                  </span>{" "}
                  {navigation.position} of {navigation.total_filtered_count}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button variant="outline" asChild>
              <Link to={recipientsPath}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Recipients
              </Link>
            </Button>
            {liveRecipient.customer_id ? (
              <Button variant="outline" asChild>
                <Link to={`/crm/customers/${liveRecipient.customer_id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Customer
                </Link>
              </Button>
            ) : null}
            {liveRecipient.can_retry ? (
              <Button
                variant="outline"
                onClick={() => setIsRetryDialogOpen(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Send
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy recipient link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMarkdownExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export markdown
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
              <span>
                Live updates paused. Click Refresh to load latest data.
              </span>
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailStat
            label="Latest Event"
            value={getEventLabel(liveRecipient.latest_event)}
            subtitle={formatRelativeTimestamp(liveRecipient.latest_event_at)}
          />
          <DetailStat
            label="Opens"
            value={String(insights?.open_count ?? 0)}
            subtitle={
              insights?.has_mpp_open
                ? "Includes privacy-proxy opens"
                : "Unique activity captured"
            }
          />
          <DetailStat
            label="Clicks"
            value={String(insights?.click_count ?? 0)}
            subtitle={
              insights?.last_click_at
                ? formatRelativeTimestamp(insights.last_click_at)
                : "No click events"
            }
          />
          <DetailStat
            label="Attempts"
            value={String(liveRecipient.attempts ?? 0)}
            subtitle={
              liveRecipient.error_message ||
              getDeliveryLabel(liveRecipient.delivery_status)
            }
          />
        </div>

        {liveRecipient.has_hard_bounce ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertDescription>
              This address has a hard-bounce signal.
              {liveRecipient.hard_bounce_reason
                ? ` ${liveRecipient.hard_bounce_reason}`
                : " Retry carefully because mailbox issues may be permanent."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="h-5 w-5 text-primary" />
                Delivery Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                  No lifecycle events have been recorded for this recipient yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((entry, index) =>
                    (() => {
                      const entryKey = `${entry.event_type}-${entry.event_at}-${entry.metadata?.provider_message_id || index}`;
                      const isHighlighted = Boolean(
                        highlightedTimelineKeys[entryKey],
                      );
                      const timelineAnimation = isHighlighted
                        ? isMobile
                          ? "animate-slide-in-up"
                          : "animate-slide-in-right"
                        : "";

                      return (
                        <div
                          key={entryKey}
                          className={`flex gap-4 rounded-lg transition-colors duration-700 ${isHighlighted ? "bg-emerald-50/70 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]" : ""} ${timelineAnimation}`}
                        >
                          <div className="mt-1 flex flex-col items-center">
                            <span
                              className={`inline-block h-3 w-3 rounded-full ${getDeliveryDotClass(entry.event_type === "attempted" ? "sent" : entry.event_type === "queued" ? "queued" : liveRecipient.delivery_status)}`}
                            />
                            {index < timeline.length - 1 ? (
                              <span className="mt-2 h-full min-h-8 w-px bg-border" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pb-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-foreground">
                                {entry.label}
                              </div>
                              <Badge variant="outline">
                                {getEventLabel(entry.event_type)}
                              </Badge>
                              {entry.metadata?.is_mpp_guess ? (
                                <Badge variant="secondary">MPP guessed</Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {formatExactTimestamp(
                                entry.event_at,
                                campaign.tenant_timezone,
                              )}
                            </div>
                            {entry.metadata?.link_url ? (
                              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                                <MousePointer className="mt-0.5 h-4 w-4 text-primary" />
                                <span className="break-all">
                                  {entry.metadata.link_url}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })(),
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Send className="h-5 w-5 text-primary" />
                  Message Routing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    From
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {payloadFrom ||
                      `${campaign.from_name || "Unknown sender"}${campaign.from_email ? ` <${campaign.from_email}>` : ""}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reply-To
                  </div>
                  <div className="mt-1 text-foreground">
                    {payloadReplyTo || campaign.reply_to || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    To
                  </div>
                  <div className="mt-1 text-foreground break-all">
                    {payloadTo}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Delivery Status
                  </div>
                  <div className="mt-1 inline-flex items-center gap-2 text-foreground">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${getDeliveryDotClass(liveRecipient.delivery_status)}`}
                    />
                    {getDeliveryLabel(liveRecipient.delivery_status)}
                  </div>
                </div>
                {liveRecipient.resend_id ? (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Provider Message ID
                    </div>
                    <div className="mt-1 flex items-center gap-2 break-all text-foreground">
                      <span>{liveRecipient.resend_id}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          handleCopy(
                            liveRecipient.resend_id as string,
                            "Provider message ID",
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Mail className="h-5 w-5 text-primary" />
                  Delivery Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Delivery Timestamp
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatExactTimestamp(
                        liveTimeline.find(
                          (entry) => entry.event_type === "delivered",
                        )?.event_at ?? null,
                        campaign.tenant_timezone,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Time to Deliver
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatDurationBetween(
                        liveRecipient.sent_at,
                        liveTimeline.find(
                          (entry) => entry.event_type === "delivered",
                        )?.event_at ?? null,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Bounce Reason
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {liveRecipient.error_message || "No bounce recorded"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Link Click Detail
                    </div>
                    <div className="mt-1 break-all font-medium text-foreground">
                      {activityLog
                        .slice()
                        .reverse()
                        .find((entry) => entry.link_url)?.link_url ||
                        "No click URL recorded"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <User className="h-5 w-5 text-primary" />
                  Recipient Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      First Open
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatExactTimestamp(
                        insights?.first_open_at ?? null,
                        campaign.tenant_timezone,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      First Click
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatExactTimestamp(
                        insights?.first_click_at ?? null,
                        campaign.tenant_timezone,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Lifetime Value
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatCurrency(liveRecipient.lifetime_value)}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total Spent
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatCurrency(liveRecipient.total_spent)}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Time to Open
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatDurationBetween(
                        liveTimeline.find(
                          (entry) => entry.event_type === "delivered",
                        )?.event_at ?? liveRecipient.sent_at,
                        insights?.first_open_at ?? null,
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Time to Click
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {formatDurationBetween(
                        liveTimeline.find(
                          (entry) => entry.event_type === "delivered",
                        )?.event_at ?? liveRecipient.sent_at,
                        insights?.first_click_at ?? null,
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {insights?.opened ? (
                    <Badge variant="secondary">Opened</Badge>
                  ) : null}
                  {insights?.clicked ? (
                    <Badge variant="secondary">Clicked</Badge>
                  ) : null}
                  {insights?.bounced ? (
                    <Badge variant="secondary">Bounced</Badge>
                  ) : null}
                  {insights?.complained ? (
                    <Badge variant="secondary">Complained</Badge>
                  ) : null}
                  {insights?.unsubscribed ? (
                    <Badge variant="secondary">Unsubscribed</Badge>
                  ) : null}
                  {insights?.has_mpp_open ? (
                    <Badge variant="outline">
                      Privacy-proxy opens detected
                    </Badge>
                  ) : null}
                </div>
                {liveRecipient.error_message ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Latest error
                    </div>
                    <div className="mt-2">{liveRecipient.error_message}</div>
                  </div>
                ) : null}
                {liveRecipient.retry_status ? (
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm text-foreground">
                    Latest retry status: {liveRecipient.retry_status}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-2 rounded-lg border bg-card p-4">
              <Button
                asChild
                disabled={!navigation?.previous_recipient_id}
                variant="outline"
              >
                <Link
                  to={buildRecipientPath(
                    navigation?.previous_recipient_id ?? null,
                  )}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {navigation?.previous_label || "Previous"}
                </Link>
              </Button>
              <Button
                asChild
                disabled={!navigation?.next_recipient_id}
                variant="outline"
              >
                <Link
                  to={buildRecipientPath(navigation?.next_recipient_id ?? null)}
                >
                  {navigation?.next_label || "Next"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              <TabsList className="grid w-full grid-cols-3 lg:w-[420px]">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {previewSubject}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {previewSource === "snapshot"
                        ? "Exact rendered payload snapshot"
                        : previewSource === "current_campaign"
                          ? "Current campaign content fallback"
                          : "No preview content available"}
                      {activeTab !== "preview"
                        ? " Preview HTML stays unloaded until this tab is active."
                        : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        previewSource === "snapshot" ? "secondary" : "outline"
                      }
                    >
                      {previewSource === "snapshot"
                        ? "Snapshot"
                        : previewSource === "current_campaign"
                          ? "Current Campaign"
                          : "Unavailable"}
                    </Badge>
                    {previewHtml ? (
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(previewHtml, "Email HTML")}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy HTML
                      </Button>
                    ) : null}
                  </div>
                </div>

                {previewHtml ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <iframe
                        className="h-[720px] w-full"
                        srcDoc={previewHtml}
                        title="Campaign email preview"
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-medium text-foreground">
                        Rendered HTML
                      </div>
                      <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-4 text-xs leading-5 text-foreground">
                        {previewHtml}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                    No HTML preview is available for this recipient yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Recipient Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Email
                        </div>
                        <div className="mt-1 text-foreground break-all">
                          {liveRecipient.customer_email}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Phone
                        </div>
                        <div className="mt-1 text-foreground">
                          {liveRecipient.phone || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Created
                        </div>
                        <div className="mt-1 text-foreground">
                          {formatExactTimestamp(
                            liveRecipient.created_at,
                            campaign.tenant_timezone,
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Sent
                        </div>
                        <div className="mt-1 text-foreground">
                          {formatExactTimestamp(
                            liveRecipient.sent_at,
                            campaign.tenant_timezone,
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Last Attempt
                        </div>
                        <div className="mt-1 text-foreground">
                          {formatExactTimestamp(
                            liveRecipient.last_attempt_at,
                            campaign.tenant_timezone,
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Campaign Metadata
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Campaign
                        </div>
                        <div className="mt-1 text-foreground">
                          {campaign.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Subject
                        </div>
                        <div className="mt-1 text-foreground">
                          {previewSubject}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Segments
                        </div>
                        <div className="mt-1 text-foreground">
                          {campaign.segments.length
                            ? campaign.segments
                                .map((segment) => segment.name)
                                .join(", ")
                            : "No linked segments"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Sending Domain
                        </div>
                        <div className="mt-1 text-foreground">
                          {campaign.domain_name || "Platform default"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Delivery Method
                        </div>
                        <div className="mt-1 text-foreground">
                          {campaign.delivery_method || "-"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">
                        Payload Snapshot
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleCopy(
                            JSON.stringify(payload, null, 2),
                            "Payload JSON",
                          )
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy JSON
                      </Button>
                    </div>
                    <JsonBlock value={payload} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-foreground">
                      Customer Custom Fields
                    </div>
                    <JsonBlock value={liveRecipient.custom_fields} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <Collapsible
                  open={isActivityExpanded}
                  onOpenChange={setIsActivityExpanded}
                >
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 px-4 py-3">
                    <div>
                      <div className="font-medium text-foreground">
                        Activity Log
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activityLog.length} tracking{" "}
                        {activityLog.length === 1 ? "event" : "events"}
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        {isActivityExpanded ? "Collapse" : "Expand"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {activityLog.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                        No tracking events have been recorded for this message
                        yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activityLog.map((entry) => (
                          <div
                            key={entry.id}
                            className={`rounded-xl border p-4 transition-colors duration-700 ${highlightedActivityKeys[entry.id] ? "bg-emerald-50/70 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]" : ""}`}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    className={getEventBadgeClass(
                                      entry.event_type,
                                    )}
                                  >
                                    {getEventLabel(entry.event_type)}
                                  </Badge>
                                  {entry.is_mpp_guess ? (
                                    <Badge variant="secondary">
                                      MPP guessed
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatExactTimestamp(
                                    entry.event_at,
                                    campaign.tenant_timezone,
                                  )}
                                </div>
                                {entry.link_url ? (
                                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <MousePointer className="mt-0.5 h-4 w-4 text-primary" />
                                    <span className="break-all">
                                      {entry.link_url}
                                    </span>
                                  </div>
                                ) : null}
                                {entry.user_agent ? (
                                  <div className="text-xs text-muted-foreground break-all">
                                    User-Agent: {entry.user_agent}
                                  </div>
                                ) : null}
                                {entry.ip_address ? (
                                  <div className="text-xs text-muted-foreground">
                                    IP: {entry.ip_address}
                                  </div>
                                ) : null}
                              </div>

                              <div className="w-full max-w-xl space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Event Data
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleCopy(
                                        JSON.stringify(
                                          entry.event_data ?? {},
                                          null,
                                          2,
                                        ),
                                        "Event data",
                                      )
                                    }
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                  </Button>
                                </div>
                                <JsonBlock value={entry.event_data} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isRetryDialogOpen} onOpenChange={setIsRetryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry this recipient send?</AlertDialogTitle>
            <AlertDialogDescription>
              A retry creates a second ledger row and reuses the existing send
              infrastructure. This action is only available once per recipient.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {liveRecipient.has_hard_bounce ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Hard-bounce warning:
              {liveRecipient.hard_bounce_reason
                ? ` ${liveRecipient.hard_bounce_reason}`
                : " the mailbox may be permanently unavailable."}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRetrying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRetrying}
              onClick={(event) => {
                event.preventDefault();
                void handleRetryRecipient();
              }}
            >
              {isRetrying ? "Queueing..." : "Queue Retry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
