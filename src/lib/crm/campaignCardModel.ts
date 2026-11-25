/**
 * What a campaign card shows for each stage: a draft's checklist, a scheduled
 * send's time, a sent campaign's results. Pure, so the page stays simple.
 */
import { CAMPAIGN_STATUS } from "@/constants/campaignStatuses";
import type { CampaignCatalogItem } from "@/lib/crm/campaignEditor";

export type CampaignStage = "draft" | "scheduled" | "sending" | "sent" | "failed";

export interface ReadinessStep {
  key: "content" | "subject" | "audience";
  label: string;
  done: boolean;
}

export interface CampaignReadiness {
  steps: ReadinessStep[];
  ready: boolean;
  /** Plain next action, e.g. "Add a subject line". Null when ready. */
  nextStep: string | null;
}

const SENDING = new Set<string>([
  CAMPAIGN_STATUS.QUEUED,
  CAMPAIGN_STATUS.PARTIALLY_QUEUED,
  CAMPAIGN_STATUS.SENDING,
  CAMPAIGN_STATUS.PAUSED,
]);

export function campaignStage(status: CampaignCatalogItem["status"]): CampaignStage {
  if (status === CAMPAIGN_STATUS.DRAFT) return "draft";
  if (status === CAMPAIGN_STATUS.SCHEDULED) return "scheduled";
  if (status === CAMPAIGN_STATUS.FAILED) return "failed";
  if (SENDING.has(status)) return "sending";
  return "sent";
}

type ReadinessInput = Pick<
  CampaignCatalogItem,
  "channel" | "subjectLine" | "isEmptyDraft" | "hasAudience"
>;

export function campaignReadiness(campaign: ReadinessInput): CampaignReadiness {
  const isSms = campaign.channel === "sms";
  const steps: ReadinessStep[] = [
    { key: "content", label: isSms ? "Message" : "Content", done: !campaign.isEmptyDraft },
    ...(isSms
      ? []
      : [{ key: "subject" as const, label: "Subject", done: Boolean(campaign.subjectLine.trim()) }]),
    { key: "audience", label: "Audience", done: Boolean(campaign.hasAudience) },
  ];
  const missing = steps.find((step) => !step.done);
  const nextStep = !missing
    ? null
    : missing.key === "content"
      ? isSms ? "Write your message" : "Add your content"
      : missing.key === "subject"
        ? "Add a subject line"
        : "Choose who gets it";
  return { steps, ready: !missing, nextStep };
}

/** Empty drafts are hidden by default; they carry no work worth showing. */
export function partitionEmptyDrafts<T extends Pick<CampaignCatalogItem, "isEmptyDraft">>(
  campaigns: T[],
): { visible: T[]; empty: T[] } {
  const visible: T[] = [];
  const empty: T[] = [];
  for (const campaign of campaigns) {
    (campaign.isEmptyDraft ? empty : visible).push(campaign);
  }
  return { visible, empty };
}

/** Columns that carry meaning in each list tab. */
export function visibleColumnsForFilter(filter: string) {
  const showSchedule = filter === "scheduled" || filter === "all";
  const showRates = filter === "sent" || filter === "sending" || filter === "all";
  return { showSchedule, showRates };
}
