import Box from "@mui/joy/Box";
import type { ColorPaletteProp } from "@mui/joy/styles";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  XCircle,
} from "lucide-react";
import type { ActivityEvent } from "@/types/activity";

const ACTOR_LABELS: Record<string, string> = {
  user: "User",
  automation: "Automation",
  integration: "Integration",
  system: "System",
};

const SOURCE_LABELS: Record<string, string> = {
  ui: "UI",
  automation: "Automation",
  webhook: "Webhook",
  sync: "Sync",
};

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

export function formatActivityLabel(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  "pos.order.created": "Purchase",
  "order.created": "Purchase",
  "order.completed": "Purchase",
  refund: "Refund",
  "refund.created": "Refund",
  "customer.created": "New customer",
  "customer.updated": "Customer updated",
  "email.sent": "Email sent",
  "email.delivered": "Email delivered",
  "email.opened": "Email opened",
  "email.clicked": "Email link clicked",
  "email.bounced": "Email bounced",
  "email.unsubscribed": "Unsubscribed from email",
  "sms.sent": "Text message sent",
  "form.submitted": "Form submitted",
  "segment.added": "Added to segment",
  "automation.triggered": "Automation started",
};

/** A human label for an activity type key, e.g. "purchase" -> "Purchase". */
export function formatActivityType(value?: string | null) {
  if (!value) return "";
  return ACTIVITY_TYPE_LABELS[normalizeKey(value)] ?? formatActivityLabel(value);
}

/**
 * The row title. Imported timeline rows carry the raw type key as their
 * title ("purchase"); those are shown as human labels ("Purchase").
 */
export function getActivityTitle(event: Pick<ActivityEvent, "title" | "activity_type">) {
  const title = String(event.title ?? "").trim();
  const type = String(event.activity_type ?? "").trim();
  if (!title) return formatActivityType(type) || "Activity event";
  const looksLikeKey = /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(title);
  if (title === type || looksLikeKey) return formatActivityType(title);
  return title;
}

export function formatActivityActor(value?: string | null) {
  if (!value) return "Unknown";
  return ACTOR_LABELS[normalizeKey(value)] ?? formatActivityLabel(value);
}

export function formatActivitySource(value?: string | null) {
  if (!value) return "Unknown";
  return SOURCE_LABELS[normalizeKey(value)] ?? formatActivityLabel(value);
}

export function isInternalHref(href?: string | null) {
  return Boolean(href && href.startsWith("/") && !href.startsWith("//"));
}

export function isCustomerCreatedEvent(event: ActivityEvent) {
  return (
    String(event.activity_type) === "customer.created" ||
    String(event.title).toLowerCase().includes("customer created")
  );
}

export function getCustomerNameFromEvent(
  event: ActivityEvent,
  customerNameOverride?: string,
) {
  if (typeof customerNameOverride === "string" && customerNameOverride.trim()) {
    return customerNameOverride.trim();
  }

  const metadata = event.metadata ?? {};
  const metadataName =
    typeof metadata.customer_name === "string"
      ? metadata.customer_name
      : `${String(metadata.customer_first_name ?? "").trim()} ${String(metadata.customer_last_name ?? "").trim()}`.trim();

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  const related = event.related_entities ?? {};
  const relatedCustomer =
    related.customer && typeof related.customer === "object"
      ? (related.customer as Record<string, unknown>)
      : null;

  const relatedNameCandidates = [
    related.customer_name,
    `${String(related.customer_first_name ?? "").trim()} ${String(related.customer_last_name ?? "").trim()}`.trim(),
    relatedCustomer?.name,
    relatedCustomer?.full_name,
    `${String(relatedCustomer?.first_name ?? "").trim()} ${String(relatedCustomer?.last_name ?? "").trim()}`.trim(),
    `${String(relatedCustomer?.firstName ?? "").trim()} ${String(relatedCustomer?.lastName ?? "").trim()}`.trim(),
  ];

  const relatedName = relatedNameCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  );

  if (typeof relatedName === "string" && relatedName.trim()) {
    return relatedName.trim();
  }

  if (isCustomerCreatedEvent(event)) {
    for (const part of event.description.parts) {
      if (
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
}

export function getKnownEntityHref(key: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = normalizeKey(key);

  if (normalized === "customer_id" || normalized.endsWith(".customer_id")) {
    return `/crm/customers/${value}`;
  }

  if (normalized === "campaign_id" || normalized.endsWith(".campaign_id")) {
    return `/crm/campaigns/${value}`;
  }

  if (normalized === "automation_id" || normalized.endsWith(".automation_id")) {
    return `/crm/automations/${value}`;
  }

  if (normalized === "form_id" || normalized.endsWith(".form_id")) {
    return `/crm/forms/${value}`;
  }

  return null;
}

export function getActivityStatusTone(
  status?: string | null,
): ColorPaletteProp {
  switch (normalizeKey(status ?? "")) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "warning":
      return "warning";
    case "pending":
      return "neutral";
    default:
      return "primary";
  }
}

function getStatusIcon(status?: string | null) {
  switch (normalizeKey(status ?? "")) {
    case "success":
      return CheckCircle2;
    case "failed":
      return XCircle;
    case "warning":
      return AlertTriangle;
    case "pending":
      return Clock3;
    default:
      return Info;
  }
}

export function ActivityStatusMarker({
  status,
  size = 28,
}: {
  status?: string | null;
  size?: number;
}) {
  const Icon = getStatusIcon(status);
  const tone = getActivityStatusTone(status);

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${tone}.50`,
        color: `${tone}.600`,
        border: "1px solid",
        borderColor: `${tone}.200`,
        boxShadow: "sm",
      }}
    >
      <Icon size={Math.max(14, Math.floor(size * 0.55))} strokeWidth={2} />
    </Box>
  );
}
