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
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Info,
  Mail,
  MousePointer,
  MousePointerClick,
  RefreshCw,
  Send,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignEventRealtime } from "@/hooks/useCampaignEventRealtime";
import { useIsMobile } from "@/hooks/use-mobile";
import { CRMMetricCard } from "@/components/crm/CRMMetricCard";
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
import { ActionDropdown } from "@/components/ui/action-dropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";

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

function formatDisplayValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

function formatTimestampDisplay(
  timestamp: string | null,
  timezone?: string | null,
) {
  return timestamp ? formatExactTimestamp(timestamp, timezone) : "—";
}

function formatDurationDisplay(startAt: string | null, endAt: string | null) {
  return startAt && endAt ? formatDurationBetween(startAt, endAt) : "—";
}

function formatCurrencyDisplay(value: number | null) {
  return value === null || Number.isNaN(value) ? "—" : formatCurrency(value);
}

function getTimelineNodeClass(eventType: string) {
  switch (eventType) {
    case "queued":
      return "bg-gray-400 ring-gray-200";
    case "attempted":
      return "bg-amber-400 ring-amber-100";
    case "sent":
      return "bg-blue-400 ring-blue-100";
    case "delivered":
    case "opened":
    case "open":
      return "bg-emerald-500 ring-emerald-100";
    case "clicked":
      return "bg-teal-500 ring-teal-100";
    case "bounced":
    case "bounce":
    case "failed":
      return "bg-red-500 ring-red-100";
    case "complained":
    case "complaint":
      return "bg-orange-500 ring-orange-100";
    default:
      return "bg-slate-400 ring-slate-100";
  }
}

function getTimelineBadgeClass(eventType: string) {
  switch (eventType) {
    case "queued":
      return "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-100";
    case "attempted":
      return "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "sent":
      return "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "delivered":
    case "opened":
    case "open":
      return "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "clicked":
      return "border-teal-200 bg-teal-100 text-teal-800 hover:bg-teal-100";
    case "bounced":
    case "bounce":
    case "failed":
      return "border-red-200 bg-red-100 text-red-800 hover:bg-red-100";
    case "complained":
    case "complaint":
      return "border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-100";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
}

function DetailField({
  label,
  value,
  muted = false,
  truncate = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  truncate?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-slate-50/70 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-sm font-medium text-foreground",
          muted && "text-muted-foreground",
          truncate && "truncate",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </div>
    </div>
  );
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

function getDeliveryStatusPresentation(status: string) {
  switch (status) {
    case "delivered":
      return {
        icon: CheckCircle,
        iconClassName: "text-emerald-700",
        iconWrapClassName: "border-emerald-200 bg-emerald-50",
        valueClassName: "text-xl text-emerald-600",
      };
    case "bounced":
    case "failed":
      return {
        icon: XCircle,
        iconClassName: "text-red-700",
        iconWrapClassName: "border-red-200 bg-red-50",
        valueClassName: "text-xl text-red-600",
      };
    case "complained":
      return {
        icon: AlertTriangle,
        iconClassName: "text-orange-700",
        iconWrapClassName: "border-orange-200 bg-orange-50",
        valueClassName: "text-xl text-orange-600",
      };
    case "queued":
    case "sent":
    case "delayed":
    default:
      return {
        icon: Clock3,
        iconClassName: "text-amber-700",
        iconWrapClassName: "border-amber-200 bg-amber-50",
        valueClassName: "text-xl text-amber-600",
      };
  }
}

function getLatestActivityPresentation(event: string) {
  switch (event) {
    case "opened":
    case "open":
      return {
        icon: Eye,
        iconClassName: "text-sky-700",
        iconWrapClassName: "border-sky-200 bg-sky-50",
        valueClassName: "text-xl text-sky-900",
      };
    case "clicked":
      return {
        icon: MousePointerClick,
        iconClassName: "text-indigo-700",
        iconWrapClassName: "border-indigo-200 bg-indigo-50",
        valueClassName: "text-xl text-indigo-900",
      };
    case "delivered":
    case "sent":
      return {
        icon: Mail,
        iconClassName: "text-emerald-700",
        iconWrapClassName: "border-emerald-200 bg-emerald-50",
        valueClassName: "text-xl text-emerald-900",
      };
    case "bounced":
    case "bounce":
    case "failed":
      return {
        icon: XCircle,
        iconClassName: "text-red-700",
        iconWrapClassName: "border-red-200 bg-red-50",
        valueClassName: "text-xl text-red-900",
      };
    case "complained":
    case "complaint":
      return {
        icon: AlertTriangle,
        iconClassName: "text-orange-700",
        iconWrapClassName: "border-orange-200 bg-orange-50",
        valueClassName: "text-xl text-orange-900",
      };
    default:
      return {
        icon: Mail,
        iconClassName: "text-brand-navy",
        iconWrapClassName: "border-brand-navy/10 bg-brand-navy/5",
        valueClassName: "text-xl text-foreground",
      };
  }
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
  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [previewFrameHeight, setPreviewFrameHeight] = useState(720);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
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
  const campaignAnalyticsPath = campaignId
    ? `/crm/campaigns/${campaignId}/analytics`
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
  const previewHtml = payloadHtml || campaign?.content || "";
  const hasTemplateTokens = useMemo(
    () => /\{\{[^}]+\}\}/.test(previewHtml),
    [previewHtml],
  );

  const syncPreviewFrameHeight = useCallback(() => {
    const iframe = previewFrameRef.current;
    if (!iframe) return;

    try {
      const documentElement = iframe.contentDocument?.documentElement;
      const body = iframe.contentDocument?.body;
      const nextHeight = Math.max(
        documentElement?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
        720,
      );

      if (nextHeight > 0) {
        setPreviewFrameHeight(nextHeight);
      }
    } catch (error) {
      console.error("Unable to measure preview iframe height", error);
      setPreviewFrameHeight(720);
    }
  }, []);

  useEffect(() => {
    setIsPreviewExpanded(false);
    setPreviewFrameHeight(720);
  }, [previewHtml]);

  useEffect(() => {
    if (!previewHtml) return;

    const timeouts = [
      window.setTimeout(syncPreviewFrameHeight, 0),
      window.setTimeout(syncPreviewFrameHeight, 250),
      window.setTimeout(syncPreviewFrameHeight, 1000),
    ];

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [previewHtml, syncPreviewFrameHeight]);

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

  const headerActionSections = useMemo(() => {
    const sections = [] as Array<{
      label: string;
      items: Array<{
        label: string;
        description?: string;
        icon?: typeof ExternalLink;
        disabled?: boolean;
        onSelect?: () => void;
      }>;
    }>;

    if (liveRecipient?.customer_id) {
      sections.push({
        label: "Navigate",
        items: [
          {
            label: "View Customer",
            description: "Open this recipient's linked customer profile.",
            icon: ExternalLink,
            onSelect: () => {
              navigate(`/crm/customers/${liveRecipient.customer_id}`);
            },
          },
        ],
      });
    }

    sections.push({
      label: "Data",
      items: [
        {
          label: "Refresh Data",
          description: isFetching
            ? "Reloading the latest recipient activity."
            : "Reload the latest recipient events and delivery data.",
          icon: RefreshCw,
          disabled: isFetching,
          onSelect: () => {
            void handleRefresh();
          },
        },
        {
          label: "Copy Link",
          description: "Copy the current recipient detail URL.",
          icon: Copy,
          onSelect: () => {
            void handleCopyLink();
          },
        },
      ],
    });

    const advancedItems: Array<{
      label: string;
      description?: string;
      icon?: typeof ExternalLink;
      disabled?: boolean;
      onSelect?: () => void;
    }> = [];

    if (liveRecipient?.can_retry) {
      advancedItems.push({
        label: "Retry Send",
        description: "Open the retry confirmation flow for this recipient.",
        icon: RefreshCw,
        onSelect: () => {
          setIsRetryDialogOpen(true);
        },
      });
    }

    advancedItems.push({
      label: "Export Markdown",
      description:
        "Download a markdown snapshot of this recipient detail view.",
      icon: Download,
      onSelect: handleMarkdownExport,
    });

    sections.push({
      label: "Advanced",
      items: advancedItems,
    });

    return sections;
  }, [
    handleCopyLink,
    handleMarkdownExport,
    handleRefresh,
    isFetching,
    liveRecipient?.can_retry,
    liveRecipient?.customer_id,
    liveRecipient?.resend_id,
    navigate,
  ]);

  const deliveryStatusTimestamp = useMemo(() => {
    if (!liveRecipient) return null;

    const eventTypes =
      liveRecipient.delivery_status === "delivered"
        ? ["delivered"]
        : liveRecipient.delivery_status === "bounced"
          ? ["bounced", "bounce"]
          : liveRecipient.delivery_status === "failed"
            ? ["failed", "bounced", "bounce"]
            : liveRecipient.delivery_status === "complained"
              ? ["complained", "complaint"]
              : liveRecipient.delivery_status === "queued"
                ? ["queued"]
                : liveRecipient.delivery_status === "sent"
                  ? ["sent", "attempted"]
                  : liveRecipient.delivery_status === "delayed"
                    ? ["delayed", "queued", "sent", "attempted"]
                    : [];

    const matchingEvent = [...timeline]
      .reverse()
      .find((entry) => eventTypes.includes(entry.event_type));

    return (
      matchingEvent?.event_at ||
      liveRecipient.last_attempt_at ||
      liveRecipient.sent_at ||
      liveRecipient.latest_event_at ||
      campaign?.sent_at ||
      campaign?.scheduled_at ||
      campaign?.created_at ||
      null
    );
  }, [
    campaign?.created_at,
    campaign?.scheduled_at,
    campaign?.sent_at,
    liveRecipient,
    timeline,
  ]);

  const deliveryStatusCard = useMemo(
    () =>
      getDeliveryStatusPresentation(
        liveRecipient?.delivery_status ?? "unknown",
      ),
    [liveRecipient?.delivery_status],
  );

  const latestActivityCard = useMemo(
    () =>
      getLatestActivityPresentation(liveRecipient?.latest_event ?? "unknown"),
    [liveRecipient?.latest_event],
  );

  const deliveredTimelineEventAt = useMemo(
    () =>
      [...liveTimeline]
        .reverse()
        .find((entry) => entry.event_type === "delivered")?.event_at ?? null,
    [liveTimeline],
  );

  const latestClickedUrl = useMemo(
    () =>
      activityLog
        .slice()
        .reverse()
        .find((entry) => entry.link_url)?.link_url ?? null,
    [activityLog],
  );

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
        window.clearTimeout(highlightTimersRef.current[timelineKey]);
        highlightTimersRef.current[timelineKey] = window.setTimeout(() => {
          setHighlightedTimelineKeys((current) => {
            const next = { ...current };
            delete next[timelineKey];
            return next;
          });
          delete highlightTimersRef.current[timelineKey];
        }, 700);
      }
    },
    [],
  );

  useCampaignEventRealtime({
    campaignId,
    tenantId: tenant?.id,
    recipientEmail: liveRecipient?.customer_email,
    enabled: Boolean(campaignId && tenant?.id && liveRecipient?.customer_email),
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
      <div className="container mx-auto px-6 pb-8 pt-6">
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
                <Link to={campaignAnalyticsPath}>{campaign.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={recipientsPath}>Recipients</Link>
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

        <div className="mt-4 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1
                  className="text-2xl font-bold tracking-tight text-foreground"
                  ref={headingRef}
                  tabIndex={-1}
                >
                  {liveRecipient.customer_name || liveRecipient.customer_email}
                </h1>
                <Badge variant="outline">
                  {getDeliveryLabel(liveRecipient.delivery_status)}
                </Badge>
                <Badge
                  className={getEventBadgeClass(liveRecipient.latest_event)}
                >
                  {getEventLabel(liveRecipient.latest_event)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Campaign:</span>{" "}
                  {campaign.name}
                </span>
                <span className="text-border">&middot;</span>
                <span>
                  <span className="font-medium text-foreground">Email:</span>{" "}
                  {liveRecipient.customer_email}
                </span>
                <span className="text-border">&middot;</span>
                <span>
                  <span className="font-medium text-foreground">Sent:</span>{" "}
                  {formatExactTimestamp(
                    campaign.sent_at ||
                      campaign.scheduled_at ||
                      campaign.created_at,
                    campaign.tenant_timezone,
                  )}
                </span>
                {navigation ? (
                  <>
                    <span className="text-border">&middot;</span>
                    <span>
                      <span className="font-medium text-foreground">
                        Position:
                      </span>{" "}
                      {navigation.position} of {navigation.total_filtered_count}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              <ActionDropdown
                label="Actions"
                align="end"
                sections={headerActionSections}
                triggerClassName="min-w-[9rem] justify-between"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <CRMMetricCard
            label="Delivery Status"
            value={getDeliveryLabel(liveRecipient.delivery_status)}
            subtitle={formatRelativeTimestamp(deliveryStatusTimestamp)}
            icon={deliveryStatusCard.icon}
            iconClassName={deliveryStatusCard.iconClassName}
            iconWrapClassName={deliveryStatusCard.iconWrapClassName}
            appearance="flat"
            valueClassName={deliveryStatusCard.valueClassName}
          />
          <CRMMetricCard
            label="Latest Activity"
            value={getEventLabel(liveRecipient.latest_event)}
            subtitle={formatRelativeTimestamp(liveRecipient.latest_event_at)}
            icon={latestActivityCard.icon}
            iconClassName={latestActivityCard.iconClassName}
            iconWrapClassName={latestActivityCard.iconWrapClassName}
            appearance="flat"
            valueClassName={latestActivityCard.valueClassName}
          />
          <CRMMetricCard
            label="Opens"
            value={String(insights?.open_count ?? 0)}
            subtitle={
              insights?.first_open_at
                ? `First open: ${formatRelativeTimestamp(insights.first_open_at)}`
                : "No opens recorded"
            }
            icon={Eye}
            iconClassName="text-sky-700"
            iconWrapClassName="border-sky-200 bg-sky-50"
            appearance="flat"
            valueClassName={
              (insights?.open_count ?? 0) > 0
                ? undefined
                : "text-3xl text-slate-400"
            }
            subtitleClassName={
              (insights?.open_count ?? 0) > 0 ? undefined : "text-slate-400"
            }
          />
          <CRMMetricCard
            label="Clicks"
            value={String(insights?.click_count ?? 0)}
            subtitle={
              insights?.first_click_at
                ? `First click: ${formatRelativeTimestamp(insights.first_click_at)}`
                : "No clicks recorded"
            }
            icon={MousePointerClick}
            iconClassName="text-indigo-700"
            iconWrapClassName="border-indigo-200 bg-indigo-50"
            appearance="flat"
            valueClassName={
              (insights?.click_count ?? 0) > 0
                ? undefined
                : "text-3xl text-slate-400"
            }
            subtitleClassName={
              (insights?.click_count ?? 0) > 0 ? undefined : "text-slate-400"
            }
          />
        </div>

        {liveRecipient.has_hard_bounce ? (
          <Alert className="mt-6 border-amber-300 bg-amber-50 text-amber-950">
            <AlertDescription>
              This address has a hard-bounce signal.
              {liveRecipient.hard_bounce_reason
                ? ` ${liveRecipient.hard_bounce_reason}`
                : " Retry carefully because mailbox issues may be permanent."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
          <Card className="min-h-[34rem] rounded-2xl border border-border/70 bg-white shadow-sm">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Clock3 className="h-4.5 w-4.5 text-brand-teal" />
                Delivery Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                  No lifecycle events have been recorded for this recipient yet.
                </div>
              ) : (
                <div className="space-y-1">
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
                          className={cn(
                            "flex gap-4 rounded-xl px-2 py-2 transition-colors duration-700",
                            isHighlighted &&
                              "bg-emerald-50/70 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
                            timelineAnimation,
                          )}
                        >
                          <div className="relative flex w-6 shrink-0 justify-center">
                            <span
                              className={cn(
                                "relative top-2 inline-block h-3 w-3 rounded-full ring-4",
                                getTimelineNodeClass(entry.event_type),
                              )}
                            />
                            {index < timeline.length - 1 ? (
                              <span className="absolute left-1/2 top-5 bottom-[-1.5rem] w-px -translate-x-1/2 bg-gray-200" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pb-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-foreground">
                                {entry.label}
                              </div>
                              <Badge
                                className={cn(
                                  "border text-[11px] font-medium",
                                  getTimelineBadgeClass(entry.event_type),
                                )}
                              >
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
                                <MousePointer className="mt-0.5 h-4 w-4 text-brand-teal" />
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

          <div className="space-y-5">
            <Card className="rounded-2xl border border-border/70 bg-white shadow-sm">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Send className="h-4.5 w-4.5 text-brand-teal" />
                  Message Routing
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="From"
                    value={
                      payloadFrom ||
                      `${campaign.from_name || "Unknown sender"}${campaign.from_email ? ` <${campaign.from_email}>` : ""}`
                    }
                    truncate
                  />
                  <DetailField
                    label="Reply-To"
                    value={formatDisplayValue(
                      payloadReplyTo || campaign.reply_to,
                    )}
                    truncate
                    muted={!(payloadReplyTo || campaign.reply_to)}
                  />
                  <DetailField
                    label="To"
                    value={formatDisplayValue(payloadTo)}
                    truncate
                  />
                  <DetailField
                    label="Delivery Status"
                    value={
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${getDeliveryDotClass(liveRecipient.delivery_status)}`}
                        />
                        {getDeliveryLabel(liveRecipient.delivery_status)}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/70 bg-white shadow-sm">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Mail className="h-4.5 w-4.5 text-brand-teal" />
                  Delivery Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="Delivery Timestamp"
                    value={formatTimestampDisplay(
                      deliveredTimelineEventAt,
                      campaign.tenant_timezone,
                    )}
                    muted={!deliveredTimelineEventAt}
                  />
                  <DetailField
                    label="Time to Deliver"
                    value={formatDurationDisplay(
                      liveRecipient.sent_at,
                      deliveredTimelineEventAt,
                    )}
                    muted={!(liveRecipient.sent_at && deliveredTimelineEventAt)}
                  />
                  <DetailField
                    label="Bounce Reason"
                    value={formatDisplayValue(liveRecipient.error_message)}
                    muted={!liveRecipient.error_message}
                  />
                  <DetailField
                    label="Link Click Detail"
                    value={formatDisplayValue(latestClickedUrl)}
                    muted={!latestClickedUrl}
                    truncate
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/70 bg-white shadow-sm">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <User className="h-4.5 w-4.5 text-brand-teal" />
                  Recipient Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label="First Open"
                    value={formatTimestampDisplay(
                      insights?.first_open_at ?? null,
                      campaign.tenant_timezone,
                    )}
                    muted={!insights?.first_open_at}
                  />
                  <DetailField
                    label="First Click"
                    value={formatTimestampDisplay(
                      insights?.first_click_at ?? null,
                      campaign.tenant_timezone,
                    )}
                    muted={!insights?.first_click_at}
                  />
                  <DetailField
                    label="Lifetime Value"
                    value={formatCurrencyDisplay(liveRecipient.lifetime_value)}
                    muted={
                      liveRecipient.lifetime_value === null ||
                      liveRecipient.lifetime_value === 0
                    }
                  />
                  <DetailField
                    label="Total Spent"
                    value={formatCurrencyDisplay(liveRecipient.total_spent)}
                    muted={
                      liveRecipient.total_spent === null ||
                      liveRecipient.total_spent === 0
                    }
                  />
                  <DetailField
                    label="Time to Open"
                    value={formatDurationDisplay(
                      deliveredTimelineEventAt ?? liveRecipient.sent_at,
                      insights?.first_open_at ?? null,
                    )}
                    muted={
                      !(deliveredTimelineEventAt ?? liveRecipient.sent_at) ||
                      !insights?.first_open_at
                    }
                  />
                  <DetailField
                    label="Time to Click"
                    value={formatDurationDisplay(
                      deliveredTimelineEventAt ?? liveRecipient.sent_at,
                      insights?.first_click_at ?? null,
                    )}
                    muted={
                      !(deliveredTimelineEventAt ?? liveRecipient.sent_at) ||
                      !insights?.first_click_at
                    }
                  />
                </div>
                {liveRecipient.error_message ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Latest error
                    </div>
                    <div className="mt-2">{liveRecipient.error_message}</div>
                  </div>
                ) : null}
                {liveRecipient.retry_status ? (
                  <div className="rounded-xl border border-border/70 bg-slate-50/70 p-3.5 text-sm text-foreground">
                    Latest retry status: {liveRecipient.retry_status}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <TooltipProvider>
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border/70 px-1 pt-5">
            {navigation?.previous_label ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 min-w-[8.5rem] justify-start rounded-xl px-4 hover:border-brand-teal/30 hover:bg-brand-teal/5 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                      onClick={() =>
                        navigate(
                          buildRecipientPath(
                            navigation.previous_recipient_id ?? null,
                          ),
                        )
                      }
                      disabled={!navigation?.previous_recipient_id}
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {navigation.previous_label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[8.5rem] justify-start rounded-xl px-4"
                  disabled
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
              </span>
            )}

            <div className="text-sm font-medium text-muted-foreground">
              {navigation
                ? `${navigation.position} of ${navigation.total_filtered_count}`
                : "—"}
            </div>

            {navigation?.next_label ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 min-w-[8.5rem] justify-end rounded-xl px-4 hover:border-brand-teal/30 hover:bg-brand-teal/5 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                      onClick={() =>
                        navigate(
                          buildRecipientPath(
                            navigation.next_recipient_id ?? null,
                          ),
                        )
                      }
                      disabled={!navigation?.next_recipient_id}
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {navigation.next_label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[8.5rem] justify-end rounded-xl px-4"
                  disabled
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </span>
            )}
          </div>
        </TooltipProvider>

        <Card className="mt-6 rounded-2xl border border-border/70 bg-white shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="h-4.5 w-4.5 text-brand-teal" />
              Email Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-xl border border-border/70 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Campaign content
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">
                {previewSubject}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-slate-50/70 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
              <div>
                Showing campaign template. Personalized content may differ per
                recipient.
                {hasTemplateTokens
                  ? " Some template variables appear unresolved in this preview."
                  : ""}
              </div>
            </div>

            {previewHtml ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-border/70 bg-white">
                  <div
                    className="overflow-hidden transition-[max-height] duration-300 ease-out"
                    style={{
                      maxHeight: isPreviewExpanded
                        ? `${Math.max(previewFrameHeight, 720)}px`
                        : "460px",
                    }}
                  >
                    <iframe
                      ref={previewFrameRef}
                      className="w-full border-0 bg-white"
                      style={{
                        height: `${Math.max(previewFrameHeight, 720)}px`,
                      }}
                      srcDoc={previewHtml}
                      title="Campaign email preview"
                      sandbox="allow-same-origin"
                      onLoad={syncPreviewFrameHeight}
                    />
                  </div>
                  {!isPreviewExpanded ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/95 to-white/0" />
                  ) : null}
                </div>

                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-[10rem] rounded-xl px-4 hover:border-brand-teal/30 hover:bg-brand-teal/5 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                    onClick={() => setIsPreviewExpanded((current) => !current)}
                  >
                    {isPreviewExpanded ? "Collapse" : "Show full email"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center text-sm text-muted-foreground">
                No HTML preview is available for this recipient yet.
              </div>
            )}
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
