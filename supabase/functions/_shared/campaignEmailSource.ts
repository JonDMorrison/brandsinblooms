import { resolveImageSrcToHttps } from "./emailImageUrl.ts";
import { escapeHtmlAttribute, toHtmlText } from "./htmlContent.ts";
import { socialIcons } from "./footerGenerator.ts";

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
  badgeText?: string;
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
  issueNumber?: string;
  publishDate?: string;
  eyebrow?: string;
  body?: string;
  content?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
  backgroundOpacity?: number;
  colorOverlayOpacity?: number;
  darkOverlayOpacity?: number;
  overlayOpacity?: number;
  overlayColor?: string;
  altText?: string;
  caption?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  buttonColor?: string;
  buttonSize?: string;
  isRounded?: boolean;
  alignment?: string;
  textAlign?: string;
  layout?: string;
  padding?: string;
  dividerThickness?: number;
  dividerColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  quote?: string;
  author?: string;
  authorTitle?: string;
  galleryImages?: RenderableGalleryImage[];
  galleryItems?: RenderableGalleryItem[];
  galleryLayout?: string;
  galleryRows?: number;
  galleryColumns?: number;
  galleryGap?: string;
  galleryImageRadius?: string;
  columns?: number;
  showBadges?: boolean;
  socialLinks?: Record<string, { enabled?: boolean; url?: string }>;
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

const RESPONSIVE_EMAIL_STYLES = `<style>
  @media only screen and (max-width: 599px) {
    .mobile-stack-table,
    .mobile-stack-table tbody,
    .mobile-stack-table tr,
    .mobile-stack-table .mobile-stack-cell {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .mobile-stack-table .mobile-stack-cell {
      box-sizing: border-box !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .mobile-stack-table .mobile-stack-cell + .mobile-stack-cell {
      padding-top: 16px !important;
    }

    .mobile-stack-image {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
    }
  }
</style>`;

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
        ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
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

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function booleanValue(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

const escapeAttribute = escapeHtmlAttribute;

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

function normalizeSocialLinks(
  value: unknown,
): Record<string, { enabled?: boolean; url?: string }> | undefined {
  const record = toRecord(value);
  if (Object.keys(record).length === 0) return undefined;

  const result: Record<string, { enabled?: boolean; url?: string }> = {};
  for (const [key, raw] of Object.entries(record)) {
    const entry = toRecord(raw);
    const enabled =
      typeof entry.enabled === "boolean" ? entry.enabled : undefined;
    const url = typeof entry.url === "string" ? entry.url.trim() : undefined;
    if (enabled === undefined && (url === undefined || url === "")) continue;
    result[key.toLowerCase()] = {
      ...(enabled === undefined ? {} : { enabled }),
      ...(url ? { url } : {}),
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeGalleryItems(value: unknown): RenderableGalleryItem[] {
  return toArray(value)
    .map((entry) => {
      const record = toRecord(entry);
      const imageUrl = resolveImageSrcToHttps(
        stringValue(
          record.imageUrl,
          record.image_url,
          record.image,
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
        badgeText: stringValue(record.badgeText, record.badge_text),
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
        record.image,
        nested.image,
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
  const buttonUrl = stringValue(
    record.buttonUrl,
    nested.buttonUrl,
    record.ctaUrl,
    nested.ctaUrl,
    record.cta_url,
    nested.cta_url,
    record.url,
    nested.url,
  );
  const buttonText =
    stringValue(
      record.buttonText,
      nested.buttonText,
      record.ctaText,
      nested.ctaText,
      record.cta_text,
      nested.cta_text,
      record.text,
      nested.text,
    ) || (type === "product" && buttonUrl ? "View Product" : undefined);
  const alignment = stringValue(
    record.alignment,
    nested.alignment,
    record.textAlign,
    nested.textAlign,
    record.align,
    nested.align,
  );
  const textAlign = stringValue(
    record.textAlign,
    nested.textAlign,
    record.alignment,
    nested.alignment,
    record.align,
    nested.align,
  );
  const padding = stringValue(record.padding, nested.padding);

  return {
    id: stringValue(record.id, nested.id) || `${type}-${index}`,
    type,
    headline: stringValue(
      record.headline,
      nested.headline,
      record.title,
      nested.title,
      record.heading,
      nested.heading,
      record.name,
      nested.name,
    ),
    title: stringValue(
      record.title,
      nested.title,
      record.headline,
      nested.headline,
      record.name,
      nested.name,
    ),
    subtitle: stringValue(
      record.subtitle,
      nested.subtitle,
      record.preheader,
      nested.preheader,
    ),
    issueNumber: stringValue(record.issueNumber, nested.issueNumber),
    publishDate: stringValue(record.publishDate, nested.publishDate),
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
      record.content,
      nested.content,
      rawContentString,
    ),
    content: stringValue(
      record.content,
      nested.content,
      record.html,
      nested.html,
      record.contentHtml,
      nested.contentHtml,
      rawContentString,
    ),
    imageUrl,
    backgroundImageUrl,
    backgroundOpacity: numberValue(
      record.backgroundOpacity,
      nested.backgroundOpacity,
    ),
    colorOverlayOpacity: numberValue(
      record.colorOverlayOpacity,
      nested.colorOverlayOpacity,
    ),
    darkOverlayOpacity: numberValue(
      record.darkOverlayOpacity,
      nested.darkOverlayOpacity,
      record.dark_overlay_opacity,
    ),
    overlayOpacity: numberValue(
      record.overlayOpacity,
      nested.overlayOpacity,
      record.overlay_opacity,
    ),
    overlayColor: stringValue(
      record.overlayColor,
      nested.overlayColor,
      record.overlay_color,
    ),
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
    buttonText,
    buttonUrl,
    ctaText: stringValue(
      record.ctaText,
      nested.ctaText,
      record.buttonText,
      nested.buttonText,
      record.cta_text,
      nested.cta_text,
    ),
    ctaUrl: stringValue(
      record.ctaUrl,
      nested.ctaUrl,
      record.buttonUrl,
      nested.buttonUrl,
      record.cta_url,
      nested.cta_url,
      record.url,
      nested.url,
    ),
    buttonColor: stringValue(
      record.buttonColor,
      nested.buttonColor,
      record.ctaColor,
      nested.ctaColor,
    ),
    buttonSize: stringValue(record.buttonSize, nested.buttonSize),
    isRounded: booleanValue(record.isRounded, nested.isRounded),
    alignment,
    textAlign,
    layout: stringValue(record.layout, nested.layout),
    padding,
    dividerThickness: numberValue(
      record.dividerThickness,
      nested.dividerThickness,
    ),
    dividerColor: stringValue(record.dividerColor, nested.dividerColor),
    paddingTop: numberValue(record.paddingTop, nested.paddingTop),
    paddingBottom: numberValue(record.paddingBottom, nested.paddingBottom),
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
    galleryLayout: stringValue(record.galleryLayout, nested.galleryLayout),
    galleryRows: numberValue(record.galleryRows, nested.galleryRows),
    galleryColumns: numberValue(record.galleryColumns, nested.galleryColumns),
    galleryGap: stringValue(record.galleryGap, nested.galleryGap),
    galleryImageRadius: stringValue(
      record.galleryImageRadius,
      nested.galleryImageRadius,
    ),
    columns: numberValue(record.columns, nested.columns),
    showBadges: booleanValue(record.showBadges, nested.showBadges),
    socialLinks: normalizeSocialLinks(
      record.socialLinks ??
        nested.socialLinks ??
        record.social_links ??
        nested.social_links,
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

function getButtonPadding(buttonSize?: string): string {
  switch (buttonSize) {
    case "small":
      return "10px 18px";
    case "large":
      return "14px 28px";
    default:
      return "12px 24px";
  }
}

function getButtonFontSize(buttonSize?: string): string {
  switch (buttonSize) {
    case "small":
      return "14px";
    case "large":
      return "18px";
    default:
      return "15px";
  }
}

function getButtonBorderRadius(isRounded?: boolean): string {
  return isRounded === false ? "8px" : "999px";
}

const DEFAULT_EMAIL_BUTTON_COLOR = "#2E7D32";

function renderButton(
  label: string | undefined,
  url: string | undefined,
  backgroundColor: string,
  options?: {
    isRounded?: boolean;
    size?: string;
    alignment?: "left" | "center" | "right";
    textColor?: string;
  },
): string {
  if (!label) return "";

  const alignment = options?.alignment || "left";
  const radius = getButtonBorderRadius(options?.isRounded);
  const padding = getButtonPadding(options?.size);
  const fontSize = getButtonFontSize(options?.size);
  const textColor = options?.textColor || "#ffffff";
  const buttonStyles = `display:block;padding:${padding};border-radius:${radius};background:${backgroundColor};color:${textColor};text-decoration:none;font-size:${fontSize};font-weight:600;line-height:1.2;mso-line-height-rule:exactly;`;
  const buttonContent = url
    ? `<a href="${escapeAttribute(url)}" style="${buttonStyles}">${toHtmlText(label)}</a>`
    : `<span style="${buttonStyles}">${toHtmlText(label)}</span>`;

  return `<div style="margin-top:20px;text-align:${alignment};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr><td align="center" bgcolor="${escapeAttribute(backgroundColor)}" style="border-radius:${radius};">${buttonContent}</td></tr></table></div>`;
}

function getGalleryColumnCount(
  block: RenderableContentBlock,
  defaultColumns: number,
): number {
  if (typeof block.galleryColumns === "number" && block.galleryColumns > 0) {
    return Math.max(1, Math.min(4, block.galleryColumns));
  }

  if (typeof block.columns === "number" && block.columns > 0) {
    return Math.max(1, Math.min(4, block.columns));
  }

  return defaultColumns;
}

function getGalleryGapPx(gap?: string): number {
  switch (gap) {
    case "small":
      return 8;
    case "large":
      return 16;
    default:
      return 12;
  }
}

function getGalleryRadiusPx(radius?: string): number {
  switch (radius) {
    case "none":
      return 0;
    case "small":
      return 6;
    case "large":
      return 16;
    default:
      return 12;
  }
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function normalizeOpacity(
  value: number | undefined,
  defaultValue: number,
): number {
  const raw = value ?? defaultValue;

  if (!Number.isFinite(raw)) {
    return defaultValue > 1 ? defaultValue / 100 : defaultValue;
  }

  return raw > 1 ? raw / 100 : raw;
}

function getAlignment(
  block: RenderableContentBlock,
  fallback = "left",
): "left" | "center" | "right" {
  const resolved = (
    block.textAlign ||
    block.alignment ||
    fallback
  ).toLowerCase();
  if (resolved === "center" || resolved === "right") {
    return resolved;
  }

  return "left";
}

function getPaddingPx(padding: string | undefined, fallbackPx: number): number {
  switch (padding) {
    case "none":
      return 0;
    case "small":
      return 24;
    case "large":
      return 48;
    case "extra-large":
      return 64;
    case "medium":
      return 32;
    default:
      return fallbackPx;
  }
}

function getContentMargin(alignment: "left" | "center" | "right"): string {
  if (alignment === "center") {
    return "0 auto";
  }

  if (alignment === "right") {
    return "0 0 0 auto";
  }

  return "0";
}

function parseHexColor(
  color: string,
): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (normalized.length === 3) {
    return {
      r: Number.parseInt(normalized[0] + normalized[0], 16),
      g: Number.parseInt(normalized[1] + normalized[1], 16),
      b: Number.parseInt(normalized[2] + normalized[2], 16),
    };
  }

  if (normalized.length === 6) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  return null;
}

function parseRgbParts(
  color: string,
): { r: number; g: number; b: number } | null {
  const match = color
    .trim()
    .match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i,
    );

  if (!match) {
    return null;
  }

  const [, r, g, b] = match;
  return {
    r: Math.max(0, Math.min(255, Number.parseInt(r, 10))),
    g: Math.max(0, Math.min(255, Number.parseInt(g, 10))),
    b: Math.max(0, Math.min(255, Number.parseInt(b, 10))),
  };
}

function toRgba(color: string | undefined, alpha: number): RgbaColor | null {
  if (!color || alpha <= 0) {
    return null;
  }

  const rgb = parseHexColor(color) || parseRgbParts(color);
  if (!rgb) {
    return null;
  }

  return {
    ...rgb,
    a: Math.max(0, Math.min(1, alpha)),
  };
}

function blendColors(bottom: RgbaColor, top: RgbaColor): RgbaColor {
  const outAlpha = top.a + bottom.a * (1 - top.a);
  if (outAlpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: Math.round(
      (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / outAlpha,
    ),
    g: Math.round(
      (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / outAlpha,
    ),
    b: Math.round(
      (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / outAlpha,
    ),
    a: Number(outAlpha.toFixed(3)),
  };
}

function buildCompositeOverlay(
  block: RenderableContentBlock,
  fallbackColor: string,
): { fallback: string; rgba?: string } {
  const imageFadeOpacity = Math.max(
    0,
    1 - normalizeOpacity(block.backgroundOpacity, 100),
  );
  const layers = [
    toRgba(block.backgroundColor || fallbackColor, imageFadeOpacity),
    toRgba("#000000", normalizeOpacity(block.darkOverlayOpacity, 0)),
    block.backgroundColor
      ? toRgba(
          block.backgroundColor,
          normalizeOpacity(block.colorOverlayOpacity, 50),
        )
      : null,
    toRgba(
      block.overlayColor || "#000000",
      normalizeOpacity(block.overlayOpacity, 0),
    ),
  ].filter((layer): layer is RgbaColor => Boolean(layer));

  if (layers.length === 0) {
    return { fallback: fallbackColor };
  }

  const composite = layers.reduce(
    (result, layer) => blendColors(result, layer),
    { r: 0, g: 0, b: 0, a: 0 } satisfies RgbaColor,
  );

  return {
    fallback: `rgb(${composite.r}, ${composite.g}, ${composite.b})`,
    rgba: `rgba(${composite.r}, ${composite.g}, ${composite.b}, ${composite.a})`,
  };
}

function getButtonLabel(block: RenderableContentBlock): string | undefined {
  return block.buttonText || block.ctaText;
}

function getButtonUrl(block: RenderableContentBlock): string | undefined {
  return block.buttonUrl || block.ctaUrl;
}

function renderOutlineButton(
  label: string | undefined,
  url: string | undefined,
  color: string,
  options?: {
    isRounded?: boolean;
    size?: string;
    alignment?: "left" | "center" | "right";
  },
): string {
  if (!label) return "";

  const alignment = options?.alignment || "left";
  const radius = getButtonBorderRadius(options?.isRounded);
  const padding = getButtonPadding(options?.size);
  const fontSize = getButtonFontSize(options?.size);
  const buttonStyles = `display:block;padding:${padding};border-radius:${radius};border:2px solid ${color};background:transparent;color:${color};text-decoration:none;font-size:${fontSize};font-weight:600;line-height:1.2;mso-line-height-rule:exactly;`;
  const buttonContent = url
    ? `<a href="${escapeAttribute(url)}" style="${buttonStyles}">${toHtmlText(label)}</a>`
    : `<span style="${buttonStyles}">${toHtmlText(label)}</span>`;

  return `<div style="margin-top:24px;text-align:${alignment};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr><td align="center" style="border-radius:${radius};">${buttonContent}</td></tr></table></div>`;
}

function formatPublishDateLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function renderPublishDateRow(
  value: string | undefined,
  color: string,
): string {
  const formatted = formatPublishDateLabel(value);
  if (!formatted) {
    return "";
  }

  return `<div style="margin-top:32px;font-size:18px;line-height:1.5;color:${color};opacity:0.8;">&#128197;&nbsp;${toHtmlText(formatted)}</div>`;
}

function renderHeroSection(
  block: RenderableContentBlock,
  options: {
    backgroundImageUrl?: string;
    defaultBackgroundColor: string;
    defaultTextColor: string;
    defaultPaddingPx: number;
    minHeightPx: number;
    headingSizePx: number;
    subtitleSizePx: number;
    bodySizePx: number;
    maxWidthPx: number;
    includeBody?: boolean;
    includeIssueInfo?: boolean;
    showPublishDate?: boolean;
    buttonVariant?: "solid" | "outline";
  },
): string {
  const backgroundImageUrl = options.backgroundImageUrl;
  const sectionBackgroundColor =
    block.backgroundColor || options.defaultBackgroundColor;
  const textColor = block.textColor || options.defaultTextColor;
  const alignment = getAlignment(block, "center");
  const paddingPx = getPaddingPx(block.padding, options.defaultPaddingPx);
  const overlay = buildCompositeOverlay(block, sectionBackgroundColor);
  const title = block.headline || block.title;
  const subtitle = block.subtitle;
  const body = options.includeBody ? block.body || block.content : undefined;
  const issueInfo =
    options.includeIssueInfo && block.content && block.content !== block.body
      ? block.content
      : undefined;
  const buttonLabel = getButtonLabel(block);
  const buttonUrl = getButtonUrl(block);
  const buttonHtml =
    options.buttonVariant === "outline"
      ? renderOutlineButton(buttonLabel, buttonUrl, textColor, {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment,
        })
      : renderButton(
          buttonLabel,
          buttonUrl,
          block.buttonColor || textColor || DEFAULT_EMAIL_BUTTON_COLOR,
          {
            isRounded: block.isRounded,
            size: block.buttonSize,
            alignment,
          },
        );
  const contentHtml = `
    <div style="max-width:${options.maxWidthPx}px;margin:${getContentMargin(alignment)};text-align:${alignment};color:${textColor};">
      ${block.eyebrow ? `<div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;margin-bottom:8px;">${toHtmlText(block.eyebrow)}</div>` : ""}
      ${title ? `<h1 style="margin:0 0 ${subtitle || body ? 16 : 0}px;font-size:${options.headingSizePx}px;line-height:1.1;font-weight:700;color:${textColor};">${toHtmlText(title)}</h1>` : ""}
      ${subtitle ? `<div style="font-size:${options.subtitleSizePx}px;line-height:1.5;color:${textColor};opacity:0.92;">${toHtmlText(subtitle)}</div>` : ""}
      ${body ? `<div style="margin-top:${subtitle ? 16 : 0}px;font-size:${options.bodySizePx}px;line-height:1.65;color:${textColor};opacity:0.92;">${toHtmlText(body)}</div>` : ""}
      ${issueInfo ? `<div style="margin-top:14px;font-size:13px;line-height:1.5;color:${textColor};opacity:0.72;">${toHtmlText(issueInfo)}</div>` : ""}
      ${options.showPublishDate ? renderPublishDateRow(block.publishDate, textColor) : ""}
      ${buttonHtml}
    </div>
  `;

  if (!backgroundImageUrl) {
    return `
      <section style="background:${sectionBackgroundColor};">
        <div style="padding:${paddingPx}px 32px;min-height:${options.minHeightPx}px;display:flex;align-items:center;justify-content:center;">
          ${contentHtml}
        </div>
      </section>
    `;
  }

  const overlayStyle = overlay.rgba
    ? `background-color:${overlay.fallback};background-color:${overlay.rgba};`
    : "background-color:transparent;";

  return `
    <section style="background:${sectionBackgroundColor};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td background="${escapeAttribute(backgroundImageUrl)}" valign="top" style="background-color:${sectionBackgroundColor};background-image:url('${escapeAttribute(backgroundImageUrl)}');background-position:center center;background-size:cover;background-repeat:no-repeat;">
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:680px;">
              <v:fill type="frame" src="${escapeAttribute(backgroundImageUrl)}" color="${sectionBackgroundColor}" />
              <v:textbox inset="0,0,0,0">
            <![endif]-->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="${alignment}" valign="middle" height="${options.minHeightPx}" style="${overlayStyle}padding:${paddingPx}px 32px;height:${options.minHeightPx}px;vertical-align:middle;">
                  ${contentHtml}
                </td>
              </tr>
            </table>
            <!--[if gte mso 9]>
              </v:textbox>
            </v:rect>
            <![endif]-->
          </td>
        </tr>
      </table>
    </section>
  `;
}

function renderHeaderBlock(block: RenderableContentBlock): string {
  return renderHeroSection(block, {
    backgroundImageUrl: block.backgroundImageUrl || block.imageUrl,
    defaultBackgroundColor: "#1f4f3f",
    defaultTextColor: "#ffffff",
    defaultPaddingPx: 40,
    minHeightPx: 300,
    headingSizePx: 42,
    subtitleSizePx: 20,
    bodySizePx: 17,
    maxWidthPx: 560,
    includeBody: true,
  });
}

function renderNewsletterHeaderBlock(block: RenderableContentBlock): string {
  return renderHeroSection(block, {
    backgroundImageUrl: block.backgroundImageUrl || block.imageUrl,
    defaultBackgroundColor: "#1f2937",
    defaultTextColor: "#ffffff",
    defaultPaddingPx: 48,
    minHeightPx: 400,
    headingSizePx: 48,
    subtitleSizePx: 22,
    bodySizePx: 18,
    maxWidthPx: 640,
    showPublishDate: true,
    buttonVariant: "outline",
  });
}

function renderEmailSafeHeroBlock(block: RenderableContentBlock): string {
  return renderHeroSection(block, {
    backgroundImageUrl: block.backgroundImageUrl || block.imageUrl,
    defaultBackgroundColor: "#f5f5f7",
    defaultTextColor: "#111111",
    defaultPaddingPx: 48,
    minHeightPx: 360,
    headingSizePx: 44,
    subtitleSizePx: 22,
    bodySizePx: 18,
    maxWidthPx: 640,
    includeBody: true,
    includeIssueInfo: true,
    buttonVariant: "outline",
  });
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
    <section style="padding:0;background:${block.backgroundColor || "#ffffff"};">
      ${linkedImage}
      <div style="padding:28px 32px;">
        ${renderBlockHeading(block, block.textColor || "#1f2937")}
        ${renderBlockBody(block, block.textColor || "#374151")}
        ${renderButton(
          block.buttonText,
          block.buttonUrl,
          block.buttonColor ||
            block.backgroundColor ||
            DEFAULT_EMAIL_BUTTON_COLOR,
          {
            isRounded: block.isRounded,
            size: block.buttonSize,
            alignment: getAlignment(block, "left"),
          },
        )}
      </div>
    </section>
  `;
}

function renderImageBlock(block: RenderableContentBlock): string {
  if (
    block.layout === "two-column-left" ||
    block.layout === "two-column-right" ||
    block.layout === "image-left" ||
    block.layout === "image-right"
  ) {
    return renderImageTextBlock(block);
  }

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
  const alignment = getAlignment(block, "left");

  return `
    <section style="padding:32px;background:${backgroundColor};text-align:${alignment};">
      ${renderBlockHeading(block, textColor)}
      ${renderBlockBody(block, textColor)}
      ${renderButton(
        block.buttonText,
        block.buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment,
        },
      )}
    </section>
  `;
}

function renderImageTextBlock(block: RenderableContentBlock): string {
  const backgroundImageLayout =
    block.layout === "image-background" ||
    block.layout === "image-overlay" ||
    block.layout === "background" ||
    block.layout === "overlay";
  const backgroundHeroImage =
    block.backgroundImageUrl ||
    (backgroundImageLayout ? block.imageUrl : undefined);

  if (backgroundHeroImage) {
    return renderHeroSection(block, {
      backgroundImageUrl: backgroundHeroImage,
      defaultBackgroundColor: "#1f2937",
      defaultTextColor: block.textColor || "#ffffff",
      defaultPaddingPx: 40,
      minHeightPx: 320,
      headingSizePx: 40,
      subtitleSizePx: 20,
      bodySizePx: 18,
      maxWidthPx: 620,
      includeBody: true,
      buttonVariant: "outline",
    });
  }

  if (!block.imageUrl) return renderTextBlock(block);

  if (block.layout === "full-width" || block.type === "text") {
    return `
      <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};text-align:${block.alignment || "left"};">
        <img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Campaign image")}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin-bottom:20px;" />
        ${renderBlockHeading(block, block.textColor || "#1f2937")}
        ${renderBlockBody(block, block.textColor || "#374151")}
        ${renderButton(
          block.buttonText,
          block.buttonUrl,
          block.buttonColor || "#1f4f3f",
          { isRounded: block.isRounded, size: block.buttonSize },
        )}
      </section>
    `;
  }

  const reverse =
    block.layout === "image-right" || block.layout === "two-column-right";
  const alignment = getAlignment(block, "left");
  const backgroundColor = block.backgroundColor || "#ffffff";
  const tableDirection = reverse ? "rtl" : "ltr";
  const imageAlt =
    block.altText || block.title || block.headline || "Campaign image";
  const imageCell = `
    <td class="mobile-stack-cell" dir="ltr" width="50%" valign="top" style="width:50%;padding:${reverse ? "0 0 0 12px" : "0 12px 0 0"};vertical-align:top;">
      <img class="mobile-stack-image" src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(imageAlt)}" width="280" style="display:block;width:100%;max-width:280px;height:auto;border:0;border-radius:16px;outline:none;text-decoration:none;" />
    </td>
  `;
  const textCell = `
    <td class="mobile-stack-cell" dir="ltr" width="50%" valign="top" style="width:50%;padding:${reverse ? "0 12px 0 0" : "0 0 0 12px"};vertical-align:top;text-align:${alignment};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#374151")}
      ${renderButton(
        block.buttonText,
        block.buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment,
        },
      )}
    </td>
  `;

  return `
    <section style="padding:32px;background:${backgroundColor};">
      <table class="mobile-stack-table" dir="${tableDirection}" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
        <tr>
          ${imageCell}${textCell}
        </tr>
      </table>
    </section>
  `;
}

function renderImageGalleryBlock(block: RenderableContentBlock): string {
  const images = block.galleryImages || [];
  if (images.length === 0) return renderTextBlock(block);

  const columns = Math.min(3, getGalleryColumnCount(block, 3));
  const gapPx = getGalleryGapPx(block.galleryGap);
  const radiusPx = getGalleryRadiusPx(block.galleryImageRadius);
  const alignment = getAlignment(block, "center");
  const rows = chunkItems(images, columns);
  const rowsHtml = rows
    .map((row) => {
      const cells = row
        .map(
          (image) => `
      <td style="width:${100 / columns}%;padding:${gapPx / 2}px;vertical-align:top;">
        <div style="height:200px;overflow:hidden;border-radius:${radiusPx}px;line-height:0;font-size:0;">
          <img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt || "Gallery image")}" width="100%" height="200" style="display:block;width:100%;height:200px;border:0;object-fit:cover;object-position:center;" />
        </div>
        ${image.caption ? `<div style="margin-top:10px;font-size:14px;line-height:1.5;color:#4b5563;">${toHtmlText(image.caption)}</div>` : ""}
      </td>
    `,
        )
        .join("");

      const emptyCells = Array.from({ length: columns - row.length })
        .map(
          () =>
            `<td style="width:${100 / columns}%;padding:${gapPx / 2}px;vertical-align:top;"></td>`,
        )
        .join("");

      return `<tr>${cells}${emptyCells}</tr>`;
    })
    .join("");

  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};text-align:${alignment};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#4b5563")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowsHtml}
      </table>
      ${renderButton(
        block.buttonText,
        block.buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment,
        },
      )}
    </section>
  `;
}

function renderProductGalleryBlock(block: RenderableContentBlock): string {
  const items = block.galleryItems || [];
  if (items.length === 0) return renderTextBlock(block);

  const columns = getGalleryColumnCount(block, 2);
  const gapPx = getGalleryGapPx(block.galleryGap);
  const radiusPx = getGalleryRadiusPx(block.galleryImageRadius);
  const rows = chunkItems(items, columns);
  const rowsHtml = rows
    .map((row) => {
      const cells = row
        .map((item) => {
          const cardInner = `
        <div style="border:1px solid #e5e7eb;border-radius:${radiusPx}px;overflow:hidden;background:#ffffff;">
          ${item.imageUrl ? `<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.title || "Product image")}" style="display:block;width:100%;height:auto;border:0;" />` : ""}
          <div style="padding:18px;text-align:center;">
            ${block.showBadges !== false && item.badgeText ? `<div style="display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${toHtmlText(item.badgeText)}</div>` : ""}
            ${item.title ? `<h3 style="margin:0 0 10px;font-size:18px;line-height:1.3;color:#111827;">${toHtmlText(item.title)}</h3>` : ""}
            ${item.description ? `<div style="font-size:14px;line-height:1.6;color:#4b5563;">${toHtmlText(item.description)}</div>` : ""}
            ${item.price ? `<div style="margin-top:12px;font-size:15px;font-weight:700;color:#1f4f3f;">${toHtmlText(item.price)}</div>` : ""}
            ${item.buttonText && item.url ? renderButton(item.buttonText, item.url, block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR, { isRounded: block.isRounded, size: block.buttonSize, alignment: "center" }) : ""}
          </div>
        </div>
      `;

          const cardHtml = item.url
            ? `<a href="${escapeAttribute(item.url)}" style="display:block;text-decoration:none;color:inherit;">${cardInner}</a>`
            : cardInner;

          return `
      <td style="width:${100 / columns}%;padding:${gapPx / 2}px;vertical-align:top;">
        ${cardHtml}
      </td>
    `;
        })
        .join("");

      const emptyCells = Array.from({ length: columns - row.length })
        .map(
          () =>
            `<td style="width:${100 / columns}%;padding:${gapPx / 2}px;vertical-align:top;"></td>`,
        )
        .join("");

      return `<tr>${cells}${emptyCells}</tr>`;
    })
    .join("");

  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#4b5563")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowsHtml}
      </table>
      ${renderButton(
        block.buttonText,
        block.buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment: getAlignment(block, "center"),
        },
      )}
    </section>
  `;
}

function renderButtonBlock(block: RenderableContentBlock): string {
  const alignment = getAlignment(block, "center");
  const buttonLabel = getButtonLabel(block) || "Click Here";
  const buttonUrl = getButtonUrl(block);

  return `
    <section style="padding:32px 24px;background:${block.backgroundColor || "#ffffff"};text-align:${alignment};">
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#4b5563")}
      ${renderButton(
        buttonLabel,
        buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment,
        },
      )}
    </section>
  `;
}

function renderDividerBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:${block.paddingTop ?? 20}px 32px ${block.paddingBottom ?? 20}px;background:${block.backgroundColor || "#ffffff"};">
      <hr style="border:0;border-top:${block.dividerThickness || 1}px solid ${block.dividerColor || block.textColor || "#d1d5db"};margin:0;" />
    </section>
  `;
}

function renderProductBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      ${block.imageUrl ? `<img src="${escapeAttribute(block.imageUrl)}" alt="${escapeAttribute(block.altText || block.title || "Product image")}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin-bottom:20px;" />` : ""}
      ${renderBlockHeading(block, block.textColor || "#1f2937")}
      ${renderBlockBody(block, block.textColor || "#374151")}
      ${renderButton(
        block.buttonText,
        block.buttonUrl,
        block.buttonColor || DEFAULT_EMAIL_BUTTON_COLOR,
        {
          isRounded: block.isRounded,
          size: block.buttonSize,
          alignment: getAlignment(block, "left"),
        },
      )}
    </section>
  `;
}

function renderSocialFollowBlock(block: RenderableContentBlock): string {
  const links = block.socialLinks || {};
  const activeIcons = Object.entries(links).flatMap(([key, data]) => {
    if (data?.enabled !== true || typeof data?.url !== "string") {
      return [];
    }

    const iconMarkup = Object.prototype.hasOwnProperty.call(socialIcons, key)
      ? socialIcons[key]
      : key === "twitter"
        ? '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#111827;">X</span>'
        : "";

    if (!iconMarkup) {
      return [];
    }

    return [
      `
        <a href="${escapeAttribute(data.url)}" target="_blank" rel="noopener" style="display:inline-block;margin:0 8px;text-decoration:none;">
          ${iconMarkup}
        </a>
      `,
    ];
  });

  if (activeIcons.length === 0) return "";

  const backgroundColor = block.backgroundColor || "#ffffff";
  const textColor = block.textColor || "#1f2937";
  const alignment = block.alignment || "center";

  return `
    <section style="padding:24px 32px;background:${backgroundColor};text-align:${alignment};">
      ${renderBlockHeading(block, textColor)}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${alignment}" style="margin:${alignment === "center" ? "0 auto" : "0"};">
        <tr>
          <td align="${alignment}" style="padding:8px 0;">
            ${activeIcons.join("")}
          </td>
        </tr>
      </table>
    </section>
  `;
}

function renderFooterBlock(block: RenderableContentBlock): string {
  // User-authored footer block. Renders inline with the rest of the campaign
  // content; the auto-injected compliance footer (legal address +
  // unsubscribe links from emailRenderer.ts → footerGenerator.ts) is
  // appended AFTER the campaign HTML at send time, so this block sits above
  // it in the final email.
  const body = block.body || block.content;
  if (!body && !block.headline && !block.title) return "";

  const backgroundColor = block.backgroundColor || "#ffffff";
  const textColor = block.textColor || "#334155";

  return `
    <section style="padding:24px 32px;background:${backgroundColor};text-align:${block.alignment || "left"};">
      ${renderBlockHeading(block, textColor)}
      ${body ? `<div style="font-size:14px;line-height:1.7;color:${textColor};">${toHtmlText(body)}</div>` : ""}
    </section>
  `;
}

function renderQuoteBlock(block: RenderableContentBlock): string {
  return `
    <section style="padding:32px;background:${block.backgroundColor || "#ffffff"};">
      <blockquote style="margin:0;font-size:22px;line-height:1.5;font-style:italic;color:${block.textColor || "#1f2937"};">${toHtmlText(block.quote || block.body || block.content)}</blockquote>
      ${block.author ? `<div style="margin-top:16px;font-size:15px;font-weight:600;color:#1f4f3f;">${toHtmlText(block.author)}</div>` : ""}
      ${block.authorTitle ? `<div style="margin-top:4px;font-size:14px;color:#6b7280;">${toHtmlText(block.authorTitle)}</div>` : ""}
    </section>
  `;
}

function renderBlock(block: RenderableContentBlock): string {
  switch (block.type) {
    case "header":
      return renderHeaderBlock(block);
    case "newsletter-header":
      return renderNewsletterHeaderBlock(block);
    case "email-safe-hero":
      return renderEmailSafeHeroBlock(block);
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
    case "social-follow":
      return renderSocialFollowBlock(block);
    case "footer":
      return renderFooterBlock(block);
    case "plain_text":
    case "text":
      return block.imageUrl
        ? renderImageTextBlock(block)
        : renderTextBlock(block);
    default:
      return renderTextBlock(block);
  }
}

export function renderContentBlocksToEmailHtml(
  blocks: RenderableContentBlock[],
): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";

  const normalizedBlocks = blocks
    .map((block, index) => normalizeContentBlock(block, index))
    .filter((block): block is RenderableContentBlock => Boolean(block));

  const renderedBlocks = normalizedBlocks
    .map((block) => renderBlock(block))
    .join("");
  return `${RESPONSIVE_EMAIL_STYLES}<div style="margin:0 auto;max-width:680px;background:#ffffff;">${renderedBlocks}</div>`;
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
