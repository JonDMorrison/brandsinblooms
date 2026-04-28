import { resolveImageSrcToHttps } from "./emailImageUrl.ts";

export interface RenderableGalleryImage {
  id?: string;
  url: string;
  alt?: string;
  caption?: string;
}

export interface RenderableGalleryItem {
  id?: string;
  title?: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  buttonText?: string;
  url?: string;
}

export interface RenderableContentBlock {
  id: string;
  type: string;
  headline?: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  body?: string;
  content?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
  altText?: string;
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  alignment?: string;
  layout?: string;
  quote?: string;
  author?: string;
  authorTitle?: string;
  galleryImages?: RenderableGalleryImage[];
  galleryItems?: RenderableGalleryItem[];
}

export interface CampaignEmailSource {
  source:
    | "metadata-content-blocks"
    | "campaign-blocks"
    | "content-json-blocks"
    | "legacy-html"
    | "empty";
  html: string;
  contentBlocks: RenderableContentBlock[];
  usedLegacyHtml: boolean;
  warning?: string;
}

type CampaignSourceClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    const parsed = safeParseJson(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  return {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return undefined;
}

function escapeAttribute(value: string | undefined): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtmlText(value: string | undefined): string {
  if (!value) return "";
  return value.includes("<") ? value : value.replace(/\n/g, "<br />");
}

function normalizeGalleryImages(value: unknown): RenderableGalleryImage[] {
  return toArray(value).flatMap((entry) => {
    const record = toRecord(entry);
    const url = resolveImageSrcToHttps(
      stringValue(record.url, record.imageUrl, record.image_url, record.src) ??
        null,
    );
    if (!url) return [];

    return [
      {
        id: stringValue(record.id),
        url,
        alt: stringValue(
          record.alt,
          record.altText,
          record.alt_text,
          record.title,
        ),
        caption: stringValue(record.caption, record.title),
      } satisfies RenderableGalleryImage,
    ];
  });
}

function normalizeGalleryItems(value: unknown): RenderableGalleryItem[] {
  return toArray(value)
    .map((entry) => {
      const record = toRecord(entry);
      const imageUrl = resolveImageSrcToHttps(
        stringValue(
          record.imageUrl,
          record.image_url,
          record.url,
          record.src,
        ) ?? null,
      );

      return {
        id: stringValue(record.id),
        title: stringValue(record.title, record.name, record.headline),
        description: stringValue(
          record.description,
          record.body,
          record.subtitle,
        ),
        price: stringValue(record.price, record.priceLabel),
        imageUrl: imageUrl || undefined,
        buttonText: stringValue(
          record.buttonText,
          record.ctaText,
          record.button_label,
        ),
        url: stringValue(record.url, record.buttonUrl, record.ctaUrl),
      } satisfies RenderableGalleryItem;
    })
    .filter((entry) =>
      Boolean(entry.imageUrl || entry.title || entry.description || entry.url),
    );
}

function normalizeContentBlock(
  raw: unknown,
  index: number,
): RenderableContentBlock | null {
  const record = toRecord(raw);
  if (Object.keys(record).length === 0) return null;

  const nested = toRecord(record.content);
  const rawContentString =
    typeof record.content === "string" ? record.content : undefined;
  const type =
    stringValue(record.type, record.block_type, nested.type) || "text";
  const imageUrl =
    resolveImageSrcToHttps(
      stringValue(
        record.imageUrl,
        record.image_url,
        nested.imageUrl,
        nested.image_url,
      ) ?? null,
    ) || undefined;
  const backgroundImageUrl =
    resolveImageSrcToHttps(
      stringValue(
        record.backgroundImageUrl,
        nested.backgroundImageUrl,
        record.background_image_url,
      ) ?? null,
    ) || undefined;

  return {
    id: stringValue(record.id, nested.id) || `${type}-${index}`,
    type,
    headline: stringValue(
      record.headline,
      nested.headline,
      record.heading,
      nested.heading,
    ),
    title: stringValue(record.title, nested.title),
    subtitle: stringValue(
      record.subtitle,
      nested.subtitle,
      record.preheader,
      nested.preheader,
    ),
    eyebrow: stringValue(
      record.eyebrow,
      nested.eyebrow,
      record.kicker,
      nested.kicker,
    ),
    body: stringValue(
      record.body,
      nested.body,
      record.text,
      nested.text,
      record.description,
      nested.description,
      rawContentString,
    ),
    content: stringValue(
      record.html,
      nested.html,
      record.contentHtml,
      nested.contentHtml,
      rawContentString,
    ),
    imageUrl,
    backgroundImageUrl,
    altText: stringValue(
      record.altText,
      nested.altText,
      record.alt_text,
      nested.alt_text,
      record.title,
      nested.title,
    ),
    caption: stringValue(record.caption, nested.caption),
    backgroundColor: stringValue(
      record.backgroundColor,
      nested.backgroundColor,
      record.background_color,
      nested.background_color,
    ),
    textColor: stringValue(
      record.textColor,
      nested.textColor,
      record.text_color,
      nested.text_color,
    ),
    buttonText: stringValue(
      record.buttonText,
      nested.buttonText,
      record.ctaText,
      nested.ctaText,
      record.cta_text,
      nested.cta_text,
    ),
    buttonUrl: stringValue(
      record.buttonUrl,
      nested.buttonUrl,
      record.ctaUrl,
      nested.ctaUrl,
      record.cta_url,
      nested.cta_url,
    ),
    alignment: stringValue(
      record.alignment,
      nested.alignment,
      record.textAlign,
      nested.textAlign,
    ),
    layout: stringValue(record.layout, nested.layout),
    quote: stringValue(record.quote, nested.quote, record.body, nested.body),
    author: stringValue(record.author, nested.author),
    authorTitle: stringValue(
      record.authorTitle,
      nested.authorTitle,
      record.author_title,
      nested.author_title,
    ),
    galleryImages: normalizeGalleryImages(
      record.galleryImages ??
        nested.galleryImages ??
        record.images ??
        nested.images,
    ),
    galleryItems: normalizeGalleryItems(
      record.galleryItems ??
        nested.galleryItems ??
        record.products ??
        nested.products,
    ),
  };
}

function renderBlockHeading(
  block: RenderableContentBlock,
  color: string,
): string {
  const eyebrow = block.eyebrow
    ? `<div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${color};opacity:0.75;margin-bottom:8px;">${toHtmlText(block.eyebrow)}</div>`
    : "";
  const headline = block.headline || block.title;
  const heading = headline
    ? `<h2 style="margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:700;color:${color};">${toHtmlText(headline)}</h2>`
    : "";
  const subtitle = block.subtitle
    ? `<div style="font-size:16px;line-height:1.5;color:${color};opacity:0.92;">${toHtmlText(block.subtitle)}</div>`
    : "";

  return `${eyebrow}${heading}${subtitle}`;
}

const BLOCK_COLLECTION_KEYS = [
  "contentBlocks",
  "content_blocks",
  "blocks",
  "layout_json",
  "layoutJson",
  "templateBlocks",
  "template_blocks",
] as const;

function normalizeRenderableBlocks(value: unknown): RenderableContentBlock[] {
  if (Array.isArray(value)) {
    return value
      .map((block, index) => normalizeContentBlock(block, index))
      .filter((block): block is RenderableContentBlock => Boolean(block));
  }

  const record = toRecord(value);
  if (Object.keys(record).length === 0) {
    return [];
  }

  const nested = toRecord(record.content);
  const looksLikeSingleBlock = Boolean(
    stringValue(record.type, record.block_type, nested.type),
  );

  if (!looksLikeSingleBlock) {
    return [];
  }

  const block = normalizeContentBlock(record, 0);
  return block ? [block] : [];
}

function extractRenderableBlocksFromUnknown(
  value: unknown,
  depth = 0,
): RenderableContentBlock[] {
  if (depth > 3 || value == null) {
    return [];
  }

  const directBlocks = normalizeRenderableBlocks(value);
  if (directBlocks.length > 0) {
    return directBlocks;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || !/^[\[{]/.test(trimmed)) {
      return [];
    }

    const parsed = safeParseJson(trimmed);
    if (parsed == null) {
      return [];
    }

    return extractRenderableBlocksFromUnknown(parsed, depth + 1);
  }

  const record = toRecord(value);
  for (const key of BLOCK_COLLECTION_KEYS) {
    const blocks = extractRenderableBlocksFromUnknown(record[key], depth + 1);
    if (blocks.length > 0) {
      return blocks;
    }
  }

  return [];
}

function renderBlockBody(
  block: RenderableContentBlock,
  color: string,
  fontSize: number = 16,
): string {
  const body = block.content || block.body;
  if (!body) return "";

  return `<div style="font-size:${fontSize}px;line-height:1.65;color:${color};">${toHtmlText(body)}</div>`;
}

function renderButton(
  label: string | undefined,
  url: string | undefined,
  backgroundColor: string,
): string {
  if (!label || !url) return "";

  return `<div style="margin-top:20px;"><a href="${escapeAttribute(url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${backgroundColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${toHtmlText(label)}</a></div>`;
}

function renderHeaderBlock(block: RenderableContentBlock): string {
  const backgroundColor = block.backgroundColor || "#1f4f3f";
  const textColor = block.textColor || "#ffffff";
  const backgroundImage = block.backgroundImageUrl || block.imageUrl;
  const imageStyle = backgroundImage
    ? `background-image:url('${escapeAttribute(backgroundImage)}');background-position:center;background-size:cover;`
    : "";

  return `
    <section style="padding:40px 32px;background:${backgroundColor};${imageStyle}">
      <div style="max-width:560px;">
        ${renderBlockHeading(block, textColor)}
        ${renderBlockBody(block, textColor, 17)}
        ${renderButton(block.buttonText, block.buttonUrl, "#ffffff33")}
      </div>
    </section>
  `;
}

function renderGraphicHero(block: RenderableContentBlock): string {
  if (!block.imageUrl && !block.backgroundImageUrl) {
    return renderHeaderBlock(block);
  }

  const imageUrl = block.imageUrl || block.backgroundImageUrl || "";
  const imageTag = `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Hero image")}" style="display:block;width:100%;height:auto;border:0;" />`;
  const linkedImage = block.buttonUrl
    ? `<a href="${escapeAttribute(block.buttonUrl)}">${imageTag}</a>`
    : imageTag;

  return `
    <section style="padding:0;background:${block.backgroundColor || "#f3f6f3"};">
      ${linkedImage}
      <div style="padding:28px 32px;">
        ${renderBlockHeading(block, block.textColor || "#1f2937")}
        ${renderBlockBody(block, block.textColor || "#374151")}
        ${renderButton(block.buttonText, block.buttonUrl, block.backgroundColor || "#1f4f3f")}
      </div>
    </section>
  `;
}

function renderImageBlock(block: RenderableContentBlock): string {
  if (!block.imageUrl) return renderTextBlock(block);

  return `
    <section style="padding:24px 32px;background:${block.backgroundColor || "#ffffff"};text-align:${block.alignment || "center"};">
      <img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Campaign image")}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;" />
      ${block.caption ? `<div style="margin-top:12px;font-size:14px;line-height:1.5;color:${block.textColor || "#6b7280"};">${toHtmlText(block.caption)}</div>` : ""}
    </section>
  `;
}

function renderTextBlock(block: RenderableContentBlock): string {
  const backgroundColor = block.backgroundColor || "#ffffff";
  const textColor = block.textColor || "#1f2937";

  return `
    <section style="padding:32px;background:${backgroundColor};text-align:${block.alignment || "left"};">
      ${renderBlockHeading(block, textColor)}
      ${renderBlockBody(block, textColor)}
      ${renderButton(block.buttonText, block.buttonUrl, "#1f4f3f")}
    </section>
  `;
}

function renderImageTextBlock(block: RenderableContentBlock): string {
  if (!block.imageUrl) return renderTextBlock(block);

  const reverse = block.layout === "image-right";
  const imageCell = `
    <td style="width:50%;padding:${reverse ? "0 0 0 12px" : "0 12px 0 0"};vertical-align:top;">
      <img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Campaign image")}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;" />
    </td>
  `;
  const textCell = `
    <td style="width:50%;padding:${reverse ? "0 12px 0 0" : "0 0 0 12px"};vertical-align:top;">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#374151")}
      ${renderButton(block.buttonText, block.buttonUrl, "#1f4f3f")}
    </td>
  `;

  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${reverse ? `${textCell}${imageCell}` : `${imageCell}${textCell}`}
        </tr>
      </table>
    </section>
  `;
}

function renderImageGalleryBlock(block: RenderableContentBlock): string {
  const images = block.galleryImages || [];
  if (images.length === 0) return renderTextBlock(block);

  const cells = images
    .map(
      (image) => `
      <td style="padding:8px;vertical-align:top;">
        <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt || "Gallery image")}" style="display:block;width:100%;height:auto;border:0;border-radius:14px;" />
        ${image.caption ? `<div style="margin-top:10px;font-size:14px;line-height:1.5;color:#4b5563;">${toHtmlText(image.caption)}</div>` : ""}
      </td>
    `,
    )
    .join("");

  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>${cells}</tr>
      </table>
    </section>
  `;
}

function renderProductGalleryBlock(block: RenderableContentBlock): string {
  const items = block.galleryItems || [];
  if (items.length === 0) return renderTextBlock(block);

  const cells = items
    .map(
      (item) => `
      <td style="width:50%;padding:8px;vertical-align:top;">
        <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
          ${item.imageUrl ? `<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title || "Product image")}" style="display:block;width:100%;height:auto;border:0;" />` : ""}
          <div style="padding:18px;">
            ${item.title ? `<h3 style="margin:0 0 10px;font-size:18px;line-height:1.3;color:#111827;">${toHtmlText(item.title)}</h3>` : ""}
            ${item.description ? `<div style="font-size:14px;line-height:1.6;color:#4b5563;">${toHtmlText(item.description)}</div>` : ""}
            ${item.price ? `<div style="margin-top:12px;font-size:15px;font-weight:700;color:#1f4f3f;">${toHtmlText(item.price)}</div>` : ""}
            ${renderButton(item.buttonText || block.buttonText, item.url || block.buttonUrl, "#1f4f3f")}
          </div>
        </div>
      </td>
    `,
    )
    .join("");

  return `
    <section style="padding:32px;background:${block.backgroundColor || "#f8faf8"};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>${cells}</tr>
      </table>
    </section>
  `;
}

function renderButtonBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:20px 32px;background:${block.backgroundColor || "#ffffff"};text-align:${block.alignment || "center"};">
      ${renderButton(block.buttonText || block.title, block.buttonUrl, "#1f4f3f")}
    </section>
  `;
}

function renderDividerBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:20px 32px;background:${block.backgroundColor || "#ffffff"};">
      <hr style="border:0;border-top:1px solid ${block.textColor || "#d1d5db"};margin:0;" />
    </section>
  `;
}

function renderProductBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      ${block.imageUrl ? `<img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Product image")}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin-bottom:20px;" />` : ""}
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#374151")}
      ${renderButton(block.buttonText, block.buttonUrl, "#1f4f3f")}
    </section>
  `;
}

function renderQuoteBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:32px;background:${block.backgroundColor || "#f8faf8"};">
      <blockquote style="margin:0;font-size:22px;line-height:1.5;font-style:italic;color:${block.textColor || "#1f2937"};">${toHtmlText(block.quote || block.body || block.content)}</blockquote>
      ${block.author ? `<div style="margin-top:16px;font-size:15px;font-weight:600;color:#1f4f3f;">${toHtmlText(block.author)}</div>` : ""}
      ${block.authorTitle ? `<div style="margin-top:4px;font-size:14px;color:#6b7280;">${toHtmlText(block.authorTitle)}</div>` : ""}
    </section>
  `;
}

function renderBlock(block: RenderableContentBlock): string {
  switch (block.type) {
    case "header":
    case "newsletter-header":
    case "email-safe-hero":
      return renderHeaderBlock(block);
    case "graphic-hero":
      return renderGraphicHero(block);
    case "image":
      return renderImageBlock(block);
    case "image-text":
      return renderImageTextBlock(block);
    case "image-gallery":
      return renderImageGalleryBlock(block);
    case "product-gallery":
      return renderProductGalleryBlock(block);
    case "button":
    case "cta":
      return renderButtonBlock(block);
    case "divider":
      return renderDividerBlock(block);
    case "product":
      return renderProductBlock(block);
    case "quote":
      return renderQuoteBlock(block);
    case "plain_text":
    case "text":
    default:
      return renderTextBlock(block);
  }
}

export function renderContentBlocksToEmailHtml(
  blocks: RenderableContentBlock[],
): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";

  const renderedBlocks = blocks.map((block) => renderBlock(block)).join("");
  return `<div style="margin:0 auto;max-width:680px;background:#ffffff;">${renderedBlocks}</div>`;
}

function extractMetadataContentBlocks(
  metadata: unknown,
): RenderableContentBlock[] {
  return extractRenderableBlocksFromUnknown(metadata);
}

export async function resolveCampaignEmailSource(
  supabase: CampaignSourceClient,
  campaign: { id?: string | null; metadata?: unknown; content?: string | null },
): Promise<CampaignEmailSource> {
  const metadataBlocks = extractMetadataContentBlocks(campaign.metadata);
  if (metadataBlocks.length > 0) {
    return {
      source: "metadata-content-blocks",
      html: "",
      contentBlocks: metadataBlocks,
      usedLegacyHtml: false,
    };
  }

  const campaignId = typeof campaign.id === "string" ? campaign.id : null;
  if (campaignId) {
    const { data, error } = await supabase
      .from("campaign_blocks")
      .select(
        "id, block_type, content, image_url, cta_text, cta_url, order_index",
      )
      .eq("campaign_id", campaignId)
      .order("order_index", { ascending: true });

    if (!error) {
      const contentBlocks = (data || [])
        .map((block: unknown, index: number) =>
          normalizeContentBlock(block, index),
        )
        .filter((block): block is RenderableContentBlock => Boolean(block));

      if (contentBlocks.length > 0) {
        return {
          source: "campaign-blocks",
          html: "",
          contentBlocks,
          usedLegacyHtml: false,
        };
      }
    }
  }

  const contentJsonBlocks = extractRenderableBlocksFromUnknown(
    campaign.content,
  );
  if (contentJsonBlocks.length > 0) {
    return {
      source: "content-json-blocks",
      html: "",
      contentBlocks: contentJsonBlocks,
      usedLegacyHtml: false,
      warning:
        "Recovered structured campaign blocks from crm_campaigns.content JSON because no metadata.contentBlocks or campaign_blocks were found.",
    };
  }

  const legacyHtml =
    typeof campaign.content === "string" ? campaign.content.trim() : "";
  if (legacyHtml) {
    return {
      source: "legacy-html",
      html: legacyHtml,
      contentBlocks: [],
      usedLegacyHtml: true,
      warning:
        "Using legacy crm_campaigns.content HTML because no block-based campaign content was found.",
    };
  }

  return {
    source: "empty",
    html: "",
    contentBlocks: [],
    usedLegacyHtml: false,
    warning:
      "Campaign has no renderable content in metadata.contentBlocks, campaign_blocks, or crm_campaigns.content.",
  };
}
