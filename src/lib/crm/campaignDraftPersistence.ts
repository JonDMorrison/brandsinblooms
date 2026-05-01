import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { resolveAudienceRecipientIds } from "@/lib/computeAudienceRecipientCount";
import type { ContentBlock, EmailBlock } from "@/types/emailBuilder";
import {
  convertEmailBlockToContentBlock,
  normalizeBlockForSave,
} from "@/utils/blockFieldMapping";
import {
  escapeHtml,
  formatDraftRichText,
  formatDraftText,
} from "@/lib/crm/htmlContent";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];
type CampaignStatus = CampaignRow["status"];

export interface PersistCampaignRecordInput {
  campaignId?: string | null;
  expectedUpdatedAt?: string | null;
  campaignType: "email" | "sms";
  legacyContentHtml?: string;
  status?: CampaignStatus | null;
  name: string;
  subjectLine: string;
  preheaderText: string;
  senderName: string;
  senderEmail: string;
  fromEmailDomainId?: string | null;
  replyTo: string;
  contentBlocks: ContentBlock[];
  smsMessage: string;
  sendAt?: string | null;
  sendImmediately?: boolean;
  sourceContentTaskId?: string | null;
  sourceSegmentId?: string | null;
  sourcePersonaId?: string | null;
  segmentIds?: string[];
  personaIds?: string[];
  metadata?: Record<string, unknown>;
}

export class CampaignDraftConflictError extends Error {
  readonly currentUpdatedAt: string | null;

  constructor(currentUpdatedAt: string | null) {
    super(
      "This campaign was modified in another tab. Reload to see the latest version.",
    );
    this.name = "CampaignDraftConflictError";
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export type DraftSnapshotTrigger = "review" | "pre-send" | "manual";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeInputBlocks(
  blocks: Array<ContentBlock | EmailBlock | Record<string, unknown>>,
) {
  return blocks.flatMap((block) => {
    if (!block || typeof block !== "object") {
      return [] as ContentBlock[];
    }

    const candidate = block as Record<string, unknown>;
    if (typeof candidate.type === "string") {
      return [candidate as ContentBlock];
    }

    if (typeof candidate.block_type === "string") {
      return [
        convertEmailBlockToContentBlock(candidate as unknown as EmailBlock),
      ];
    }

    return [] as ContentBlock[];
  });
}

function renderDraftButton(
  label: string | null | undefined,
  url: string | null | undefined,
  backgroundColor = "#1f4f3f",
) {
  if (!label || !url) {
    return "";
  }

  return `<div style="margin-top:18px;"><a href="${escapeHtml(
    url,
  )}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${backgroundColor};color:#ffffff;text-decoration:none;font-weight:600;">${formatDraftText(
    label,
  )}</a></div>`;
}

function renderDraftImage(
  imageUrl: string | null | undefined,
  altText: string | null | undefined,
  maxHeight = 320,
) {
  if (!imageUrl) {
    return "";
  }

  return `<div style="margin:0 0 18px;"><img src="${escapeHtml(
    imageUrl,
  )}" alt="${escapeHtml(
    altText || "Draft image",
  )}" style="display:block;width:100%;max-height:${maxHeight}px;object-fit:cover;border:0;border-radius:18px;" /></div>`;
}

function renderDraftTextBlock(block: ContentBlock) {
  const heading = block.headline || block.title || "";
  const body = block.body || block.content || block.subtitle || "";
  const textColor = block.textColor || "#1f2937";
  const backgroundColor = block.backgroundColor || "#ffffff";

  return `
    <section style="padding:28px 32px;margin:0 0 20px;border-radius:24px;background:${backgroundColor};box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);">
      ${renderDraftImage(block.imageUrl || block.backgroundImageUrl, block.altText, block.type === "image" ? 360 : 280)}
      ${heading ? `<h2 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:${textColor};">${formatDraftText(heading)}</h2>` : ""}
      ${body ? `<div style="font-size:16px;line-height:1.7;color:${textColor};">${formatDraftRichText(body)}</div>` : ""}
      ${renderDraftButton(block.buttonText || block.ctaText, block.buttonUrl || block.ctaUrl, block.buttonColor || "#1f4f3f")}
    </section>
  `;
}

function renderDraftGallery(block: ContentBlock) {
  const galleryImages = Array.isArray(block.galleryImages)
    ? block.galleryImages
    : [];
  const items = galleryImages
    .map((image) => {
      const imageRecord = toRecord(image);
      const imageUrl =
        typeof imageRecord.url === "string"
          ? imageRecord.url
          : typeof imageRecord.imageUrl === "string"
            ? imageRecord.imageUrl
            : "";

      if (!imageUrl) {
        return "";
      }

      const caption =
        typeof imageRecord.caption === "string"
          ? imageRecord.caption
          : typeof imageRecord.title === "string"
            ? imageRecord.title
            : "";

      return `
        <figure style="margin:0;display:flex;flex-direction:column;gap:10px;">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
            typeof imageRecord.alt === "string"
              ? imageRecord.alt
              : typeof imageRecord.altText === "string"
                ? imageRecord.altText
                : caption || "Gallery image",
          )}" style="display:block;width:100%;height:180px;object-fit:cover;border-radius:18px;" />
          ${caption ? `<figcaption style="font-size:13px;color:#475569;">${formatDraftText(caption)}</figcaption>` : ""}
        </figure>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!items) {
    return renderDraftTextBlock(block);
  }

  return `
    <section style="padding:28px 32px;margin:0 0 20px;border-radius:24px;background:#ffffff;box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);">
      ${block.headline || block.title ? `<h2 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#1f2937;">${formatDraftText(block.headline || block.title)}</h2>` : ""}
      ${block.body || block.content ? `<div style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#475569;">${formatDraftRichText(block.body || block.content)}</div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">${items}</div>
    </section>
  `;
}

function renderDraftProductGallery(block: ContentBlock) {
  const galleryItems = Array.isArray(block.galleryItems)
    ? block.galleryItems
    : [];
  const cards = galleryItems
    .map((item) => {
      const itemRecord = toRecord(item);
      const imageUrl =
        typeof itemRecord.imageUrl === "string"
          ? itemRecord.imageUrl
          : typeof itemRecord.image_url === "string"
            ? itemRecord.image_url
            : "";
      const title =
        typeof itemRecord.title === "string"
          ? itemRecord.title
          : typeof itemRecord.name === "string"
            ? itemRecord.name
            : "Featured product";
      const description =
        typeof itemRecord.description === "string"
          ? itemRecord.description
          : typeof itemRecord.body === "string"
            ? itemRecord.body
            : "";
      const price =
        typeof itemRecord.price === "string" ? itemRecord.price : "";
      const url =
        typeof itemRecord.url === "string"
          ? itemRecord.url
          : typeof itemRecord.buttonUrl === "string"
            ? itemRecord.buttonUrl
            : typeof itemRecord.ctaUrl === "string"
              ? itemRecord.ctaUrl
              : "";
      const buttonText =
        typeof itemRecord.buttonText === "string"
          ? itemRecord.buttonText
          : typeof itemRecord.ctaText === "string"
            ? itemRecord.ctaText
            : block.ctaText || "Learn more";

      return `
        <article style="padding:18px;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;">
          ${renderDraftImage(imageUrl, title, 180)}
          <h3 style="margin:0 0 10px;font-size:18px;line-height:1.3;color:#1f2937;">${formatDraftText(title)}</h3>
          ${price ? `<div style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1f4f3f;">${formatDraftText(price)}</div>` : ""}
          ${description ? `<div style="font-size:14px;line-height:1.6;color:#475569;">${formatDraftRichText(description)}</div>` : ""}
          ${renderDraftButton(buttonText, url, block.buttonColor || "#1f4f3f")}
        </article>
      `;
    })
    .filter(Boolean)
    .join("");

  if (!cards) {
    return renderDraftTextBlock(block);
  }

  return `
    <section style="padding:28px 32px;margin:0 0 20px;border-radius:24px;background:#ffffff;box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);">
      ${block.headline || block.title ? `<h2 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#1f2937;">${formatDraftText(block.headline || block.title)}</h2>` : ""}
      ${block.body || block.content ? `<div style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#475569;">${formatDraftRichText(block.body || block.content)}</div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">${cards}</div>
    </section>
  `;
}

function renderDraftBlock(block: ContentBlock) {
  switch (block.type) {
    case "divider":
      return `<section style="padding:8px 0 24px;"><hr style="border:0;border-top:1px solid #d9e2ec;" /></section>`;
    case "button":
      return `
        <section style="padding:28px 32px;margin:0 0 20px;border-radius:24px;background:#ffffff;box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);text-align:${block.alignment || "center"};">
          ${block.heading || block.title ? `<h2 style="margin:0 0 12px;font-size:24px;color:#1f2937;">${formatDraftText(block.heading || block.title)}</h2>` : ""}
          ${block.body || block.content ? `<div style="font-size:16px;line-height:1.7;color:#475569;">${formatDraftRichText(block.body || block.content)}</div>` : ""}
          ${renderDraftButton(block.buttonText || block.ctaText, block.buttonUrl || block.ctaUrl, block.buttonColor || "#1f4f3f")}
        </section>
      `;
    case "image-gallery":
      return renderDraftGallery(block);
    case "product-gallery":
      return renderDraftProductGallery(block);
    case "quote":
      return `
        <section style="padding:28px 32px;margin:0 0 20px;border-radius:24px;background:#0f172a;color:#f8fafc;box-shadow:0 10px 28px rgba(15, 23, 42, 0.14);">
          <blockquote style="margin:0;font-size:22px;line-height:1.5;">${formatDraftRichText(block.quote || block.body || block.content)}</blockquote>
          ${block.author || block.authorTitle ? `<div style="margin-top:16px;font-size:14px;opacity:0.82;">${formatDraftText([block.author, block.authorTitle].filter(Boolean).join(" · "))}</div>` : ""}
        </section>
      `;
    case "footer":
      return `
        <section style="padding:24px 32px;margin:0 0 20px;border-radius:24px;background:#e2e8f0;color:#334155;">
          <div style="font-size:14px;line-height:1.7;">${formatDraftRichText(block.content || block.body || "Footer details")}</div>
        </section>
      `;
    default:
      return renderDraftTextBlock(block);
  }
}

// Draft preview HTML only. This intentionally excludes send-time footer,
// tracked links, and merge-tag resolution.
export function renderDraftPreviewHtml(blocks: ContentBlock[]) {
  const visibleBlocks = blocks.filter((block) => block.visible !== false);
  if (visibleBlocks.length === 0) {
    return "";
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Campaign draft preview</title>
  </head>
  <body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:720px;margin:0 auto;">
      ${visibleBlocks.map((block) => renderDraftBlock(block)).join("")}
    </div>
  </body>
</html>`;
}

async function getAuthenticatedWriterContext() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: userRecord, error: userRecordError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userRecordError) {
    throw userRecordError;
  }

  if (!userRecord?.tenant_id) {
    throw new Error("User tenant not found");
  }

  return {
    userId: user.id,
    tenantId: userRecord.tenant_id,
  };
}

function buildCampaignMetadata(
  existingMetadata: Record<string, unknown>,
  input: PersistCampaignRecordInput,
) {
  return {
    ...existingMetadata,
    ...(input.metadata ?? {}),
    campaignType: input.campaignType,
    replyTo: input.replyTo,
    smsMessage: input.smsMessage,
    contentBlocks: input.contentBlocks,
    sourceSegmentId: input.sourceSegmentId,
    sourcePersonaId: input.sourcePersonaId,
  } satisfies Record<string, unknown>;
}

async function syncCampaignBlocksBackup(
  campaignId: string,
  contentBlocks: ContentBlock[],
) {
  const { error: deleteError } = await supabase
    .from("campaign_blocks")
    .delete()
    .eq("campaign_id", campaignId);

  if (deleteError) {
    throw deleteError;
  }

  if (contentBlocks.length === 0) {
    return;
  }

  const blockRows = contentBlocks.map((block, index) => ({
    campaign_id: campaignId,
    ...normalizeBlockForSave(block, index),
  }));

  const { error: insertError } = await supabase
    .from("campaign_blocks")
    .insert(blockRows);

  if (insertError) {
    throw insertError;
  }
}

export async function persistCampaignRecord(input: PersistCampaignRecordInput) {
  const { tenantId, userId } = await getAuthenticatedWriterContext();
  const contentBlocks = normalizeInputBlocks(input.contentBlocks);
  const content =
    input.campaignType === "sms"
      ? input.smsMessage
      : contentBlocks.length > 0
        ? renderDraftPreviewHtml(contentBlocks)
        : (input.legacyContentHtml?.trim() ?? "");
  const nowIso = new Date().toISOString();

  const basePayload = {
    name: input.name.trim() || "Untitled Campaign",
    subject_line: input.subjectLine,
    preheader_text: input.preheaderText,
    preheader: input.preheaderText,
    sender_name: input.senderName,
    sender_display_name: input.senderName,
    sender_email: input.senderEmail,
    actual_sender_email: input.senderEmail,
    from_email_domain_id: input.fromEmailDomainId ?? null,
    // Draft preview HTML only. This is intentionally not send-accurate.
    content,
    status: input.status ?? "draft",
    scheduled_at:
      input.sendImmediately === false ? (input.sendAt ?? null) : null,
    send_blocked_reason: null,
    source_content_task_id: input.sourceContentTaskId ?? null,
    segment_id: input.segmentIds?.[0] ?? null,
    persona_ids: input.personaIds ?? [],
    updated_at: nowIso,
  };

  let campaignRow: CampaignRow | null = null;
  let existingMetadata: Record<string, unknown> = {};

  if (input.campaignId) {
    const { data: existingRow, error: existingRowError } = await supabase
      .from("crm_campaigns")
      .select("*")
      .eq("id", input.campaignId)
      .maybeSingle();

    if (existingRowError) {
      throw existingRowError;
    }

    if (!existingRow) {
      throw new Error("Campaign not found or you do not have access");
    }

    if (
      input.expectedUpdatedAt &&
      existingRow.updated_at &&
      existingRow.updated_at !== input.expectedUpdatedAt
    ) {
      throw new CampaignDraftConflictError(existingRow.updated_at);
    }

    existingMetadata = toRecord(existingRow.metadata);
    const updatePayload: Database["public"]["Tables"]["crm_campaigns"]["Update"] =
      {
        ...basePayload,
        metadata: buildCampaignMetadata(existingMetadata, {
          ...input,
          contentBlocks,
        }),
      };

    let updateQuery = supabase
      .from("crm_campaigns")
      .update(updatePayload)
      .eq("id", input.campaignId);

    if (existingRow.updated_at) {
      updateQuery = updateQuery.eq("updated_at", existingRow.updated_at);
    }

    const { data: updatedRows, error: updateError } =
      await updateQuery.select("*");

    if (updateError) {
      throw updateError;
    }

    campaignRow = Array.isArray(updatedRows)
      ? ((updatedRows[0] as CampaignRow | undefined) ?? null)
      : null;

    if (!campaignRow) {
      const { data: currentRow } = await supabase
        .from("crm_campaigns")
        .select("updated_at")
        .eq("id", input.campaignId)
        .maybeSingle();

      throw new CampaignDraftConflictError(currentRow?.updated_at ?? null);
    }
  } else {
    const insertPayload: Database["public"]["Tables"]["crm_campaigns"]["Insert"] =
      {
        tenant_id: tenantId,
        user_id: userId,
        name: basePayload.name,
        subject_line: basePayload.subject_line,
        preheader_text: basePayload.preheader_text,
        preheader: basePayload.preheader,
        sender_name: basePayload.sender_name,
        sender_display_name: basePayload.sender_display_name,
        sender_email: basePayload.sender_email,
        actual_sender_email: basePayload.actual_sender_email,
        from_email_domain_id: basePayload.from_email_domain_id,
        content: basePayload.content,
        status: basePayload.status,
        scheduled_at: basePayload.scheduled_at,
        send_blocked_reason: basePayload.send_blocked_reason,
        source_content_task_id: basePayload.source_content_task_id,
        segment_id: basePayload.segment_id,
        persona_ids: basePayload.persona_ids,
        metadata: buildCampaignMetadata({}, { ...input, contentBlocks }),
        metrics: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          revenue: 0,
        },
        updated_at: nowIso,
      };

    const { data: insertedRow, error: insertError } = await supabase
      .from("crm_campaigns")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    campaignRow = insertedRow as CampaignRow;
  }

  try {
    await syncCampaignBlocksBackup(campaignRow.id, contentBlocks);
  } catch (error) {
    console.warn(
      "campaign_blocks backup sync failed; metadata.contentBlocks remains authoritative",
      error,
    );
  }

  return {
    campaign: campaignRow,
    tenantId,
    userId,
    contentBlocks,
  };
}

export async function writeCampaignDraftSnapshot(params: {
  campaignId: string;
  campaignType: "email" | "sms";
  trigger: DraftSnapshotTrigger;
  subjectLine: string;
  preheaderText: string;
  smsMessage: string;
  contentBlocks: ContentBlock[];
  segmentIds: string[];
  personaIds: string[];
}) {
  const { tenantId, userId } = await getAuthenticatedWriterContext();
  const recipientIds = await resolveAudienceRecipientIds({
    tenantId,
    segmentIds: params.segmentIds,
    personaIds: params.personaIds,
  });

  const { data: latestSnapshots, error: latestSnapshotsError } = await supabase
    .from("draft_snapshots")
    .select("version")
    .eq("tenant_id", tenantId)
    .eq("doc_type", "newsletter")
    .eq("doc_id", params.campaignId)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1);

  if (latestSnapshotsError) {
    throw latestSnapshotsError;
  }

  const nextVersion = (latestSnapshots?.[0]?.version ?? 0) + 1;
  const snapshotContent = {
    campaignId: params.campaignId,
    campaignType: params.campaignType,
    trigger: params.trigger,
    capturedAt: new Date().toISOString(),
    subjectLine: params.subjectLine,
    preheaderText: params.preheaderText,
    smsMessage: params.smsMessage,
    contentBlocks: params.contentBlocks,
    segmentIds: params.segmentIds,
    personaIds: params.personaIds,
    recipientIds,
  };

  const { error: insertError } = await supabase.from("draft_snapshots").insert({
    user_id: userId,
    tenant_id: tenantId,
    doc_type: "newsletter",
    doc_id: params.campaignId,
    version: nextVersion,
    content: snapshotContent,
  });

  if (insertError) {
    throw insertError;
  }

  const { data: staleSnapshots, error: staleSnapshotsError } = await supabase
    .from("draft_snapshots")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("doc_type", "newsletter")
    .eq("doc_id", params.campaignId)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .range(10, 200);

  if (staleSnapshotsError) {
    throw staleSnapshotsError;
  }

  const staleIds = (staleSnapshots ?? []).map((snapshot) => snapshot.id);
  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("draft_snapshots")
      .delete()
      .in("id", staleIds);

    if (deleteError) {
      throw deleteError;
    }
  }
}
