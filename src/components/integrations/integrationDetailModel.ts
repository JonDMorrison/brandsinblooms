import {
  type IntegrationDefinition,
  type IntegrationStatus,
} from "@/components/integrations/integrationsHubConfig";

export type IntegrationDetailTone = "success" | "neutral" | "warning" | "danger";

export interface IntegrationDetailMetric {
  key: string;
  label: string;
  value: string;
  subtitle: string;
  timestamp?: string | null;
  tone: IntegrationDetailTone;
}

export interface IntegrationDetailRow {
  label: string;
  value: string;
  tone?: IntegrationDetailTone;
  timestamp?: string | null;
  tooltip?: string;
}

export interface IntegrationDetailTimelineEntry {
  key: string;
  label: string;
  timestamp: string | null;
  tone: IntegrationDetailTone;
}

export interface IntegrationDetailBanner {
  title: string;
  description: string;
}

export interface IntegrationDetailModelInput {
  item: IntegrationDefinition;
  status: IntegrationStatus;
  contextLabel?: string | null;
  connectedAt?: string | null;
  verificationAt?: string | null;
  lastSyncAt?: string | null;
  lastActivityAt?: string | null;
  lastWebhookReceivedAt?: string | null;
  hasWebhookMonitoring?: boolean;
  webhooksSubscribed?: boolean | null;
  webhookRetryCount?: number | null;
  webhookNextRetryAt?: string | null;
  lastError?: string | null;
  syncSummary?: string | null;
  serviceStateLabel?: string | null;
  configurationHint?: string;
  activityHint?: string;
  canDisconnect?: boolean;
}

export interface IntegrationDetailModel {
  status: IntegrationStatus;
  statusLabel: string;
  statusTone: IntegrationDetailTone;
  metadata: string[];
  metrics: IntegrationDetailMetric[];
  timeline: IntegrationDetailTimelineEntry[];
  webhookRows: IntegrationDetailRow[];
  syncRows: IntegrationDetailRow[];
  errorBanner: IntegrationDetailBanner | null;
  configurationHint: string;
  activityHint: string;
  canDisconnect: boolean;
  disconnectTitle?: string;
  disconnectDescription?: string;
}

export interface TruncatedIntegrationError {
  shortMessage: string;
  fullMessage: string;
  isTruncated: boolean;
}

const DEFAULT_INTEGRATION_ERROR_MESSAGE =
  "Something went wrong with this integration. Please try again.";

const SAFE_USER_MESSAGE_PATTERNS = [
  "connect square before",
  "connect clover before",
  "connect lightspeed before",
  "connect google analytics before",
  "add a sending domain before",
  "you must be signed in",
  "please sign in again",
  "only site admins can disconnect",
  "property id is required before reauthorizing",
  "no active connection was found",
] as const;

const TECHNICAL_INTEGRATION_PATTERNS = [
  "token decryption",
  "token encryption",
  "decrypt",
  "encrypt",
  "encrypted token",
  "legacy plain-text",
  "legacy plaintext",
  "base64(",
  "ciphertext",
  "authorization code",
  "oauth",
  "invalid_grant",
  "invalid oauth",
  "state parameter",
  "edge function",
  "supabase",
  "postgres",
  "database",
  "schema",
  "column",
  "relation",
  "sql",
  "row-level security",
  "permission denied for table",
  "json",
  "request failed",
  "failed to fetch",
  "network error",
  "err_internet_disconnected",
  "internal server error",
  "unexpected token",
  "function",
] as const;

function isEmailInfrastructureSlug(slug: string) {
  return slug === "email-infrastructure" || slug === "email-domain-dns";
}

export function getIntegrationStatusPresentation(status: IntegrationStatus): {
  label: string;
  tone: IntegrationDetailTone;
} {
  switch (status) {
    case "connected":
      return { label: "Connected", tone: "success" };
    case "coming-soon":
      return { label: "Upcoming", tone: "warning" };
    default:
      return { label: "Available", tone: "neutral" };
  }
}

export function truncateIntegrationError(
  message: string | null | undefined,
  maxLength = 96,
): TruncatedIntegrationError | null {
  if (!message) {
    return null;
  }

  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return {
      shortMessage: normalized,
      fullMessage: normalized,
      isTruncated: false,
    };
  }

  return {
    shortMessage: `${normalized.slice(0, maxLength - 1).trimEnd()}…`,
    fullMessage: normalized,
    isTruncated: true,
  };
}

function extractIntegrationErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;

    for (const key of ["message", "error", "details", "hint"]) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return "";
}

function normalizeIntegrationMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function looksLikeTechnicalIntegrationMessage(message: string): boolean {
  return TECHNICAL_INTEGRATION_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

export function getUserFacingIntegrationError(
  error: unknown,
  fallback = DEFAULT_INTEGRATION_ERROR_MESSAGE,
): string {
  const normalized = normalizeIntegrationMessage(
    extractIntegrationErrorMessage(error),
  );

  if (!normalized) {
    return fallback;
  }

  const lowerMessage = normalized.toLowerCase();

  if (
    SAFE_USER_MESSAGE_PATTERNS.some((pattern) => lowerMessage.includes(pattern))
  ) {
    return normalized;
  }

  if (
    lowerMessage.includes("not authenticated") ||
    lowerMessage.includes("must be signed in") ||
    lowerMessage.includes("session expired")
  ) {
    return "Please sign in again and try once more.";
  }

  if (
    lowerMessage.includes("only site admins") ||
    lowerMessage.includes("do not have permission") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("forbidden")
  ) {
    return "You do not have permission to manage this integration.";
  }

  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out")
  ) {
    return "The request took too long to complete. Please try again.";
  }

  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("network error") ||
    lowerMessage.includes("err_internet_disconnected") ||
    lowerMessage.includes("networkrequestfailed")
  ) {
    return "We could not reach the integration service. Please try again.";
  }

  if (
    lowerMessage.includes("token decryption") ||
    lowerMessage.includes("token encryption") ||
    lowerMessage.includes("decrypt") ||
    lowerMessage.includes("encrypt") ||
    lowerMessage.includes("encrypted token") ||
    lowerMessage.includes("ciphertext") ||
    lowerMessage.includes("base64(") ||
    lowerMessage.includes("legacy plain-text") ||
    lowerMessage.includes("legacy plaintext")
  ) {
    return "We could not verify the saved integration connection. Reconnect the integration and try again.";
  }

  if (
    lowerMessage.includes("oauth") ||
    lowerMessage.includes("authorization failed") ||
    lowerMessage.includes("authorization code") ||
    lowerMessage.includes("invalid_grant") ||
    lowerMessage.includes("invalid oauth") ||
    lowerMessage.includes("state parameter") ||
    lowerMessage.includes("access_denied") ||
    lowerMessage.includes("callback")
  ) {
    return "The connection could not be completed. Please try connecting again.";
  }

  if (
    lowerMessage.includes("no connection found") ||
    lowerMessage.includes("connection not found")
  ) {
    return "No active connection was found. Reconnect the integration and try again.";
  }

  if (
    lowerMessage.includes("schema") ||
    lowerMessage.includes("column") ||
    lowerMessage.includes("relation") ||
    lowerMessage.includes("postgres") ||
    lowerMessage.includes("database") ||
    lowerMessage.includes("supabase") ||
    lowerMessage.includes("request failed") ||
    lowerMessage.includes("internal server error") ||
    lowerMessage.includes("permission denied for table")
  ) {
    return fallback;
  }

  if (!looksLikeTechnicalIntegrationMessage(lowerMessage) && normalized.length <= 180) {
    return normalized;
  }

  return fallback;
}

export function summarizeUserFacingIntegrationWarnings(
  warnings: unknown[] | null | undefined,
  fallback = "This action completed with warnings. Some records may need attention.",
): string {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return fallback;
  }

  const messages = Array.from(
    new Set(
      warnings
        .map((warning) => getUserFacingIntegrationError(warning, fallback))
        .filter((message) => Boolean(message)),
    ),
  );

  if (messages.length === 0) {
    return fallback;
  }

  if (messages.length === 1) {
    return messages[0];
  }

  return fallback;
}

function buildMetadata(input: IntegrationDetailModelInput): string[] {
  const metadata = [input.item.categoryLabel];

  if (input.item.syncScopeLabel) {
    metadata.push(input.item.syncScopeLabel);
  }

  if (input.contextLabel) {
    metadata.push(input.contextLabel);
  }

  return metadata;
}

function buildTimeline(input: IntegrationDetailModelInput) {
  const entries: IntegrationDetailTimelineEntry[] = [];

  if (input.connectedAt) {
    entries.push({
      key: "connected",
      label: "Connected",
      timestamp: input.connectedAt,
      tone: "success",
    });
  }

  if (input.verificationAt && input.verificationAt !== input.connectedAt) {
    entries.push({
      key: "verified",
      label: isEmailInfrastructureSlug(input.item.slug)
        ? "Domain verified"
        : "Configuration validated",
      timestamp: input.verificationAt,
      tone: "success",
    });
  }

  if (input.lastSyncAt) {
    entries.push({
      key: "last-sync",
      label: "Last successful sync",
      timestamp: input.lastSyncAt,
      tone: input.status === "connected" ? "success" : "neutral",
    });
  }

  if (
    input.lastWebhookReceivedAt &&
    input.lastWebhookReceivedAt !== input.lastSyncAt
  ) {
    entries.push({
      key: "last-webhook",
      label: "Last webhook received",
      timestamp: input.lastWebhookReceivedAt,
      tone: "neutral",
    });
  }

  if (entries.length > 0) {
    return entries;
  }

  return [
    {
      key: "placeholder",
      label:
        input.status === "coming-soon"
          ? "Planned for a future release"
          : input.status === "available"
            ? "Awaiting first connection"
            : "Awaiting first successful sync",
      timestamp: null,
      tone: getIntegrationStatusPresentation(input.status).tone,
    },
  ];
}

function buildWebhookRows(input: IntegrationDetailModelInput) {
  const rows: IntegrationDetailRow[] = [];
  const sanitizedLastError = input.lastError
    ? getUserFacingIntegrationError(
        input.lastError,
        "This integration needs attention. Please try again or reconnect the integration.",
      )
    : null;
  const truncatedError = truncateIntegrationError(sanitizedLastError);

  if (!input.hasWebhookMonitoring) {
    return [
      {
        label: "Webhook status",
        value: "Not monitored for this integration",
      },
    ];
  }

  rows.push({
    label: "Subscription",
    value: input.webhooksSubscribed ? "Subscribed" : "Attention needed",
    tone: input.webhooksSubscribed ? "success" : "warning",
  });

  rows.push({
    label: "Last event",
    value: input.lastWebhookReceivedAt ? "Received" : "Not yet received",
    tone: input.lastWebhookReceivedAt ? "success" : "neutral",
    timestamp: input.lastWebhookReceivedAt ?? null,
  });

  rows.push({
    label: "Retry queue",
    value:
      input.webhookRetryCount && input.webhookRetryCount > 0
        ? `${input.webhookRetryCount} pending`
        : "No retries pending",
    tone:
      input.webhookRetryCount && input.webhookRetryCount > 0
        ? "warning"
        : "neutral",
  });

  if (input.webhookNextRetryAt) {
    rows.push({
      label: "Next retry",
      value: "Scheduled",
      tone: "warning",
      timestamp: input.webhookNextRetryAt,
    });
  }

  if (truncatedError) {
    rows.push({
      label: "Last error",
      value: truncatedError.shortMessage,
      tone: "danger",
      tooltip: truncatedError.isTruncated ? truncatedError.fullMessage : undefined,
    });
  }

  return rows;
}

function buildSyncRows(input: IntegrationDetailModelInput) {
  const rows: IntegrationDetailRow[] = [];

  rows.push({
    label: "Service state",
    value: input.serviceStateLabel ?? getIntegrationStatusPresentation(input.status).label,
    tone:
      input.status === "connected"
        ? "success"
        : input.status === "coming-soon"
          ? "warning"
          : "neutral",
  });

  if (input.lastSyncAt) {
    rows.push({
      label: "Last sync",
      value: "Completed",
      timestamp: input.lastSyncAt,
      tone: input.status === "connected" ? "success" : "neutral",
    });
  } else if (input.verificationAt) {
    rows.push({
      label: isEmailInfrastructureSlug(input.item.slug)
        ? "Last verification"
        : "Last connection test",
      value: "Completed",
      timestamp: input.verificationAt,
      tone: "success",
    });
  } else {
    rows.push({
      label: "Last sync",
      value:
        input.status === "coming-soon"
          ? "Not available yet"
          : "No successful sync recorded",
    });
  }

  rows.push({
    label: "Records",
    value: input.syncSummary ?? "Detailed sync counts are not available yet",
  });

  return rows;
}

export function buildIntegrationDetailModel(
  input: IntegrationDetailModelInput,
): IntegrationDetailModel {
  const presentation = getIntegrationStatusPresentation(input.status);

  return {
    status: input.status,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    metadata: buildMetadata(input),
    metrics: [
      {
        key: "connection",
        label: "Connection",
        value: presentation.label,
        subtitle:
          input.status === "connected"
            ? "Connection is active"
            : input.status === "coming-soon"
              ? "Planned for a future milestone"
              : "Ready to configure",
        timestamp: input.connectedAt ?? null,
        tone: presentation.tone,
      },
      {
        key: "latest-signal",
        label: "Latest Signal",
        value:
          input.lastActivityAt || input.lastSyncAt || input.verificationAt
            ? "Recent activity"
            : input.status === "coming-soon"
              ? "Roadmap"
              : "Awaiting setup",
        subtitle:
          input.lastActivityAt || input.lastSyncAt || input.verificationAt
            ? "Last observed provider activity"
            : "No provider activity recorded yet",
        timestamp:
          input.lastActivityAt ??
          input.lastSyncAt ??
          input.verificationAt ??
          null,
        tone: input.status === "connected" ? "success" : presentation.tone,
      },
      {
        key: "scope",
        label: "Sync Scope",
        value: input.item.syncScopeLabel ?? input.item.categoryLabel,
        subtitle:
          input.contextLabel ?? input.serviceStateLabel ?? input.item.categoryLabel,
        tone: "neutral",
      },
    ],
    timeline: buildTimeline(input),
    webhookRows: buildWebhookRows(input),
    syncRows: buildSyncRows(input),
    errorBanner: input.lastError
      ? {
          title: "Integration attention required",
          description:
            truncateIntegrationError(
              getUserFacingIntegrationError(
                input.lastError,
                "This integration needs attention. Please try again or reconnect the integration.",
              ),
              180,
            )?.fullMessage ??
            "This integration needs attention. Please try again or reconnect the integration.",
        }
      : null,
    configurationHint:
      input.configurationHint ??
      (input.item.targetPath
        ? `Use the existing ${input.item.name} flow to manage provider-specific settings.`
        : `${input.item.name} configuration controls will arrive in a later milestone.`),
    activityHint:
      input.activityHint ??
      (input.status === "connected"
        ? "Provider-specific sync activity will appear here in a later milestone."
        : "Once connected, BloomSuite will surface provider-specific activity here."),
    canDisconnect: Boolean(input.canDisconnect && input.status === "connected"),
    disconnectTitle: input.canDisconnect ? `Disconnect ${input.item.name}?` : undefined,
    disconnectDescription: input.canDisconnect
      ? input.item.slug === "meta"
        ? "Disconnecting Meta will remove Facebook and Instagram access for this account."
        : `Disconnecting ${input.item.name} will stop future syncing until it is connected again.`
      : undefined,
  };
}