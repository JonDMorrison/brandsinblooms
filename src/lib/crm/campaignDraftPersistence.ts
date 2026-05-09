import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { resolveAudienceRecipientIds } from "@/lib/computeAudienceRecipientCount";
import type { ContentBlock } from "@/types/emailBuilder";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import {
  ensureFooterBlockCompliance,
  type FooterCompanyProfile,
} from "@/lib/studio/footerCompliance";
import type { StudioBlock } from "@/types/studioBlocks";
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
  contentBlocks: StudioBlock[];
  smsMessage: string;
  sendAt?: string | null;
  sendImmediately?: boolean;
  includeAllCustomers?: boolean;
  additionalCustomerIds?: string[];
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

type PostgrestLikeError =
  | {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    }
  | null
  | undefined;

function isMissingCampaignAudienceColumnError(error: PostgrestLikeError) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    code === "42703" ||
    code === "pgrst204" ||
    ((message.includes("schema cache") ||
      message.includes("could not find the") ||
      message.includes("does not exist")) &&
      (message.includes("additional_customer_ids") ||
        message.includes("include_all_customers")))
  );
}

function omitCampaignAudienceColumns<T extends Record<string, unknown>>(
  payload: T,
) {
  const {
    include_all_customers: _includeAllCustomers,
    additional_customer_ids: _additionalCustomerIds,
    ...legacyPayload
  } = payload as T & {
    include_all_customers?: unknown;
    additional_customer_ids?: unknown;
  };

  return legacyPayload;
}

let campaignAudienceColumnsSupported: boolean | null = null;

function rowHasCampaignAudienceColumns(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(row, "include_all_customers") &&
    Object.prototype.hasOwnProperty.call(row, "additional_customer_ids")
  );
}

function rememberCampaignAudienceColumnSupport(row: unknown) {
  campaignAudienceColumnsSupported = rowHasCampaignAudienceColumns(row);
}

function markCampaignAudienceColumnsUnsupported() {
  campaignAudienceColumnsSupported = false;
}

function getCompatibleCampaignPayload<T extends Record<string, unknown>>(
  payload: T,
) {
  return campaignAudienceColumnsSupported === false
    ? omitCampaignAudienceColumns(payload)
    : payload;
}

export type DraftSnapshotTrigger = "review" | "pre-send" | "manual";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeInputBlocks(
  blocks: Array<StudioBlock | Record<string, unknown>>,
) {
  return blocks.flatMap((block, index) => {
    if (!block || typeof block !== "object") {
      return [] as StudioBlock[];
    }

    const candidate = block as Record<string, unknown>;
    if (typeof candidate.type === "string") {
      return [
        {
          ...candidate,
          id:
            typeof candidate.id === "string" && candidate.id.trim().length > 0
              ? candidate.id
              : `content-block-${index}`,
          order: typeof candidate.order === "number" ? candidate.order : index,
          visible: candidate.visible !== false,
        } as StudioBlock,
      ];
    }

    return [] as StudioBlock[];
  });
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function renderEmptyDraftPreviewHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Campaign draft preview</title>
  </head>
  <body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial, Helvetica, sans-serif;">
    <div style="max-width:720px;margin:0 auto;padding:32px;border-radius:24px;background:#ffffff;box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);color:#475569;">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#0f172a;">Campaign draft preview</h1>
      <p style="margin:0;font-size:16px;line-height:1.7;">No content blocks have been added yet.</p>
    </div>
  </body>
</html>`;
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

// Mirrors the send-time renderer in
// supabase/functions/_shared/campaignEmailSource.ts → renderSocialFollowBlock
// so the draft preview iframe shows the same social-icon row that recipients
// will see. Icons are served from the public bloomsuite.app/social-icons
// path. MUST stay in sync with the keys in
// supabase/functions/_shared/footerGenerator.ts → socialIcons.
const DRAFT_SOCIAL_ICON_BASE = "https://bloomsuite.app/social-icons";
const DRAFT_SOCIAL_PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "pinterest", label: "Pinterest" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
];

function renderDraftSocialFollow(block: ContentBlock): string {
  const links = (block as ContentBlock).socialLinks || {};
  const platforms = DRAFT_SOCIAL_PLATFORMS.filter((p) => {
    const entry = links[p.key];
    return (
      entry &&
      entry.enabled === true &&
      typeof entry.url === "string" &&
      entry.url.length > 0
    );
  });

  if (platforms.length === 0) return "";

  const iconsHtml = platforms
    .map((p) => {
      const url = links[p.key]!.url;
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="${DRAFT_SOCIAL_ICON_BASE}/${p.key}.png" alt="${p.label}" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" /></a>`;
    })
    .join("");

  const backgroundColor = block.backgroundColor || "#ffffff";
  const textColor = block.textColor || "#1f2937";
  const heading = block.headline || block.title;

  return `
    <section style="padding:24px 32px;margin:0 0 20px;border-radius:24px;background:${backgroundColor};text-align:center;box-shadow:0 10px 28px rgba(15, 23, 42, 0.08);">
      ${heading ? `<h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:${textColor};">${formatDraftText(heading)}</h2>` : ""}
      <div>${iconsHtml}</div>
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
    case "social-follow":
      return renderDraftSocialFollow(block);
    default:
      return renderDraftTextBlock(block);
  }
}

export function renderDraftPreviewHtml(
  blocks: StudioBlock[],
  subjectLine = "Campaign draft preview",
  preheaderText = "",
) {
  const visibleBlocks = blocks.filter((block) => block.visible !== false);
  if (visibleBlocks.length === 0) {
    return "";
  }

  const footerBlock =
    visibleBlocks.find((block) => block.type === "footer") ?? null;

  return generateEmailHtml({
    blocks: visibleBlocks,
    subject: subjectLine || "Campaign draft preview",
    previewText: preheaderText,
    footer: footerBlock,
  });
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
    includeAllCustomers: input.includeAllCustomers ?? false,
    additionalCustomerIds: input.additionalCustomerIds ?? [],
    sourceSegmentId: input.sourceSegmentId,
    sourcePersonaId: input.sourcePersonaId,
    contentBlocks: input.contentBlocks,
  } satisfies Record<string, unknown>;
}

function buildCampaignBlockRows(
  campaignId: string,
  contentBlocks: StudioBlock[],
): Database["public"]["Tables"]["campaign_blocks"]["Insert"][] {
  return contentBlocks.map((block, index) => {
    const record = block as Record<string, unknown>;
    const headline =
      typeof record.headline === "string"
        ? record.headline
        : typeof record.title === "string"
          ? record.title
          : null;
    const imageUrl =
      typeof record.imageUrl === "string"
        ? record.imageUrl
        : typeof record.backgroundImageUrl === "string"
          ? record.backgroundImageUrl
          : null;
    const ctaText =
      typeof record.buttonText === "string"
        ? record.buttonText
        : typeof record.ctaText === "string"
          ? record.ctaText
          : null;
    const ctaUrl =
      typeof record.buttonUrl === "string"
        ? record.buttonUrl
        : typeof record.ctaUrl === "string"
          ? record.ctaUrl
          : null;
    const source =
      typeof record.source === "string" && record.source.length > 0
        ? record.source
        : "manual";
    const personaTag =
      typeof record.personaTag === "string"
        ? record.personaTag
        : typeof record.persona_tag === "string"
          ? record.persona_tag
          : null;

    return {
      campaign_id: campaignId,
      block_type: block.type,
      content: toJsonSafe(record),
      headline,
      image_url: imageUrl,
      cta_text: ctaText,
      cta_url: ctaUrl,
      source,
      persona_tag: personaTag,
      order_index: typeof record.order === "number" ? record.order : index,
    };
  });
}

async function syncCampaignBlocksBackup(
  campaignId: string,
  contentBlocks: StudioBlock[],
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

  const rows = buildCampaignBlockRows(campaignId, contentBlocks);
  const { error: insertError } = await supabase
    .from("campaign_blocks")
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}

async function loadWriterCompanyProfile(userId: string) {
  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      `
      company_name,
      company_email,
      company_phone,
      website_url,
      street_address,
      city,
      state_province,
      postal_code,
      country,
      location_info,
      email_domain,
      brand_primary_color,
      brand_secondary_color,
      brand_accent_color,
      brand_text_color,
      facebook_url,
      instagram_url,
      tiktok_url,
      pinterest_url,
      youtube_url,
      linkedin_url,
      footer_legal_text,
      feature_flags
      `,
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load company profile for footer injection", error);
    return null;
  }

  return (data as FooterCompanyProfile | null) ?? null;
}

export async function persistCampaignRecord(input: PersistCampaignRecordInput) {
  const { tenantId, userId } = await getAuthenticatedWriterContext();
  const rawContentBlocks = normalizeInputBlocks(input.contentBlocks);
  const companyProfile =
    input.campaignType === "email"
      ? await loadWriterCompanyProfile(userId)
      : null;
  const contentBlocks = toJsonSafe(
    input.campaignType === "email"
      ? ensureFooterBlockCompliance(rawContentBlocks, {
          companyProfile,
        })
      : rawContentBlocks,
  );
  const content =
    input.campaignType === "sms"
      ? input.smsMessage
      : renderDraftPreviewHtml(
          contentBlocks,
          input.subjectLine,
          input.preheaderText,
        ) ||
        input.legacyContentHtml?.trim() ||
        renderEmptyDraftPreviewHtml();
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
    include_all_customers: input.includeAllCustomers ?? false,
    additional_customer_ids: input.additionalCustomerIds ?? [],
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

    rememberCampaignAudienceColumnSupport(existingRow);

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

    const runUpdate = async (
      payload: Database["public"]["Tables"]["crm_campaigns"]["Update"],
    ) => {
      let updateQuery = supabase
        .from("crm_campaigns")
        .update(payload)
        .eq("id", input.campaignId);

      if (existingRow.updated_at) {
        updateQuery = updateQuery.eq("updated_at", existingRow.updated_at);
      }

      return await updateQuery.select("*");
    };

    const usesLegacyAudiencePayload =
      campaignAudienceColumnsSupported === false;
    let { data: updatedRows, error: updateError } = await runUpdate(
      getCompatibleCampaignPayload(
        updatePayload,
      ) as Database["public"]["Tables"]["crm_campaigns"]["Update"],
    );

    if (
      updateError &&
      isMissingCampaignAudienceColumnError(updateError) &&
      !usesLegacyAudiencePayload
    ) {
      markCampaignAudienceColumnsUnsupported();
      ({ data: updatedRows, error: updateError } = await runUpdate(
        omitCampaignAudienceColumns(
          updatePayload,
        ) as Database["public"]["Tables"]["crm_campaigns"]["Update"],
      ));
    }

    if (updateError) {
      throw updateError;
    }

    if (!usesLegacyAudiencePayload) {
      campaignAudienceColumnsSupported = true;
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
        include_all_customers: basePayload.include_all_customers,
        additional_customer_ids: basePayload.additional_customer_ids,
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

    const usesLegacyAudiencePayload =
      campaignAudienceColumnsSupported === false;
    const runInsert = async (
      payload: Database["public"]["Tables"]["crm_campaigns"]["Insert"],
    ) => {
      return await supabase
        .from("crm_campaigns")
        .insert(payload)
        .select("*")
        .single();
    };

    let { data: insertedRow, error: insertError } = await runInsert(
      getCompatibleCampaignPayload(
        insertPayload,
      ) as Database["public"]["Tables"]["crm_campaigns"]["Insert"],
    );

    if (
      insertError &&
      isMissingCampaignAudienceColumnError(insertError) &&
      !usesLegacyAudiencePayload
    ) {
      markCampaignAudienceColumnsUnsupported();
      ({ data: insertedRow, error: insertError } = await runInsert(
        omitCampaignAudienceColumns(
          insertPayload,
        ) as Database["public"]["Tables"]["crm_campaigns"]["Insert"],
      ));
    }

    if (insertError) {
      throw insertError;
    }

    if (!usesLegacyAudiencePayload) {
      campaignAudienceColumnsSupported = true;
    }

    campaignRow = insertedRow as CampaignRow;
  }

  await syncCampaignBlocksBackup(campaignRow.id, contentBlocks);

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
  contentBlocks: StudioBlock[];
  includeAllCustomers?: boolean;
  additionalCustomerIds?: string[];
  segmentIds: string[];
  personaIds: string[];
}) {
  const { tenantId, userId } = await getAuthenticatedWriterContext();
  const recipientIds = await resolveAudienceRecipientIds({
    tenantId,
    includeAllCustomers: params.includeAllCustomers,
    additionalCustomerIds: params.additionalCustomerIds,
    fallbackToAllCustomers:
      !params.includeAllCustomers &&
      (params.additionalCustomerIds?.length ?? 0) === 0 &&
      params.segmentIds.length === 0 &&
      params.personaIds.length === 0,
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
    includeAllCustomers: params.includeAllCustomers ?? false,
    additionalCustomerIds: params.additionalCustomerIds ?? [],
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
