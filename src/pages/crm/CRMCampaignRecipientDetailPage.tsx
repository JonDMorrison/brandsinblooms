import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Mail,
  RefreshCw,
  ShieldBan,
  User,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { PageContainer } from "@/components/joy/PageContainer";
import { useCampaignEventRealtime } from "@/hooks/useCampaignEventRealtime";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
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

type DetailTab = "timeline" | "content" | "diagnostics";

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
  error_message: string | null;
  has_hard_bounce?: boolean;
  hard_bounce_reason?: string | null;
  retry_count?: number;
  retry_status?: string | null;
  can_retry?: boolean;
  has_delivered: boolean;
  has_opened: boolean;
  has_clicked: boolean;
  has_bounced: boolean;
  has_complained: boolean;
  has_unsubscribed: boolean;
  total_spent: number | null;
  lifetime_value: number | null;
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
    event_data?: Record<string, unknown> | null;
  } | null;
}

interface ActivityLogEntry {
  id: string;
  event_type: string;
  event_at: string | null;
  provider_message_id: string | null;
  webhook_delivery_id: string | null;
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

interface CustomerProfileCard {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  lifecycle_stage: string | null;
  lifetime_value: number | null;
  total_spent: number | null;
  order_history: unknown;
}

function formatExactTimestamp(
  timestamp: string | null,
  timezone?: string | null,
) {
  if (!timestamp) return "-";
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

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDurationBetween(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return "-";
  return formatDistanceStrict(new Date(startAt), new Date(endAt));
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
    case "queued":
      return "Queued";
    case "sent":
      return "Sent";
    default:
      return status || "Unknown";
  }
}

function getEventLabel(event: string) {
  switch (event) {
    case "open":
    case "opened":
      return "Opened";
    case "click":
    case "clicked":
      return "Clicked";
    case "bounce":
    case "bounced":
      return "Bounced";
    case "complaint":
    case "complained":
      return "Complaint";
    case "delivered":
      return "Delivered";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "queued":
      return "Queued";
    case "attempted":
      return "Attempted";
    case "unsubscribed":
      return "Unsubscribed";
    default:
      return event.replace(/[_-]+/g, " ");
  }
}

function getStatusTone(
  status: string,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "delivered":
    case "opened":
    case "clicked":
      return "success";
    case "bounced":
      return "warning";
    case "failed":
    case "complained":
      return "danger";
    case "sent":
      return "info";
    default:
      return "neutral";
  }
}

function timelineTone(entryType: string): {
  color: string;
  borderColor: string;
} {
  switch (entryType) {
    case "delivered":
    case "opened":
    case "clicked":
      return { color: "success.500", borderColor: "success.200" };
    case "bounced":
    case "failed":
    case "complained":
      return { color: "danger.500", borderColor: "danger.200" };
    case "sent":
    case "attempted":
      return { color: "primary.500", borderColor: "primary.200" };
    default:
      return { color: "neutral.400", borderColor: "neutral.200" };
  }
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
    return rightTime - leftTime;
  });
}

function metricValue(label: string, value: string) {
  return (
    <Stack spacing={0.35}>
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
      <Typography level="body-sm" fontWeight="lg">
        {value}
      </Typography>
    </Stack>
  );
}

function normalizeCampaignNameForDisplay(name: string) {
  return name.replace(/(?:\s*\(Resend\))+$/i, " (Resend)").trim();
}

function readPayloadString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readPayloadNumber(
  payload: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = payload[key];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readEventDataString(
  eventData: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!eventData) return null;
  for (const key of keys) {
    const value = eventData[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getEventSourceLabel(entry: ActivityLogEntry) {
  if (entry.webhook_delivery_id) return "webhook";
  if (entry.provider_message_id) return "provider";
  return "system";
}

function ScrollableHtmlPreview({
  html,
  minHeight = 720,
}: {
  html: string;
  minHeight?: number;
}) {
  return (
    <Box
      sx={{
        maxHeight: 500,
        overflow: "auto",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "md",
        backgroundColor: "background.surface",
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "neutral.300",
          borderRadius: 3,
        },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 720, mx: "auto" }}>
        <iframe
          title="Campaign email preview"
          srcDoc={html}
          style={{
            width: "100%",
            height: minHeight,
            border: 0,
            display: "block",
            background: "white",
          }}
        />
      </Box>
    </Box>
  );
}

function TimelineEventItem({
  event,
  isLast,
  timezone,
  highlighted,
  bounceReason,
}: {
  event: TimelineEntry;
  isLast: boolean;
  timezone: string | null | undefined;
  highlighted: boolean;
  bounceReason: string | null | undefined;
}) {
  const tone = timelineTone(event.event_type);

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ opacity: event.event_at ? 1 : 0.65 }}
    >
      <Stack alignItems="center" sx={{ width: 24 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: tone.color,
            border: "2px solid",
            borderColor: tone.borderColor,
            flexShrink: 0,
            mt: 0.6,
            boxShadow: highlighted
              ? "0 0 0 6px rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
              : "none",
            transition: "box-shadow 240ms ease",
          }}
        />
        {!isLast ? (
          <Box
            sx={{
              width: 1,
              flex: 1,
              backgroundColor: "neutral.200",
              mt: 0.5,
              minHeight: 32,
            }}
          />
        ) : null}
      </Stack>

      <Stack spacing={0.25} sx={{ pb: isLast ? 0 : 3, minWidth: 0 }}>
        <Typography level="body-sm" fontWeight="md">
          {event.event_type === "clicked" && event.metadata?.link_url
            ? "Clicked"
            : event.label}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {formatExactTimestamp(event.event_at, timezone)}
          {event.event_at
            ? ` · ${formatRelativeTimestamp(event.event_at)}`
            : ""}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.600", mt: 0.5 }}>
          {event.event_type === "queued"
            ? "Message queued for delivery"
            : event.event_type === "sent" || event.event_type === "attempted"
              ? "Email sent via provider"
              : event.event_type === "delivered"
                ? "Delivered to inbox"
                : event.event_type === "opened"
                  ? event.metadata?.is_mpp_guess
                    ? "Opened. Privacy-proxy signal detected."
                    : "Opened"
                  : event.event_type === "clicked"
                    ? `Clicked: ${event.metadata?.link_url || "URL unavailable"}`
                    : event.event_type === "bounced"
                      ? `Hard bounce: ${bounceReason || "Mailbox issue"}`
                      : getEventLabel(event.event_type)}
        </Typography>
      </Stack>
    </Stack>
  );
}

function DiagnosticRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ sm: "flex-start" }}
      spacing={0.75}
    >
      <Typography
        level="body-xs"
        sx={{ color: "neutral.500", minWidth: { sm: 160 }, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography
        level="body-sm"
        sx={{
          textAlign: { sm: "right" },
          wordBreak: "break-all",
          fontFamily: mono
            ? 'var(--joy-fontFamily-code, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)'
            : undefined,
          fontSize: mono ? "0.75rem" : undefined,
        }}
      >
        {value || "—"}
      </Typography>
    </Stack>
  );
}

function DiagnosticsPanel({
  recipient,
  activityLog,
  campaign,
  payload,
  providerMessageId,
  messageId,
  retryMessageId,
  bounceType,
  bounceCategory,
  bounceReason,
  retryCount,
  retryStatus,
  insights,
}: {
  recipient: RecipientDetail | null;
  activityLog: ActivityLogEntry[];
  campaign: CampaignDetail | null;
  payload: Record<string, unknown>;
  providerMessageId: string | null;
  messageId: string | null;
  retryMessageId: string | null;
  bounceType: string | null;
  bounceCategory: string | null;
  bounceReason: string | null;
  retryCount: number;
  retryStatus: string | null;
  insights: Insights | null;
}) {
  const diagnosticsPrimary = activityLog[0] ?? null;

  return (
    <Stack spacing={3}>
      <JoyCard variant="outlined">
        <JoyCardContent sx={{ p: 2.5 }}>
          <Typography
            level="title-xs"
            fontWeight="lg"
            sx={{
              mb: 1.5,
              color: "neutral.500",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Message Identity
          </Typography>
          <Stack spacing={1}>
            <DiagnosticRow
              label="Message ID"
              value={
                messageId || readPayloadString(payload, ["email_message_id"])
              }
              mono
            />
            <DiagnosticRow
              label="Provider Message ID"
              value={providerMessageId}
              mono
            />
            <DiagnosticRow
              label="Webhook Delivery ID"
              value={diagnosticsPrimary?.webhook_delivery_id}
              mono
            />
          </Stack>
        </JoyCardContent>
      </JoyCard>

      <JoyCard variant="outlined">
        <JoyCardContent sx={{ p: 2.5 }}>
          <Typography
            level="title-xs"
            fontWeight="lg"
            sx={{
              mb: 1.5,
              color: "neutral.500",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Client Information
          </Typography>
          <Stack spacing={1}>
            <DiagnosticRow
              label="User Agent"
              value={diagnosticsPrimary?.user_agent}
              mono
            />
            <DiagnosticRow
              label="IP Address"
              value={diagnosticsPrimary?.ip_address}
            />
            <DiagnosticRow
              label="Mail Privacy Protection"
              value={
                insights?.has_mpp_open ? (
                  <JoyChip variant="soft" color="warning" size="sm">
                    Yes — Apple MPP
                  </JoyChip>
                ) : (
                  <JoyChip variant="soft" color="neutral" size="sm">
                    No
                  </JoyChip>
                )
              }
            />
          </Stack>
        </JoyCardContent>
      </JoyCard>

      {recipient?.has_bounced ? (
        <JoyCard variant="outlined">
          <JoyCardContent sx={{ p: 2.5 }}>
            <Typography
              level="title-xs"
              fontWeight="lg"
              sx={{
                mb: 1.5,
                color: "neutral.500",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Bounce Details
            </Typography>
            <Stack spacing={1}>
              <DiagnosticRow label="Bounce Type" value={bounceType} />
              <DiagnosticRow label="Bounce Category" value={bounceCategory} />
              <DiagnosticRow label="Bounce Reason" value={bounceReason} mono />
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ) : null}

      {retryCount > 0 || retryStatus || retryMessageId ? (
        <JoyCard variant="outlined">
          <JoyCardContent sx={{ p: 2.5 }}>
            <Typography
              level="title-xs"
              fontWeight="lg"
              sx={{
                mb: 1.5,
                color: "neutral.500",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Retry Information
            </Typography>
            <Stack spacing={1}>
              <DiagnosticRow label="Retry Count" value={`${retryCount} of 1`} />
              <DiagnosticRow label="Retry Status" value={retryStatus} />
              <DiagnosticRow
                label="Retry Message ID"
                value={retryMessageId}
                mono
              />
            </Stack>
          </JoyCardContent>
        </JoyCard>
      ) : null}

      <JoyCard variant="outlined">
        <JoyCardContent sx={{ p: 2.5 }}>
          <Typography
            level="title-xs"
            fontWeight="lg"
            sx={{
              mb: 1.5,
              color: "neutral.500",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Raw Event Log
          </Typography>
          <JoyTable size="sm" variant="plain" borderAxis="none">
            <JoyTableHead>
              <JoyTableRow>
                <JoyTableHeaderCell>Event</JoyTableHeaderCell>
                <JoyTableHeaderCell>Timestamp</JoyTableHeaderCell>
                <JoyTableHeaderCell>Source</JoyTableHeaderCell>
              </JoyTableRow>
            </JoyTableHead>
            <JoyTableBody>
              {activityLog.length === 0 ? (
                <JoyTableRow>
                  <JoyTableCell colSpan={3}>
                    <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                      No activity log entries recorded.
                    </Typography>
                  </JoyTableCell>
                </JoyTableRow>
              ) : (
                activityLog.map((entry) => (
                  <JoyTableRow key={entry.id}>
                    <JoyTableCell>
                      <JoyChip
                        size="sm"
                        variant="soft"
                        color={
                          getStatusTone(entry.event_type) === "info"
                            ? "primary"
                            : getStatusTone(entry.event_type) === "danger"
                              ? "danger"
                              : getStatusTone(entry.event_type) === "warning"
                                ? "warning"
                                : getStatusTone(entry.event_type) === "success"
                                  ? "success"
                                  : "neutral"
                        }
                      >
                        {getEventLabel(entry.event_type)}
                      </JoyChip>
                    </JoyTableCell>
                    <JoyTableCell>
                      <Typography level="body-xs">
                        {formatExactTimestamp(
                          entry.event_at,
                          campaign?.tenant_timezone,
                        )}
                      </Typography>
                    </JoyTableCell>
                    <JoyTableCell>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {getEventSourceLabel(entry)}
                      </Typography>
                    </JoyTableCell>
                  </JoyTableRow>
                ))
              )}
            </JoyTableBody>
          </JoyTable>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
}

export default function CRMCampaignRecipientDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { campaignId, recipientId } = useParams<{
    campaignId: string;
    recipientId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterState = buildRecipientFilterState(searchParams);
  const [isRetryDialogOpen, setIsRetryDialogOpen] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isSuppressing, setIsSuppressing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DetailTab>(() => {
    const value = searchParams.get("detail_tab");
    return value === "content" || value === "diagnostics" ? value : "timeline";
  });
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const highlightTimersRef = React.useRef<Record<string, number>>({});
  const [highlightedTimelineKeys, setHighlightedTimelineKeys] = React.useState<
    Record<string, boolean>
  >({});
  const searchSuffix = location.search || "";

  const recipientsPath = campaignId
    ? `/crm/campaigns/${campaignId}/recipients${searchSuffix}`
    : "/crm/campaigns";
  const buildRecipientPath = React.useCallback(
    (id: string | null) =>
      id
        ? `/crm/campaigns/${campaignId}/recipients/${id}${searchSuffix}`
        : recipientsPath,
    [campaignId, recipientsPath, searchSuffix],
  );

  React.useEffect(() => {
    const value = searchParams.get("detail_tab");
    setActiveTab(
      value === "content" || value === "diagnostics" ? value : "timeline",
    );
  }, [searchParams]);

  React.useEffect(() => {
    return () => {
      Object.values(highlightTimersRef.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, []);

  const detailQuery = useQuery({
    queryKey: [
      "campaign-recipient-detail",
      campaignId,
      recipientId,
      filterState.searchQuery,
      filterState.compositeFilter,
      filterState.selectedEvents,
      filterState.timeRange,
      filterState.deliveryFilter,
      searchParams.get("sort") ?? "event_time",
      searchParams.get("direction") ?? "desc",
    ],
    enabled: Boolean(campaignId && recipientId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_campaign_recipient_detail" as any,
        {
          p_campaign_id: campaignId,
          p_recipient_id: recipientId,
          p_search: filterState.searchQuery || null,
          p_event_filter: filterState.compositeFilter,
          p_sort_column: searchParams.get("sort") ?? "event_time",
          p_sort_direction: searchParams.get("direction") ?? "desc",
          p_event_filters: filterState.selectedEvents.length
            ? filterState.selectedEvents
            : null,
          p_time_range: filterState.timeRange,
          p_delivery_filter: filterState.deliveryFilter,
        } as any,
      );

      if (error) throw error;
      return (data ?? null) as CampaignRecipientDetailResponse | null;
    },
  });

  const [liveRecipient, setLiveRecipient] =
    React.useState<RecipientDetail | null>(null);
  const [liveInsights, setLiveInsights] = React.useState<Insights | null>(null);
  const [liveTimeline, setLiveTimeline] = React.useState<TimelineEntry[]>([]);
  const [liveActivityLog, setLiveActivityLog] = React.useState<
    ActivityLogEntry[]
  >([]);

  React.useEffect(() => {
    setLiveRecipient(detailQuery.data?.recipient ?? null);
    setLiveInsights(detailQuery.data?.insights ?? null);
    setLiveTimeline(detailQuery.data?.timeline ?? []);
    setLiveActivityLog(
      [...(detailQuery.data?.activity_log ?? [])].sort((left, right) => {
        const leftTime = left.event_at ? new Date(left.event_at).getTime() : 0;
        const rightTime = right.event_at
          ? new Date(right.event_at).getTime()
          : 0;
        return rightTime - leftTime;
      }),
    );
  }, [detailQuery.data]);

  const campaign = detailQuery.data?.campaign ?? null;
  const navigation = detailQuery.data?.navigation ?? null;
  const payload = React.useMemo(
    () => (liveRecipient?.payload ?? {}) as Record<string, unknown>,
    [liveRecipient?.payload],
  );

  const customerProfileQuery = useQuery({
    queryKey: [
      "campaign-recipient-customer-profile",
      liveRecipient?.customer_id,
    ],
    enabled: Boolean(liveRecipient?.customer_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_customers")
        .select(
          "id, first_name, last_name, email, lifecycle_stage, lifetime_value, total_spent, order_history",
        )
        .eq("id", liveRecipient?.customer_id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CustomerProfileCard | null;
    },
  });

  const previewSubject =
    typeof payload.subject === "string"
      ? payload.subject
      : campaign?.subject_line || "No subject line";
  const previewPreheader =
    typeof payload.preheader === "string" ? payload.preheader : null;
  const previewHtml =
    typeof payload.html === "string" ? payload.html : campaign?.content || "";
  const previewSource =
    typeof payload.html === "string"
      ? "snapshot"
      : campaign?.content
        ? "current_campaign"
        : "unavailable";
  const providerMessageId =
    liveRecipient?.resend_id ||
    readPayloadString(payload, ["provider_message_id", "resend_id", "id"]);
  const messageId = readPayloadString(payload, [
    "message_id",
    "email_message_id",
    "governance_message_id",
    "id",
  ]);
  const retryMessageId = readPayloadString(payload, [
    "retry_message_id",
    "retry_of_message_id",
  ]);
  const activityLog = liveActivityLog;
  const diagnosticsPrimary = activityLog[0] ?? null;
  const bounceEvent =
    activityLog.find((entry) => entry.event_type === "bounced") ?? null;
  const bounceType =
    readEventDataString(bounceEvent?.event_data, ["bounce_type", "type"]) ||
    (liveRecipient?.has_hard_bounce ? "hard" : null);
  const bounceCategory = readEventDataString(bounceEvent?.event_data, [
    "bounce_category",
    "category",
    "bounce_subtype",
  ]);
  const retryCount =
    liveRecipient?.retry_count ??
    readPayloadNumber(payload, ["retry_count", "retry_attempts"]) ??
    0;
  const retryStatus =
    liveRecipient?.retry_status ||
    readPayloadString(payload, ["retry_status", "retry_state"]);
  const firstDeliveredAt =
    liveTimeline.find((entry) => entry.event_type === "delivered")?.event_at ??
    null;
  const firstOpenAt = liveInsights?.first_open_at ?? null;
  const firstClickAt = liveInsights?.first_click_at ?? null;
  const bounceDetailText =
    liveRecipient?.hard_bounce_reason ||
    readEventDataString(bounceEvent?.event_data, [
      "bounce_message",
      "bounce_reason",
      "reason",
      "description",
    ]) ||
    (bounceEvent?.event_data
      ? JSON.stringify(bounceEvent.event_data, null, 2)
      : "-");

  const handleSetTab = React.useCallback(
    (nextTab: DetailTab) => {
      const next = new URLSearchParams(searchParams);
      next.set("detail_tab", nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [recipientId]);

  React.useEffect(() => {
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
      }
      if (event.key === "ArrowRight" && navigation?.next_recipient_id) {
        event.preventDefault();
        navigate(buildRecipientPath(navigation.next_recipient_id));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buildRecipientPath, navigate, navigation]);

  const handleRealtimeEvent = React.useCallback(
    (event: EmailTrackingEventRow, options: { animate: boolean }) => {
      const normalizedType = normalizeTrackingEventType(event.event_type);
      const eventAt = getTrackingEventTimestamp(event);
      const timelineEntry = createTimelineEntryFromEvent(event);
      const activityEntry = createActivityLogEntryFromEvent(event);
      const timelineKey = `${timelineEntry.event_type}-${timelineEntry.event_at}-${activityEntry.id}`;

      setLiveRecipient((current) => {
        if (!current) return current;
        const next = { ...current };
        next.latest_event = normalizedType;
        next.latest_event_at = eventAt;
        if (event.provider_message_id && !next.resend_id) {
          next.resend_id = event.provider_message_id;
        }
        if (normalizedType === "delivered") {
          next.has_delivered = true;
          next.delivery_status = "delivered";
        } else if (normalizedType === "opened") {
          next.has_opened = true;
        } else if (normalizedType === "clicked") {
          next.has_clicked = true;
        } else if (normalizedType === "bounced") {
          next.has_bounced = true;
          next.delivery_status = "bounced";
          next.error_message = extractBounceReason(event);
        } else if (normalizedType === "complained") {
          next.has_complained = true;
          next.delivery_status = "complained";
        } else if (normalizedType === "unsubscribed") {
          next.has_unsubscribed = true;
        }
        return next;
      });

      setLiveInsights((current) => {
        if (!current) return current;
        const next = { ...current };
        if (normalizedType === "opened") {
          next.opened = true;
          next.open_count += 1;
          next.first_open_at = next.first_open_at || eventAt;
          next.last_open_at = eventAt;
          next.has_mpp_open = next.has_mpp_open || event.is_mpp_guess;
        } else if (normalizedType === "clicked") {
          next.clicked = true;
          next.click_count += 1;
          next.first_click_at = next.first_click_at || eventAt;
          next.last_click_at = eventAt;
        } else if (normalizedType === "bounced") {
          next.bounced = true;
          next.bounce_count += 1;
        } else if (normalizedType === "complained") {
          next.complained = true;
          next.complaint_count += 1;
        } else if (normalizedType === "unsubscribed") {
          next.unsubscribed = true;
        }
        return next;
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
        }, 800);
      }
    },
    [],
  );

  const realtime = useCampaignEventRealtime({
    campaignId,
    tenantId: tenant?.id,
    recipientEmail: liveRecipient?.customer_email,
    providerMessageId,
    enabled: Boolean(campaignId && tenant?.id && liveRecipient?.customer_email),
    channelName: `campaign-recipient-detail-events-${campaignId}-${recipientId}`,
    onEvent: handleRealtimeEvent,
  });

  const handleRefresh = React.useCallback(async () => {
    await detailQuery.refetch();
  }, [detailQuery]);

  const handleMarkdownExport = React.useCallback(() => {
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
      "",
      "## Timeline",
      ...liveTimeline.map(
        (entry) =>
          `- ${entry.event_at ? formatExactTimestamp(entry.event_at, campaign.tenant_timezone) : "No timestamp"}: ${entry.label}`,
      ),
      "",
      "## Diagnostics",
      ...activityLog.map(
        (entry) =>
          `- ${entry.event_at ? formatExactTimestamp(entry.event_at, campaign.tenant_timezone) : "No timestamp"}: ${getEventLabel(entry.event_type)}${entry.link_url ? ` (${entry.link_url})` : ""}`,
      ),
    ].join("\n");

    const fileName = `${sanitizeFileNamePart(campaign.name)}-${sanitizeFileNamePart(liveRecipient.customer_email)}-${formatDateStamp()}.md`;
    downloadTextFile(markdown, fileName, "text/markdown;charset=utf-8");
    toast.success("Recipient markdown exported");
  }, [activityLog, campaign, liveRecipient, liveTimeline]);

  const handleCopyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildAbsoluteLocationPath(
          `${window.location.pathname}${window.location.search}`,
        ),
      );
      toast.success("Recipient link copied");
    } catch (error) {
      console.error("Unable to copy recipient link", error);
      toast.error("Unable to copy recipient link");
    }
  }, []);

  const handleRetryRecipient = React.useCallback(async () => {
    if (!campaignId || !recipientId) return;
    try {
      setIsRetrying(true);
      const result = await retryCampaignRecipientMessage(
        campaignId,
        recipientId,
      );
      if (result.blockedReason) {
        toast.error(
          result.blockedReason === "already_retried"
            ? "This recipient has already used its retry."
            : "Only failed or bounced recipients can be retried.",
        );
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
      await handleRefresh();
    } catch (error) {
      console.error("Failed to retry recipient", error);
      toast.error("Unable to queue a retry for this recipient");
    } finally {
      setIsRetrying(false);
    }
  }, [campaignId, handleRefresh, queryClient, recipientId]);

  const handleSuppressRecipient = React.useCallback(async () => {
    if (!tenant?.id || !liveRecipient) return;
    try {
      setIsSuppressing(true);
      const { data: existing, error: existingError } = await supabase
        .from("suppression_list")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("email", liveRecipient.customer_email)
        .eq("channel", "email")
        .is("lifted_at", null)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existing) {
        const { error } = await supabase.from("suppression_list").insert({
          tenant_id: tenant.id,
          email: liveRecipient.customer_email,
          suppression_type: "manual",
          channel: "email",
          reason: `Manual suppression from recipient detail (${campaign?.name || "campaign"})`,
          auto_suppressed: false,
          suppressed_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      toast.success(`${liveRecipient.customer_email} suppressed`);
    } catch (error) {
      console.error("Failed to suppress recipient email", error);
      toast.error("Unable to suppress recipient email");
    } finally {
      setIsSuppressing(false);
    }
  }, [campaign?.name, liveRecipient, tenant?.id]);

  if (!campaignId || !recipientId) return null;

  if (
    !detailQuery.isLoading &&
    (!detailQuery.data ||
      detailQuery.data.not_found ||
      !campaign ||
      !liveRecipient)
  ) {
    return (
      <PageContainer>
        <Sheet
          variant="outlined"
          sx={{ borderRadius: "lg", p: 6, textAlign: "center" }}
        >
          <Stack spacing={2} alignItems="center">
            <Avatar variant="soft" color="neutral">
              <Mail size={18} />
            </Avatar>
            <Typography level="title-lg">Recipient detail not found</Typography>
            <Typography level="body-sm" color="neutral">
              This recipient or campaign does not exist, or you do not have
              access.
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
    <PageContainer sx={{ maxWidth: "80rem", pb: 5 }}>
      <Stack spacing={2.5}>
        {detailQuery.isFetching || isRetrying || isSuppressing ? (
          <LinearProgress thickness={3} />
        ) : null}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography
            level="body-xs"
            component={Link}
            to="/crm/campaigns"
            sx={{
              color: "neutral.500",
              textDecoration: "none",
              "&:hover": { color: "neutral.700" },
            }}
          >
            Campaigns
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.400" }}>
            ›
          </Typography>
          <Typography
            level="body-xs"
            component={Link}
            to={
              campaign
                ? `/crm/campaigns/${campaign.id}/report`
                : "/crm/campaigns"
            }
            sx={{
              color: "neutral.500",
              textDecoration: "none",
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              "&:hover": { color: "neutral.700" },
            }}
          >
            {campaign ? (
              normalizeCampaignNameForDisplay(campaign.name)
            ) : (
              <Skeleton width={160} />
            )}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.400" }}>
            ›
          </Typography>
          <Typography
            level="body-xs"
            component={Link}
            to={recipientsPath}
            sx={{
              color: "neutral.500",
              textDecoration: "none",
              "&:hover": { color: "neutral.700" },
            }}
          >
            Recipients
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.400" }}>
            ›
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.700" }}>
            {liveRecipient?.customer_email || <Skeleton width={180} />}
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
        >
          <JoyButton
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<ChevronLeft size={14} />}
            disabled={!navigation?.previous_recipient_id}
            onClick={() =>
              navigation?.previous_recipient_id &&
              navigate(buildRecipientPath(navigation.previous_recipient_id))
            }
          >
            Previous
          </JoyButton>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            justifyContent={{ xs: "flex-start", md: "flex-end" }}
          >
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={handleCopyLink}
            >
              Copy Link
            </JoyButton>
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={handleMarkdownExport}
            >
              <Download size={16} />
              Export Markdown
            </JoyButton>
            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              endDecorator={<ChevronRight size={14} />}
              disabled={!navigation?.next_recipient_id}
              onClick={() =>
                navigation?.next_recipient_id &&
                navigate(buildRecipientPath(navigation.next_recipient_id))
              }
            >
              Next
            </JoyButton>
          </Stack>
        </Stack>

        <JoyCard variant="outlined">
          <JoyCardContent sx={{ p: 3 }}>
            <Stack
              direction={{ xs: "column", xl: "row" }}
              spacing={2.5}
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ minWidth: 0, flex: 1 }}
              >
                {detailQuery.isLoading ? (
                  <Skeleton variant="circular" width={56} height={56} />
                ) : (
                  <Avatar size="lg" variant="soft" color="neutral">
                    <User size={22} />
                  </Avatar>
                )}
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                  <Typography ref={headingRef} tabIndex={-1} level="title-lg">
                    {liveRecipient?.customer_name ||
                      liveRecipient?.customer_email || <Skeleton width={220} />}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    {liveRecipient?.customer_email || <Skeleton width={180} />}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {navigation
                      ? `Recipient ${navigation.position} of ${navigation.total_filtered_count} in the current filtered view`
                      : ""}
                  </Typography>
                </Stack>
              </Stack>

              <Stack
                spacing={1}
                alignItems={{ xs: "flex-start", xl: "center" }}
              >
                {detailQuery.isLoading ? (
                  <Skeleton width={140} height={34} />
                ) : (
                  <JoyStatusChip
                    status={getDeliveryLabel(
                      liveRecipient?.delivery_status ||
                        liveRecipient?.latest_event ||
                        "unknown",
                    )}
                    tone={getStatusTone(
                      liveRecipient?.delivery_status ||
                        liveRecipient?.latest_event ||
                        "unknown",
                    )}
                    size="lg"
                  />
                )}
                {liveRecipient?.has_hard_bounce ? (
                  <JoyChip variant="soft" color="warning" size="sm">
                    {liveRecipient.hard_bounce_reason || "Hard bounce"}
                  </JoyChip>
                ) : null}
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                useFlexGap
                flexWrap="wrap"
              >
                {metricValue(
                  "Time to deliver",
                  formatDurationBetween(
                    liveRecipient?.sent_at || null,
                    firstDeliveredAt,
                  ),
                )}
                {metricValue(
                  "Time to open",
                  formatDurationBetween(
                    firstDeliveredAt || liveRecipient?.sent_at || null,
                    firstOpenAt,
                  ),
                )}
                {metricValue(
                  "Time to click",
                  formatDurationBetween(
                    firstDeliveredAt || liveRecipient?.sent_at || null,
                    firstClickAt,
                  ),
                )}
              </Stack>

              <Stack
                direction={{ xs: "row", sm: "row" }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                justifyContent={{ xs: "flex-start", xl: "flex-end" }}
              >
                {liveRecipient?.can_retry ? (
                  <JoyButton
                    bloomVariant="secondary"
                    color="primary"
                    onClick={() => setIsRetryDialogOpen(true)}
                  >
                    <RefreshCw size={16} />
                    Retry
                  </JoyButton>
                ) : null}
                {liveRecipient?.customer_id ? (
                  <JoyButton
                    bloomVariant="ghost"
                    color="neutral"
                    component={Link}
                    to={`/crm/customers/${liveRecipient.customer_id}`}
                  >
                    <ExternalLink size={16} />
                    View Customer
                  </JoyButton>
                ) : null}
                <JoyButton
                  bloomVariant="ghost"
                  color="danger"
                  loading={isSuppressing}
                  onClick={() => void handleSuppressRecipient()}
                >
                  <ShieldBan size={16} />
                  Suppress
                </JoyButton>
                <IconButton
                  color="neutral"
                  variant="plain"
                  onClick={() => void handleRefresh()}
                >
                  <RefreshCw size={18} />
                </IconButton>
              </Stack>
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {realtime.bannerState === "paused" ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: "md", px: 2, py: 1.5 }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Typography level="body-sm">
                Live updates paused. Refresh to load the latest recipient
                activity.
              </Typography>
              <Stack direction="row" spacing={1}>
                <JoyButton
                  bloomVariant="secondary"
                  onClick={() => void handleRefresh()}
                >
                  Refresh
                </JoyButton>
                <JoyButton
                  bloomVariant="ghost"
                  color="neutral"
                  onClick={realtime.dismissBanner}
                >
                  Dismiss
                </JoyButton>
              </Stack>
            </Stack>
          </Sheet>
        ) : null}

        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <JoySelect
            value={activeTab}
            onValueChange={(value) =>
              handleSetTab((value || "timeline") as DetailTab)
            }
            options={[
              { value: "timeline", label: "Timeline" },
              { value: "content", label: "Content" },
              { value: "diagnostics", label: "Diagnostics" },
            ]}
          />
        </Box>

        <JoyTabs
          value={activeTab}
          onValueChange={(value) =>
            handleSetTab((value || "timeline") as DetailTab)
          }
        >
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <JoyTabsList>
              <JoyTabsTrigger value="timeline">Timeline</JoyTabsTrigger>
              <JoyTabsTrigger value="content">Content</JoyTabsTrigger>
              <JoyTabsTrigger value="diagnostics">Diagnostics</JoyTabsTrigger>
            </JoyTabsList>
          </Box>

          <JoyTabsContent value="timeline">
            <Stack spacing={2.5}>
              <JoyCard variant="outlined">
                <JoyCardHeader
                  title="Event Timeline"
                  description="Delivery and engagement events for this recipient."
                />
                <JoyCardContent>
                  <Stack spacing={2}>
                    {liveTimeline.length === 0 && detailQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <Stack key={index} direction="row" spacing={2}>
                          <Skeleton
                            variant="circular"
                            width={14}
                            height={14}
                            sx={{ mt: 0.6 }}
                          />
                          <Stack spacing={0.75} sx={{ flex: 1 }}>
                            <Skeleton width="24%" />
                            <Skeleton width="38%" />
                            <Skeleton width="56%" />
                          </Stack>
                        </Stack>
                      ))
                    ) : liveTimeline.length === 0 ? (
                      <Sheet
                        variant="soft"
                        color="neutral"
                        sx={{ borderRadius: "md", px: 2, py: 3 }}
                      >
                        <Typography level="body-sm" color="neutral">
                          No lifecycle events have been recorded for this
                          recipient yet.
                        </Typography>
                      </Sheet>
                    ) : (
                      liveTimeline.map((entry, index) => {
                        const key = `${entry.event_type}-${entry.event_at}-${entry.metadata?.provider_message_id || index}`;
                        const isHighlighted = Boolean(
                          highlightedTimelineKeys[key],
                        );
                        return (
                          <TimelineEventItem
                            key={key}
                            event={entry}
                            isLast={index === liveTimeline.length - 1}
                            timezone={campaign?.tenant_timezone}
                            highlighted={isHighlighted}
                            bounceReason={liveRecipient?.hard_bounce_reason}
                          />
                        );
                      })
                    )}
                  </Stack>
                </JoyCardContent>
              </JoyCard>

              {liveRecipient?.customer_id ? (
                <JoyCard variant="outlined">
                  <JoyCardHeader
                    title="Linked Customer"
                    description="Commerce and lifecycle context for this recipient."
                  />
                  <JoyCardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.5}>
                        <Typography level="title-sm">
                          {customerProfileQuery.data?.first_name ||
                            liveRecipient.customer_name ||
                            liveRecipient.customer_email}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {customerProfileQuery.data?.email ||
                            liveRecipient.customer_email}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <JoyChip variant="soft" color="neutral">
                            {customerProfileQuery.data?.lifecycle_stage ||
                              "Lifecycle stage unavailable"}
                          </JoyChip>
                        </Stack>
                      </Stack>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={3}
                      >
                        {metricValue(
                          "LTV",
                          formatCurrency(
                            customerProfileQuery.data?.lifetime_value ??
                              liveRecipient.lifetime_value,
                          ),
                        )}
                        {metricValue(
                          "Total orders",
                          String(
                            Array.isArray(
                              customerProfileQuery.data?.order_history,
                            )
                              ? customerProfileQuery.data.order_history.length
                              : 0,
                          ),
                        )}
                        {metricValue(
                          "Total spent",
                          formatCurrency(
                            customerProfileQuery.data?.total_spent ??
                              liveRecipient.total_spent,
                          ),
                        )}
                      </Stack>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="flex-end"
                      sx={{ mt: 2 }}
                    >
                      <JoyButton
                        bloomVariant="ghost"
                        color="primary"
                        component={Link}
                        to={`/crm/customers/${liveRecipient.customer_id}`}
                      >
                        View Full Profile
                      </JoyButton>
                    </Stack>
                  </JoyCardContent>
                </JoyCard>
              ) : null}

              {liveRecipient?.can_retry ? (
                <Sheet
                  variant="soft"
                  color="primary"
                  sx={{ borderRadius: "md", p: 2 }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Stack spacing={0.4}>
                      <Typography level="title-sm">
                        This message failed to deliver
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        {liveRecipient.error_message ||
                          liveRecipient.hard_bounce_reason ||
                          "This recipient is eligible for one retry attempt."}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {`${liveRecipient.retry_count ?? 0} of 1 retry attempts used`}
                      </Typography>
                    </Stack>
                    <JoyButton onClick={() => setIsRetryDialogOpen(true)}>
                      <RefreshCw size={16} />
                      Retry Send
                    </JoyButton>
                  </Stack>
                </Sheet>
              ) : null}
            </Stack>
          </JoyTabsContent>

          <JoyTabsContent value="content">
            <JoyCard variant="outlined">
              <JoyCardHeader
                title="Sent Content"
                description={
                  previewSource === "snapshot"
                    ? "Exact rendered payload snapshot."
                    : previewSource === "current_campaign"
                      ? "Current campaign HTML fallback."
                      : "No preview content available."
                }
              />
              <JoyCardContent>
                <Stack spacing={2}>
                  <Stack spacing={0.4}>
                    <Typography level="title-sm">
                      Subject: {previewSubject}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {previewPreheader || "No preheader available"}
                    </Typography>
                  </Stack>
                  {previewHtml ? (
                    <Stack spacing={1}>
                      <ScrollableHtmlPreview html={previewHtml} />
                      <Typography
                        level="body-xs"
                        sx={{ color: "neutral.400", textAlign: "center" }}
                      >
                        Scroll to see more of the sent content.
                      </Typography>
                    </Stack>
                  ) : (
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{
                        borderRadius: "md",
                        px: 2,
                        py: 5,
                        textAlign: "center",
                      }}
                    >
                      <Typography level="body-sm" color="neutral">
                        No HTML preview is available for this recipient yet.
                      </Typography>
                    </Sheet>
                  )}
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </JoyTabsContent>

          <JoyTabsContent value="diagnostics">
            <DiagnosticsPanel
              recipient={liveRecipient}
              activityLog={activityLog}
              campaign={campaign}
              payload={payload}
              providerMessageId={providerMessageId}
              messageId={messageId}
              retryMessageId={retryMessageId}
              bounceType={bounceType}
              bounceCategory={bounceCategory}
              bounceReason={bounceDetailText}
              retryCount={retryCount}
              retryStatus={retryStatus}
              insights={liveInsights}
            />
          </JoyTabsContent>
        </JoyTabs>

        <JoyAlertDialog
          open={isRetryDialogOpen}
          onClose={() => setIsRetryDialogOpen(false)}
          onConfirm={() => void handleRetryRecipient()}
          title="Retry this recipient send?"
          description="A retry creates a second ledger row and reuses the existing send infrastructure. This action is only available once per recipient."
          confirmLabel={isRetrying ? "Queueing..." : "Queue Retry"}
          cancelLabel="Cancel"
          variant="warning"
          loading={isRetrying}
        >
          {liveRecipient?.has_hard_bounce ? (
            <Sheet
              variant="soft"
              color="warning"
              sx={{ borderRadius: "md", p: 1.5 }}
            >
              <Typography level="body-sm">
                Hard-bounce warning:{" "}
                {liveRecipient.hard_bounce_reason ||
                  "the mailbox may be permanently unavailable."}
              </Typography>
            </Sheet>
          ) : null}
        </JoyAlertDialog>
      </Stack>
    </PageContainer>
  );
}
