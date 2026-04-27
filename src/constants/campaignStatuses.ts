export const CAMPAIGN_STATUS = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  QUEUED: "queued",
  PARTIALLY_QUEUED: "partially_queued",
  SENDING: "sending",
  PAUSED: "paused",
  SENT: "sent",
  SENT_WITH_ERRORS: "sent_with_errors",
  FAILED: "failed",
} as const;

export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const CAMPAIGN_STATUSES = Object.values(
  CAMPAIGN_STATUS,
) as CampaignStatus[];

export const QUEUE_STATUSES = [
  CAMPAIGN_STATUS.QUEUED,
  CAMPAIGN_STATUS.PARTIALLY_QUEUED,
] as const satisfies readonly CampaignStatus[];

export const DELIVERED_STATUSES = [
  CAMPAIGN_STATUS.SENT,
  CAMPAIGN_STATUS.SENT_WITH_ERRORS,
] as const satisfies readonly CampaignStatus[];

export const TERMINAL_STATUSES = [
  ...DELIVERED_STATUSES,
  CAMPAIGN_STATUS.FAILED,
] as const satisfies readonly CampaignStatus[];

export const ACTIVE_STATUSES = [
  ...QUEUE_STATUSES,
  CAMPAIGN_STATUS.SENDING,
  CAMPAIGN_STATUS.PAUSED,
] as const satisfies readonly CampaignStatus[];

export const EDITABLE_STATUSES = [
  CAMPAIGN_STATUS.DRAFT,
] as const satisfies readonly CampaignStatus[];

export const LOCKED_STATUSES = [
  CAMPAIGN_STATUS.SCHEDULED,
  ...ACTIVE_STATUSES,
  ...TERMINAL_STATUSES,
] as const satisfies readonly CampaignStatus[];

export const RECIPIENT_VISIBLE_STATUSES = [
  ...ACTIVE_STATUSES,
  ...TERMINAL_STATUSES,
] as const satisfies readonly CampaignStatus[];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  [CAMPAIGN_STATUS.DRAFT]: "Draft",
  [CAMPAIGN_STATUS.SCHEDULED]: "Scheduled",
  [CAMPAIGN_STATUS.QUEUED]: "Queued",
  [CAMPAIGN_STATUS.PARTIALLY_QUEUED]: "Partially queued",
  [CAMPAIGN_STATUS.SENDING]: "Sending",
  [CAMPAIGN_STATUS.PAUSED]: "Paused",
  [CAMPAIGN_STATUS.SENT]: "Sent",
  [CAMPAIGN_STATUS.SENT_WITH_ERRORS]: "Sent w/ errors",
  [CAMPAIGN_STATUS.FAILED]: "Failed",
};

function includesStatus<T extends readonly CampaignStatus[]>(
  statuses: T,
  value: string | null | undefined,
): value is T[number] {
  return Boolean(value) && (statuses as readonly string[]).includes(value);
}

export function isCampaignStatus(
  value: string | null | undefined,
): value is CampaignStatus {
  return includesStatus(CAMPAIGN_STATUSES, value);
}

export function isQueuedCampaignStatus(value: string | null | undefined) {
  return includesStatus(QUEUE_STATUSES, value);
}

export function isDeliveredCampaignStatus(value: string | null | undefined) {
  return includesStatus(DELIVERED_STATUSES, value);
}

export function isTerminalCampaignStatus(value: string | null | undefined) {
  return includesStatus(TERMINAL_STATUSES, value);
}

export function isActiveCampaignStatus(value: string | null | undefined) {
  return includesStatus(ACTIVE_STATUSES, value);
}

export function isEditableCampaignStatus(value: string | null | undefined) {
  return includesStatus(EDITABLE_STATUSES, value);
}

export function isLockedCampaignStatus(value: string | null | undefined) {
  return includesStatus(LOCKED_STATUSES, value);
}

export function canShowCampaignRecipients(value: string | null | undefined) {
  return includesStatus(RECIPIENT_VISIBLE_STATUSES, value);
}

export function getCampaignStatusLabel(
  value: CampaignStatus | string | null | undefined,
) {
  if (!isCampaignStatus(value)) {
    return value ? String(value) : "Draft";
  }

  return STATUS_LABELS[value];
}