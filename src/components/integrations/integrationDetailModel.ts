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
  const truncatedError = truncateIntegrationError(input.lastError);

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
          description: truncateIntegrationError(input.lastError, 180)?.fullMessage ?? input.lastError,
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