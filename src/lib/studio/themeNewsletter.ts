import { supabase } from "@/integrations/supabase/client";
import {
  buildConnectedContentBlock,
  type ConnectedContentItem,
} from "@/lib/connectedContent";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { NewsletterIdeaDraftSeed } from "@/lib/studio/newsletterIdeaSeed";
import type { WeeklyThemeImage } from "@/lib/studio/weeklyThemeSeed";
import type { StudioBlock } from "@/types/studioBlocks";
import type { StudioBlockType } from "@/components/crm/studio/blockLibraryData";

/**
 * "Start from this week's theme" with AI: the generate-theme-newsletter
 * contract, turning its content blocks into Studio blocks, and the
 * deterministic fallback when generation fails or times out.
 */

export const THEME_NEWSLETTER_FUNCTION = "generate-theme-newsletter";
export const THEME_NEWSLETTER_TIMEOUT_MS = 45_000;

/** Block types the function may return (exact Studio type names). */
const THEME_BLOCK_TYPES = new Set<StudioBlockType>([
  "newsletter-header",
  "full-width-image",
  "plain-text",
  "image-text",
  "call-to-action",
  "footer",
]);

/** Customer-facing copy fields; the rest of a block is styling or links. */
const TEXT_FIELDS = [
  "headline",
  "subheading",
  "body",
  "tagline",
  "caption",
  "buttonText",
  "imageAlt",
  "productName",
  "productDescription",
  "quoteText",
] as const satisfies ReadonlyArray<keyof StudioBlock>;
type TextField = (typeof TEXT_FIELDS)[number];

/** Internal instruction text that must never reach a customer. */
const INTERNAL_TEXT_PATTERNS = [
  /encourage/i,
  /review the seeded/i,
  /\bseeded\b/i,
  /continue shaping/i,
  /review the draft/i,
  /suggested angle/i,
  /use this section/i,
  /tailor each block/i,
  /\[/,
  /\btodo\b/i,
  /lorem/i,
];

export type ThemeNewsletterContentBlock = Partial<StudioBlock> & {
  type: StudioBlockType;
};

export interface ThemeNewsletterResult {
  ok: true;
  subjectLine: string;
  previewText: string;
  contentBlocks: ThemeNewsletterContentBlock[];
  theme: {
    weekNumber: number;
    themeCampaignId: string | null;
    title: string;
    brief: string;
  };
  context: {
    imageUrls: string[];
    links: string[];
    websiteItems: ConnectedContentItem[];
  };
  model: string;
  attempts: number;
  tokens: { prompt: number; completion: number; total: number };
  latencyMs: number;
}

export interface ThemeNewsletterRequest {
  tenantId: string;
  campaignId: string;
  weekNumber?: number;
  fallbackWeekNumber?: number;
  themeImages?: WeeklyThemeImage[];
}

export class ThemeNewsletterError extends Error {
  constructor(
    message: string,
    readonly reason: "timeout" | "failed",
  ) {
    super(message);
    this.name = "ThemeNewsletterError";
  }
}

type InvokeResult = { data: unknown; error: unknown };
export type ThemeNewsletterInvoke = (
  name: string,
  options: { body: ThemeNewsletterRequest },
) => Promise<InvokeResult>;

const defaultInvoke: ThemeNewsletterInvoke = (name, options) =>
  supabase.functions.invoke(name, options);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isThemeNewsletterResult(
  value: unknown,
): value is ThemeNewsletterResult {
  if (!isRecord(value) || value.ok !== true) return false;
  if (typeof value.subjectLine !== "string" || !value.subjectLine.trim()) return false;
  if (typeof value.previewText !== "string" || !value.previewText.trim()) return false;
  if (!Array.isArray(value.contentBlocks) || !isRecord(value.context)) return false;
  return value.contentBlocks.every(
    (block) =>
      isRecord(block) &&
      typeof block.type === "string" &&
      THEME_BLOCK_TYPES.has(block.type as StudioBlockType),
  );
}

/** Calls the function; rejects with ThemeNewsletterError after `timeoutMs`. */
export async function requestThemeNewsletter(
  request: ThemeNewsletterRequest,
  options: { timeoutMs?: number; invoke?: ThemeNewsletterInvoke } = {},
): Promise<ThemeNewsletterResult> {
  const timeoutMs = options.timeoutMs ?? THEME_NEWSLETTER_TIMEOUT_MS;
  const invoke = options.invoke ?? defaultInvoke;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ThemeNewsletterError("Writing the newsletter took too long.", "timeout")),
      timeoutMs,
    );
  });
  try {
    const { data, error } = await Promise.race([
      invoke(THEME_NEWSLETTER_FUNCTION, { body: request }),
      timeout,
    ]);
    if (error || !isThemeNewsletterResult(data)) {
      throw new ThemeNewsletterError("We couldn't write this one.", "failed");
    }
    return data;
  } catch (error) {
    if (error instanceof ThemeNewsletterError) throw error;
    throw new ThemeNewsletterError("We couldn't write this one.", "failed");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Studio blocks for a generated newsletter. Header and footer start from the
 * brand defaults (logo, store name, colours, compliant footer); website items
 * are rebuilt with the same builder "From my website" uses.
 */
export function hydrateThemeNewsletterBlocks(
  result: Pick<ThemeNewsletterResult, "contentBlocks" | "context">,
  designSystem?: StudioDesignSystem | null,
): StudioBlock[] {
  const items = new Map(
    (result.context.websiteItems ?? []).map((item) => [item.id, item]),
  );
  return result.contentBlocks.flatMap((content, index): StudioBlock[] => {
    if (!THEME_BLOCK_TYPES.has(content.type)) return [];
    const source = content.connectedContent;
    const item = source ? items.get(source.itemId) : undefined;
    if (source && item) {
      try {
        return [{ ...buildConnectedContentBlock(item, designSystem ?? null), order: index }];
      } catch {
        return [];
      }
    }
    const base = createStudioBlock(content.type, designSystem);
    const fields: Partial<StudioBlock> = {};
    for (const field of [...TEXT_FIELDS, "imageUrl", "buttonUrl"] as const) {
      const value = content[field];
      if (typeof value === "string") fields[field] = value;
    }
    if (content.type === "call-to-action") {
      Object.assign(fields, { layout: "centered-hero", layoutPreset: "cta-centered-hero" });
    }
    return [{ ...base, ...fields, order: index }];
  });
}

function normalize(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when `text` reproduces the internal theme brief (or a piece of it). */
function repeatsBrief(text: string, brief: string) {
  const value = normalize(text);
  const internal = normalize(brief);
  if (!value || internal.length < 20) return false;
  return value.includes(internal) || (value.length >= 25 && internal.includes(value));
}

export function isInternalText(text: string, brief = "") {
  return (
    INTERNAL_TEXT_PATTERNS.some((pattern) => pattern.test(text)) ||
    repeatsBrief(text, brief)
  );
}

/**
 * The deterministic weekly-theme seed with every piece of internal text
 * removed: instruction blocks ("Continue shaping this newsletter"), the
 * master content ideas used as intro or preview text, and copy that only
 * repeats the header subtitle.
 */
export function sanitizeThemeSeedDraft(
  seed: NewsletterIdeaDraftSeed,
  options: { brief: string; storeName?: string },
): NewsletterIdeaDraftSeed {
  const brief = options.brief;
  const header = seed.contentBlocks.find((block) => block.type === "newsletter-header");
  const tagline = header?.tagline ? normalize(header.tagline) : "";
  const contentBlocks = seed.contentBlocks.flatMap((block): StudioBlock[] => {
    if (block.type === "footer") return [block];
    const hadInternalCta =
      block.type === "call-to-action" &&
      [block.headline, block.body, block.buttonText].some(
        (value) => typeof value === "string" && isInternalText(value, brief),
      );
    if (hadInternalCta) return [];
    const next: StudioBlock = { ...block };
    for (const field of TEXT_FIELDS) {
      const value = next[field as TextField];
      if (typeof value !== "string" || !value) continue;
      if (isInternalText(value, brief)) {
        next[field as TextField] = "";
      } else if (
        block.type !== "newsletter-header" &&
        field === "body" &&
        tagline &&
        normalize(value) === tagline
      ) {
        next.body = "";
      }
    }
    if (next.buttonUrl && !/^https:\/\//i.test(next.buttonUrl)) {
      next.buttonUrl = "";
      next.buttonText = "";
    }
    const hasText = TEXT_FIELDS.some(
      (field) => field !== "imageAlt" && normalize(String(next[field] ?? "")).length > 0,
    );
    const hasImage = typeof next.imageUrl === "string" && next.imageUrl.length > 0;
    if (block.type !== "newsletter-header" && !hasText && !hasImage) return [];
    return [next];
  });

  const store = options.storeName?.trim();
  const previewText = isInternalText(seed.preheaderText, brief) || !seed.preheaderText.trim()
    ? store
      ? `This week's garden ideas from ${store}.`
      : "This week's garden ideas and seasonal picks."
    : seed.preheaderText;
  const subjectLine = isInternalText(seed.subjectLine, brief) ? seed.name : seed.subjectLine;

  return { ...seed, subjectLine, preheaderText: previewText, contentBlocks };
}

/**
 * Problems a customer would see in a theme newsletter: internal text, the
 * master brief, or images/links that did not come from the generation
 * context. Header and footer are brand defaults and are not link-checked.
 */
export function findThemeNewsletterIssues(
  draft: { subjectLine: string; previewText: string; blocks: StudioBlock[] },
  context: { brief: string; imageUrls?: string[]; links?: string[] },
): string[] {
  const issues: string[] = [];
  const check = (label: string, value: unknown) => {
    if (typeof value === "string" && value && isInternalText(value, context.brief)) {
      issues.push(`${label}: internal text "${value.slice(0, 80)}"`);
    }
  };
  check("subject", draft.subjectLine);
  check("preview", draft.previewText);
  if (!draft.subjectLine.trim()) issues.push("subject is empty");
  if (!draft.previewText.trim()) issues.push("preview is empty");
  const images = context.imageUrls ? new Set(context.imageUrls) : null;
  const links = context.links ? new Set(context.links) : null;
  draft.blocks.forEach((block, index) => {
    if (block.type === "footer") return;
    for (const field of TEXT_FIELDS) check(`block ${index} ${block.type}.${field}`, block[field]);
    if (block.type === "newsletter-header") return;
    if (images && block.imageUrl && !images.has(block.imageUrl)) {
      issues.push(`block ${index} ${block.type}: image not in context`);
    }
    if (links && block.buttonUrl && !links.has(block.buttonUrl)) {
      issues.push(`block ${index} ${block.type}: link not in context`);
    }
  });
  return issues;
}
