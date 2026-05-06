import {
  createFooterBlockFromProfile,
  generateEmailHtml,
  type EmailFooterLinks,
  type StudioFooterProfile,
} from "../../../src/lib/studio/emailHtmlGenerator.ts";
import type { StudioBlock } from "../../../src/types/studioBlocks.ts";
import {
  resolveDesignSystem,
  type ServerCompanyProfileShape,
} from "./resolveDesignSystem.ts";

export type RenderableContentBlock = Record<string, unknown> & {
  id?: string;
  type?: string;
  order?: number;
};

export type CampaignEmailSource = {
  html: string;
  contentBlocks: RenderableContentBlock[];
  source:
    | "campaign_blocks"
    | "campaign.metadata"
    | "campaign.content"
    | "campaign.content_json";
  warning?: string;
};

type CampaignSourceClient = {
  from?: (table: string) => {
    select?: (columns: string) => {
      eq?: (
        column: string,
        value: string,
      ) => {
        order?: (
          column: string,
          options?: { ascending?: boolean },
        ) => Promise<{ data?: unknown[] | null; error?: unknown }>;
      };
    };
  };
};

type RenderContentBlocksOptions = {
  subject?: string;
  previewText?: string;
  companyProfile?: (StudioFooterProfile & ServerCompanyProfileShape) | null;
  footerLinks?: EmailFooterLinks;
};

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {
    return getRecord(value);
  }

  try {
    return getRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function getBlockArray(value: unknown): RenderableContentBlock[] {
  if (Array.isArray(value)) {
    return value.filter((item) => getRecord(item)) as RenderableContentBlock[];
  }

  const record = parseJsonRecord(value);
  if (!record) {
    return [];
  }

  const candidates = [
    record.blocks,
    record.contentBlocks,
    record.studioBlocks,
    record.emailBlocks,
    getRecord(record.studio)?.blocks,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) =>
        getRecord(item),
      ) as RenderableContentBlock[];
    }
  }

  return [];
}

function normalizeBlockType(type: unknown) {
  const value = typeof type === "string" ? type : "plain-text";

  switch (value) {
    case "header":
      return "email-safe-hero";
    case "image":
      return "full-width-image";
    case "text":
      return "plain-text";
    case "button":
    case "cta":
      return "call-to-action";
    case "product":
      return "product-card";
    default:
      return value;
  }
}

function normalizeContentBlock(
  block: RenderableContentBlock,
  index: number,
): StudioBlock {
  const record = getRecord(block.content) || getRecord(block.data) || block;
  const normalized: Record<string, unknown> = {
    ...record,
    id:
      typeof block.id === "string"
        ? block.id
        : typeof record.id === "string"
          ? record.id
          : `content-block-${index}`,
    type: normalizeBlockType(record.type ?? block.type),
    label:
      typeof record.label === "string"
        ? record.label
        : typeof block.type === "string"
          ? block.type
          : "Content Block",
    order:
      typeof block.order === "number"
        ? block.order
        : typeof record.order === "number"
          ? record.order
          : index,
    visible: record.visible !== false,
  };

  if (!normalized.body && typeof record.content === "string") {
    normalized.body = record.content;
  }

  if (!normalized.headline && typeof record.title === "string") {
    normalized.headline = record.title;
  }

  if (!normalized.imageUrl && typeof record.image_url === "string") {
    normalized.imageUrl = record.image_url;
  }

  if (!normalized.buttonText && typeof record.cta_text === "string") {
    normalized.buttonText = record.cta_text;
  }

  if (!normalized.buttonUrl && typeof record.cta_url === "string") {
    normalized.buttonUrl = record.cta_url;
  }

  return normalized as unknown as StudioBlock;
}

export function normalizeContentBlocks(
  blocks: RenderableContentBlock[] | null | undefined,
): StudioBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map(normalizeContentBlock)
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}

export function renderContentBlocksToEmailHtml(
  blocks: RenderableContentBlock[] | null | undefined,
  options: RenderContentBlocksOptions = {},
): string {
  const normalizedBlocks = normalizeContentBlocks(blocks);
  const designSystem = resolveDesignSystem(options.companyProfile ?? null);

  if (normalizedBlocks.length === 0) {
    return "";
  }

  const footerBlock =
    normalizedBlocks.find((block) => block.type === "footer") ||
    createFooterBlockFromProfile(options.companyProfile ?? null);

  return generateEmailHtml({
    blocks: normalizedBlocks,
    subject: options.subject || "Campaign",
    previewText: options.previewText || "",
    footer: footerBlock,
    footerLinks: options.footerLinks,
    designSystem,
  });
}

async function loadCampaignBlockRows(
  client: unknown,
  campaignId: string | null | undefined,
): Promise<RenderableContentBlock[]> {
  if (!campaignId) {
    return [];
  }

  const sourceClient = client as CampaignSourceClient;
  const order = sourceClient
    .from?.("campaign_blocks")
    .select?.("*")
    .eq?.("campaign_id", campaignId).order;

  if (!order) {
    return [];
  }

  const { data, error } = await order("order_index", { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.filter((item) => getRecord(item)) as RenderableContentBlock[];
}

export async function resolveCampaignEmailSource(
  client: unknown,
  campaign: {
    id?: string | null;
    metadata?: unknown;
    content?: string | null;
    subject_line?: string | null;
    preheader_text?: string | null;
    preheader?: string | null;
  },
): Promise<CampaignEmailSource> {
  const previewText = campaign.preheader_text || campaign.preheader || "";

  const databaseBlocks = await loadCampaignBlockRows(client, campaign.id);
  if (databaseBlocks.length > 0) {
    return {
      html: renderContentBlocksToEmailHtml(databaseBlocks, {
        subject: campaign.subject_line || "Campaign",
        previewText,
      }),
      contentBlocks: databaseBlocks,
      source: "campaign_blocks",
    };
  }

  const metadataBlocks = getBlockArray(campaign.metadata);
  if (metadataBlocks.length > 0) {
    return {
      html: renderContentBlocksToEmailHtml(metadataBlocks, {
        subject: campaign.subject_line || "Campaign",
        previewText,
      }),
      contentBlocks: metadataBlocks,
      source: "campaign.metadata",
    };
  }

  const contentRecord = parseJsonRecord(campaign.content);
  const contentBlocks = getBlockArray(contentRecord || campaign.content);
  if (contentBlocks.length > 0) {
    return {
      html: renderContentBlocksToEmailHtml(contentBlocks, {
        subject: campaign.subject_line || "Campaign",
        previewText,
      }),
      contentBlocks,
      source: "campaign.content_json",
    };
  }

  const htmlFromJson =
    typeof contentRecord?.html === "string"
      ? contentRecord.html.trim()
      : typeof contentRecord?.body === "string"
        ? contentRecord.body.trim()
        : "";
  const storedHtml =
    htmlFromJson ||
    (typeof campaign.content === "string" ? campaign.content.trim() : "");

  return {
    html: storedHtml,
    contentBlocks: [],
    source: "campaign.content",
    warning:
      storedHtml.length > 0
        ? undefined
        : "Campaign builder content is unavailable; using stored campaign HTML only.",
  };
}
