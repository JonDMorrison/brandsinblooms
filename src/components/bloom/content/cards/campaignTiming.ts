import {
  formatDate,
  formatLabel,
  getValue,
  readString,
} from "@/components/bloom/content/cards/cardUtils";

type CampaignRow = Parameters<typeof getValue>[0];
type CampaignTiming = { kind: "sent" | "scheduled" | "draft" | "other"; label: string | null };

/**
 * Only a campaign that actually went out is labelled "Sent". Drafts used to
 * borrow created_at and read "Sent 9 minutes ago".
 */
export function campaignTiming(campaign: CampaignRow): CampaignTiming {
  const status = (readString(getValue(campaign, ["status"])) ?? "").toLowerCase();
  const sentAt = formatDate(getValue(campaign, ["sent_at"]));
  const scheduledAt = formatDate(getValue(campaign, ["scheduled_at"]));
  const updatedAt = formatDate(getValue(campaign, ["updated_at", "created_at"]));
  if (sentAt && (status === "" || status === "sent" || status === "completed")) {
    return { kind: "sent", label: `Sent ${sentAt}` };
  }
  if (status === "sent" || status === "completed") {
    return { kind: "sent", label: "Sent" };
  }
  if (status === "scheduled" || status === "queued") {
    return { kind: "scheduled", label: scheduledAt ? `Scheduled ${scheduledAt}` : "Scheduled" };
  }
  if (status === "draft" || status === "") {
    return { kind: "draft", label: updatedAt ? `Draft · edited ${updatedAt}` : "Draft" };
  }
  return { kind: "other", label: formatLabel(status, "Campaign") };
}

