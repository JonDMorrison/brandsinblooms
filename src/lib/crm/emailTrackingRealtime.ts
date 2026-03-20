import type { Database, Json } from "@/integrations/supabase/types";
import type { DerivedMetrics } from "@/hooks/analytics/useCampaignDerivedMetrics";

export type EmailTrackingEventRow =
  Database["public"]["Tables"]["email_tracking_events"]["Row"];

export type KnownEventBucket = "opened" | "clicked" | "bounced";

export type KnownRecipientEventSets = Record<KnownEventBucket, Set<string>>;

export type RealtimeBannerState = "hidden" | "paused";

export function normalizeTrackingEventType(eventType: string | null | undefined) {
  switch ((eventType || "").toLowerCase()) {
    case "email.sent":
    case "sent":
      return "sent";
    case "email.delivered":
    case "delivered":
      return "delivered";
    case "email.open":
    case "email.opened":
    case "open":
    case "opened":
      return "opened";
    case "email.click":
    case "email.clicked":
    case "click":
    case "clicked":
      return "clicked";
    case "email.bounce":
    case "email.bounced":
    case "bounce":
    case "bounced":
      return "bounced";
    case "email.complaint":
    case "email.complained":
    case "complaint":
    case "complained":
      return "complained";
    case "email.unsubscribe":
    case "email.unsubscribed":
    case "unsubscribe":
    case "unsubscribed":
      return "unsubscribed";
    case "email.deferred":
    case "deferred":
      return "deferred";
    case "email.rejected":
    case "rejected":
      return "rejected";
    default:
      return (eventType || "unknown").toLowerCase();
  }
}

export function getTrackingEventTimestamp(event: Pick<EmailTrackingEventRow, "event_ts_provider" | "created_at">) {
  return event.event_ts_provider || event.created_at;
}

export function toRecipientKey(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

function getEventDataRecord(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function extractTrackingLinkUrl(event: Pick<EmailTrackingEventRow, "event_data">) {
  const eventData = getEventDataRecord(event.event_data);
  const linkUrl = eventData.link_url;
  if (typeof linkUrl === "string" && linkUrl.trim()) return linkUrl;

  const clickLink = eventData.click_link;
  if (typeof clickLink === "string" && clickLink.trim()) return clickLink;

  const url = eventData.url;
  if (typeof url === "string" && url.trim()) return url;

  return null;
}

export function extractBounceReason(event: Pick<EmailTrackingEventRow, "bounce_type" | "event_data">) {
  if (event.bounce_type?.trim()) return event.bounce_type;

  const eventData = getEventDataRecord(event.event_data);
  const candidates = [eventData.message, eventData.reason, eventData.bounce_reason, eventData.bounce_type];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return null;
}

export function createKnownRecipientEventSets(): KnownRecipientEventSets {
  return {
    opened: new Set<string>(),
    clicked: new Set<string>(),
    bounced: new Set<string>(),
  };
}

export function cloneDerivedMetrics(metrics: DerivedMetrics): DerivedMetrics {
  return {
    totals: { ...metrics.totals },
    scores: { ...metrics.scores },
    rates: { ...metrics.rates },
    diagnostics: { ...metrics.diagnostics },
    reconciliation: { ...metrics.reconciliation },
    links: metrics.links.map((link) => ({ ...link })),
    computed_at: metrics.computed_at,
  };
}

function roundRate(value: number) {
  return Number(value.toFixed(2));
}

function updateMetricRates(metrics: DerivedMetrics) {
  const sent = metrics.totals.sent;
  const delivered = metrics.totals.delivered;
  const successfulReach = Math.max(metrics.totals.successful_reach, 0);
  const opens = metrics.totals.opens;
  const opensNonMpp = metrics.totals.opens_non_mpp;
  const clicks = metrics.totals.clicks;
  const hardBounces = metrics.totals.hard_bounces;
  const complaints = metrics.totals.complaints;

  metrics.rates.delivery = sent > 0 ? roundRate((delivered / sent) * 100) : 0;
  metrics.rates.open_reported = successfulReach > 0 ? roundRate((opens / successfulReach) * 100) : 0;
  metrics.rates.open_adjusted = successfulReach > 0 ? roundRate((opensNonMpp / successfulReach) * 100) : 0;
  metrics.rates.click = successfulReach > 0 ? roundRate((clicks / successfulReach) * 100) : 0;
  metrics.rates.bounce = sent > 0 ? roundRate((hardBounces / sent) * 100) : 0;
  metrics.rates.complaint = sent > 0 ? roundRate((complaints / sent) * 100) : 0;
  metrics.rates.click_to_open = opens > 0 ? roundRate((clicks / opens) * 100) : 0;
  metrics.scores.reach = sent > 0 ? roundRate((successfulReach / sent) * 100) : 0;
  metrics.scores.interaction = successfulReach > 0 ? roundRate((metrics.totals.unique_engaged / successfulReach) * 100) : 0;
}

export function applyRealtimeMetricsDelta(
  currentMetrics: DerivedMetrics,
  event: Pick<EmailTrackingEventRow, "customer_email" | "event_type" | "is_mpp_guess">,
  knownRecipients: KnownRecipientEventSets,
) {
  const nextMetrics = cloneDerivedMetrics(currentMetrics);
  const recipientKey = toRecipientKey(event.customer_email);
  const normalizedType = normalizeTrackingEventType(event.event_type);

  if (!recipientKey) return nextMetrics;

  if (normalizedType === "opened" && !knownRecipients.opened.has(recipientKey)) {
    knownRecipients.opened.add(recipientKey);
    nextMetrics.totals.opens += 1;
    if (!event.is_mpp_guess) {
      nextMetrics.totals.opens_non_mpp += 1;
    }
    nextMetrics.totals.unique_engaged = Math.max(
      nextMetrics.totals.unique_engaged,
      knownRecipients.opened.size,
      knownRecipients.clicked.size,
    );
  }

  if (normalizedType === "clicked" && !knownRecipients.clicked.has(recipientKey)) {
    knownRecipients.clicked.add(recipientKey);
    nextMetrics.totals.clicks += 1;
    nextMetrics.totals.unique_engaged = Math.max(
      nextMetrics.totals.unique_engaged,
      knownRecipients.opened.size,
      knownRecipients.clicked.size,
    );
  }

  if (normalizedType === "bounced" && !knownRecipients.bounced.has(recipientKey)) {
    knownRecipients.bounced.add(recipientKey);
    nextMetrics.totals.bounces += 1;
    nextMetrics.totals.hard_bounces += 1;
    nextMetrics.totals.successful_reach = Math.max(nextMetrics.totals.successful_reach - 1, 0);
  }

  updateMetricRates(nextMetrics);
  nextMetrics.computed_at = new Date().toISOString();
  return nextMetrics;
}