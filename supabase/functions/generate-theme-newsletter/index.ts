/**
 * generate-theme-newsletter: writes this week's newsletter for one tenant.
 *
 * Input: { tenantId, campaignId, weekNumber?, fallbackWeekNumber?, themeImages? }
 * Output: subject line, preview text and 5-7 Studio content blocks
 * (newsletter-header, full-width-image, plain-text, image-text,
 * call-to-action, footer). Website products/events become image-text blocks
 * with the same `connectedContent` provenance "From my website" uses, so the
 * send-time freshness checks still apply.
 *
 * Authorization: a user JWT with campaign.write on the tenant (and RLS access
 * to the campaign), or the service-role key (internal verification only).
 * All context is loaded server-side by tenant, never by the calling user.
 * Every image and link in the output must come from that context; a draft
 * that fails validation is retried once, then rejected.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOOMSITES_API_ORIGIN = "https://bloomsites.app";
const DEFAULT_MODEL = "gpt-4.1";
const ATTEMPT_TIMEOUT_MS = 22_000;
const TOTAL_BUDGET_MS = 40_000;
const MAX_WEBSITE_ITEMS = 6;

/** Phrases that must never reach a customer-facing field. */
export const BANNED_PHRASES = [
  "encourage",
  "review the seeded draft",
  "continue shaping",
  "seeded",
  "[",
  "]",
  "{{",
  "todo",
  "lorem",
  "placeholder",
  "store owner",
  "your customers",
  "this newsletter draft",
];

type ThemeImage = { url: string; alt: string; credit: string };
type WebsiteItem = {
  id: string;
  siteId: string;
  siteName?: string;
  type: "product" | "event";
  title: string;
  description: string;
  imageUrl: string | null;
  publicUrl: string;
  ctaLabel: string;
  updatedAt: string;
  startAt?: string | null;
  timezone?: string | null;
  eventStatus?: string;
  upcomingDateCount?: number;
  price?: string | number | null;
};
type ModelBlock =
  | { type: "full-width-image"; imageUrl: string; imageAlt: string }
  | { type: "plain-text"; body: string }
  | { type: "image-text"; headline: string; body: string; imageUrl: string; imageAlt: string }
  | { type: "product"; itemId: string }
  | { type: "event"; itemId: string }
  | { type: "call-to-action"; headline: string; body: string; buttonText: string; buttonUrl: string };
type ModelDraft = {
  subjectLine: string;
  previewText: string;
  headerTagline: string;
  blocks: ModelBlock[];
};
type GenerationContext = {
  tenantId: string;
  weekNumber: number;
  themeCampaignId: string | null;
  company: Record<string, string>;
  theme: { title: string; theme: string; seasonalFocus: string; brief: string };
  images: ThemeImage[];
  websiteItems: WebsiteItem[];
  links: string[];
  spelling: "Canadian" | "US";
};

const str = (value: unknown, max = 600) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

function httpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

function toImages(value: unknown): ThemeImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const url = httpsUrl(record.url);
    return url ? [{ url, alt: str(record.alt, 300), credit: str(record.credit, 200) }] : [];
  }).slice(0, 6);
}

function spellingFor(country: string, region: string): "Canadian" | "US" {
  const place = country.trim().toLowerCase();
  if (/\bcanada\b|^ca$/.test(place)) return "Canadian";
  if (place) return "US";
  return /^(ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland( and labrador)?|prince edward island|yukon|nunavut|northwest territories|on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yt|nu|nt)$/
    .test(region.trim().toLowerCase())
    ? "Canadian"
    : "US";
}

function normalizeForCompare(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

async function loadCompany(admin: SupabaseClient, tenantId: string) {
  // Company profiles are user-owned rows: resolve them through the tenant's
  // members (the same route bloom-assist's newsletter templates use).
  const members = await admin.from("users").select("id").eq("tenant_id", tenantId);
  if (members.error) throw new Error("company_lookup_failed");
  const ids = (members.data ?? []).map((row: { id: string }) => row.id);
  if (!ids.length) return null;
  const profiles = await admin
    .from("company_profiles")
    .select(
      "company_name, company_overview, brand_voice, tone_of_writing, target_audience, ideal_customer, unique_selling_points, specializations, location_info, city, state_province, country, climate_label, climate_archetype, usda_zone, first_frost_date, last_frost_date, website_url, updated_at",
    )
    .in("user_id", ids)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (profiles.error) throw new Error("company_lookup_failed");
  return (profiles.data?.[0] ?? null) as Record<string, unknown> | null;
}

async function resolveWeek(
  admin: SupabaseClient,
  tenantId: string,
  campaignOrigin: string | null,
  weekNumber: number | null,
  fallbackWeekNumber: number | null,
) {
  if (weekNumber) return weekNumber;
  const match = campaignOrigin?.match(/^weekly_theme:(.+)$/);
  if (match) {
    const reference = match[1];
    const master = reference.match(/^master:(\d{1,2})$/);
    if (master) return Number(master[1]);
    if (UUID.test(reference)) {
      const { data } = await admin
        .from("campaigns")
        .select("week_number")
        .eq("id", reference)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (typeof data?.week_number === "number") return data.week_number;
    }
  }
  return fallbackWeekNumber;
}

async function loadWebsiteItems(admin: SupabaseClient, tenantId: string) {
  const { data: links, error } = await admin
    .from("crm_connected_websites")
    .select("cms_site_id, site_name, site_origin")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("linked_at", { ascending: false })
    .limit(3);
  if (error) return { items: [] as WebsiteItem[], origins: [] as string[] };
  const origins: string[] = [];
  const items: WebsiteItem[] = [];
  const now = Date.now();
  for (const link of links ?? []) {
    for (const kind of ["products", "events"] as const) {
      const upstream = new URL(`${BLOOMSITES_API_ORIGIN}/api/connected-content/catalog`);
      upstream.searchParams.set("siteId", link.cms_site_id);
      upstream.searchParams.set("type", kind);
      upstream.searchParams.set("limit", "12");
      try {
        const res = await fetch(upstream, {
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
          redirect: "error",
        });
        if (!res.ok) continue;
        const payload = await res.json();
        if (payload?.siteId !== link.cms_site_id || !Array.isArray(payload.items)) continue;
        const allowedOrigin = new URL(payload.siteOrigin).origin;
        if (!origins.includes(`${allowedOrigin}/`)) origins.push(`${allowedOrigin}/`);
        for (const raw of payload.items as Record<string, unknown>[]) {
          const publicUrl = httpsUrl(raw?.publicUrl);
          const type = raw?.type;
          if (
            typeof raw?.id !== "string" || !UUID.test(raw.id) || raw.siteId !== link.cms_site_id ||
            !publicUrl || new URL(publicUrl).origin !== allowedOrigin ||
            (type !== "product" && type !== "event") || typeof raw.title !== "string"
          ) continue;
          if (type === "event") {
            const start = typeof raw.startAt === "string" ? Date.parse(raw.startAt) : NaN;
            if (raw.eventStatus !== "available" || !Number.isFinite(start) || start < now) continue;
          }
          items.push({
            id: raw.id,
            siteId: link.cms_site_id,
            siteName: link.site_name,
            type,
            title: str(raw.title, 180),
            description: typeof raw.description === "string" ? raw.description : "",
            imageUrl: httpsUrl(raw.imageUrl) || null,
            publicUrl,
            ctaLabel: str(raw.ctaLabel, 70),
            updatedAt: String(raw.updatedAt ?? ""),
            startAt: typeof raw.startAt === "string" ? raw.startAt : null,
            timezone: typeof raw.timezone === "string" ? raw.timezone : null,
            eventStatus: typeof raw.eventStatus === "string" ? raw.eventStatus : undefined,
            upcomingDateCount: typeof raw.upcomingDateCount === "number" ? raw.upcomingDateCount : undefined,
            price: typeof raw.price === "string" || typeof raw.price === "number" ? raw.price : null,
          });
        }
      } catch {
        // The newsletter is still written without website items.
      }
    }
  }
  // Published products with photos first, then upcoming events by date.
  const products = items.filter((item) => item.type === "product" && item.imageUrl).slice(0, 4);
  const events = items
    .filter((item) => item.type === "event")
    .sort((a, b) => Date.parse(a.startAt ?? "") - Date.parse(b.startAt ?? ""))
    .slice(0, MAX_WEBSITE_ITEMS - products.length);
  return { items: [...products, ...events].slice(0, MAX_WEBSITE_ITEMS), origins };
}

async function loadContext(
  admin: SupabaseClient,
  tenantId: string,
  weekNumber: number,
  clientImages: ThemeImage[],
): Promise<GenerationContext> {
  const [company, themeRows, masterRow, website] = await Promise.all([
    loadCompany(admin, tenantId),
    admin
      .from("campaigns")
      .select("id, title, theme, description, prompt, theme_images")
      .eq("tenant_id", tenantId)
      .eq("week_number", weekNumber)
      .is("deleted_at", null)
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("master_campaign_templates")
      .select("title, theme, seasonal_focus, content_ideas, theme_images")
      .eq("week_number", weekNumber)
      .maybeSingle(),
    loadWebsiteItems(admin, tenantId),
  ]);
  if (themeRows.error || masterRow.error) throw new Error("theme_lookup_failed");
  const row = themeRows.data?.[0] ?? null;
  const master = masterRow.data ?? null;
  if (!row && !master) throw new Error("no_theme_for_week");

  let images = toImages(row?.theme_images);
  if (!images.length) images = toImages(master?.theme_images);
  // Photos the client already chose this week (fetch-unsplash-images) when
  // they could not be stored on a theme row.
  if (!images.length) images = clientImages;

  const profile = company ?? {};
  const websiteUrl = httpsUrl(profile.website_url);
  const links = [...new Set([
    ...(websiteUrl ? [websiteUrl] : []),
    ...website.origins,
    ...website.items.map((item) => item.publicUrl),
  ])];

  return {
    tenantId,
    weekNumber,
    themeCampaignId: row?.id ?? null,
    company: {
      name: str(profile.company_name, 120),
      overview: str(profile.company_overview, 500),
      brandVoice: str(profile.brand_voice, 500),
      tone: str(profile.tone_of_writing, 500),
      audience: str(profile.target_audience || profile.ideal_customer, 300),
      uniqueSellingPoints: str(profile.unique_selling_points, 500),
      specializations: str(profile.specializations, 300),
      location: str(profile.location_info, 120) ||
        [str(profile.city), str(profile.state_province), str(profile.country)].filter(Boolean).join(", "),
      climate: [
        str(profile.climate_label, 120),
        profile.usda_zone ? `USDA zone ${str(profile.usda_zone, 20)}` : "",
        profile.first_frost_date ? `first frost around ${str(profile.first_frost_date, 40)}` : "",
        profile.last_frost_date ? `last frost around ${str(profile.last_frost_date, 40)}` : "",
      ].filter(Boolean).join("; "),
    },
    theme: {
      title: str(row?.title || master?.title, 160),
      theme: str(row?.theme || master?.theme, 160),
      seasonalFocus: str(master?.seasonal_focus, 200),
      brief: str(row?.description || row?.prompt || master?.content_ideas, 800),
    },
    images,
    websiteItems: website.items,
    links,
    spelling: spellingFor(str(profile.country), str(profile.state_province)),
  };
}

// ---------------------------------------------------------------------------
// Model call
// ---------------------------------------------------------------------------

const textField = { type: "string" };
const blockSchema = (type: string, fields: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: ["type", ...Object.keys(fields)],
  properties: { type: { type: "string", enum: [type] }, ...fields },
});
export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subjectLine", "previewText", "headerTagline", "blocks"],
  properties: {
    subjectLine: textField,
    previewText: textField,
    headerTagline: textField,
    blocks: {
      type: "array",
      items: {
        anyOf: [
          blockSchema("full-width-image", { imageUrl: textField, imageAlt: textField }),
          blockSchema("plain-text", { body: textField }),
          blockSchema("image-text", { headline: textField, body: textField, imageUrl: textField, imageAlt: textField }),
          blockSchema("product", { itemId: textField }),
          blockSchema("event", { itemId: textField }),
          blockSchema("call-to-action", { headline: textField, body: textField, buttonText: textField, buttonUrl: textField }),
        ],
      },
    },
  },
};

function buildSystemPrompt(context: GenerationContext) {
  return [
    `You write the weekly email newsletter for ${context.company.name || "a local garden centre"}, sent to its customers.`,
    "Write as the store, directly to customers (\"we\", \"you\"). Never address the store owner or staff, never describe the newsletter itself, and never give instructions about editing, reviewing or sending.",
    `Use ${context.spelling} English spelling throughout.`,
    `Give specific, practical garden advice for this week that fits ${context.company.location || "the store's area"}${context.company.climate ? ` (${context.company.climate})` : ""} and this time of year: name at least two real tasks and real plants. Avoid generic filler.`,
    "Mention a website product or event only through a product or event block; do not invent products, prices, offers, dates or events.",
    "The weekly theme brief is guidance for you only. Never copy its wording into the newsletter; write fresh copy for customers.",
    "Never write placeholder or instruction text, square brackets, merge tags, TODO, lorem ipsum, or the words \"encourage\", \"seeded\" or \"placeholder\".",
    "Use only image URLs, item IDs and link URLs listed in the context. Never invent or change a link or image URL.",
    "Structure: 3 to 5 blocks after the header, in this order: a full-width-image hero using a theme photo (when theme photos exist), one plain-text introduction (2 short paragraphs, separated by a blank line), one image-text story with this week's practical advice using a different theme photo (when a second theme photo exists), up to two product or event blocks from the website items that suit the theme, and exactly one call-to-action whose buttonUrl is one of the listed links (when links exist). Do not repeat the same image twice.",
    "Subject line: under 60 characters, specific and inviting. Preview text: 40 to 110 characters, adds something the subject does not say. Header tagline: under 70 characters.",
    "Body copy is plain text (no HTML, no markdown).",
  ].join("\n");
}

function buildUserPrompt(context: GenerationContext, previousErrors: string[]) {
  const payload = {
    store: context.company,
    week: context.weekNumber,
    theme: {
      title: context.theme.title,
      theme: context.theme.theme,
      seasonalFocus: context.theme.seasonalFocus,
      internalBriefDoNotCopy: context.theme.brief,
    },
    themePhotos: context.images.map((image) => ({ imageUrl: image.url, description: image.alt })),
    websiteItems: context.websiteItems.map((item) => ({
      itemId: item.id,
      kind: item.type,
      title: item.title,
      description: str(item.description, 240),
      price: item.price ?? null,
      startsAt: item.startAt ?? null,
    })),
    links: context.links,
  };
  const lines = [
    "Write this week's newsletter from this context (JSON):",
    JSON.stringify(payload),
  ];
  if (previousErrors.length) {
    lines.push(
      "Your previous answer was rejected for these reasons. Fix every one:",
      ...previousErrors.map((error) => `- ${error}`),
    );
  }
  return lines.join("\n");
}

type ModelResult = {
  draft: unknown;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
};

async function callModel(
  apiKey: string,
  model: string,
  context: GenerationContext,
  previousErrors: string[],
  timeoutMs: number,
): Promise<ModelResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1800,
      response_format: {
        type: "json_schema",
        json_schema: { name: "theme_newsletter", strict: true, schema: DRAFT_SCHEMA },
      },
      messages: [
        { role: "system", content: buildSystemPrompt(context) },
        { role: "user", content: buildUserPrompt(context, previousErrors) },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`model_http_${res.status}:${detail.slice(0, 200)}`);
  }
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("model_empty");
  let draft: unknown;
  try {
    draft = JSON.parse(content);
  } catch {
    draft = null;
  }
  return { draft, usage: body?.usage ?? null };
}

// ---------------------------------------------------------------------------
// Validation and Studio blocks
// ---------------------------------------------------------------------------

const KNOWN_TYPES = new Set(["full-width-image", "plain-text", "image-text", "product", "event", "call-to-action"]);

function isDraft(value: unknown): value is ModelDraft {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.subjectLine === "string" && typeof record.previewText === "string" &&
    typeof record.headerTagline === "string" && Array.isArray(record.blocks) &&
    record.blocks.every((block) => block && typeof block === "object" && typeof (block as { type?: unknown }).type === "string");
}

function collectStrings(value: unknown, out: string[] = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => collectStrings(entry, out));
  return out;
}

export function validateDraft(value: unknown, context: GenerationContext): string[] {
  if (!isDraft(value)) return ["The answer did not match the JSON schema."];
  const errors: string[] = [];
  const imageUrls = new Set([
    ...context.images.map((image) => image.url),
    ...context.websiteItems.flatMap((item) => (item.imageUrl ? [item.imageUrl] : [])),
  ]);
  const itemIds = new Set(context.websiteItems.map((item) => item.id));
  const links = new Set(context.links);

  if (!value.subjectLine.trim() || value.subjectLine.length > 90) errors.push("subjectLine must be 1-90 characters.");
  if (value.previewText.trim().length < 20 || value.previewText.length > 140) errors.push("previewText must be 20-140 characters.");
  if (normalizeForCompare(value.previewText) === normalizeForCompare(value.subjectLine)) errors.push("previewText must differ from subjectLine.");
  if (value.blocks.length < 3 || value.blocks.length > 5) errors.push("Write 3 to 5 blocks after the header.");
  if (!value.blocks.some((block) => block.type === "plain-text")) errors.push("Include one plain-text introduction.");
  const ctas = value.blocks.filter((block) => block.type === "call-to-action");
  if (links.size > 0 && ctas.length !== 1) errors.push("Include exactly one call-to-action.");
  if (links.size === 0 && ctas.length > 0) errors.push("There are no links in the context, so leave out the call-to-action.");

  const usedImages = new Set<string>();
  const usedItems = new Set<string>();
  for (const block of value.blocks) {
    if (!KNOWN_TYPES.has(block.type)) {
      errors.push(`Unknown block type "${block.type}".`);
      continue;
    }
    if ("imageUrl" in block) {
      if (!imageUrls.has(block.imageUrl)) errors.push(`Image URL not in the context: ${block.imageUrl.slice(0, 120)}`);
      else if (usedImages.has(block.imageUrl)) errors.push("Do not repeat the same image.");
      usedImages.add(block.imageUrl);
    }
    if ("itemId" in block) {
      const item = context.websiteItems.find((entry) => entry.id === block.itemId);
      if (!itemIds.has(block.itemId) || !item || item.type !== block.type) errors.push(`Unknown ${block.type} itemId: ${block.itemId}`);
      else if (usedItems.has(block.itemId)) errors.push("Do not repeat a website item.");
      usedItems.add(block.itemId);
    }
    if ("buttonUrl" in block && !links.has(block.buttonUrl)) errors.push(`Link not in the context: ${block.buttonUrl.slice(0, 120)}`);
  }

  const brief = normalizeForCompare(context.theme.brief);
  for (const text of collectStrings({ ...value, blocks: value.blocks.map(({ type: _t, ...rest }) => rest) })) {
    const lower = text.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (phrase === "[" || phrase === "]" || phrase === "{{") {
        if (text.includes(phrase)) errors.push(`Remove "${phrase}" from: ${text.slice(0, 80)}`);
      } else if (lower.includes(phrase)) {
        errors.push(`Remove the phrase "${phrase}" from: ${text.slice(0, 80)}`);
      }
    }
    if (brief.length > 20 && normalizeForCompare(text).includes(brief)) {
      errors.push("Do not copy the internal theme brief into the newsletter.");
    }
  }
  return [...new Set(errors)];
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((part) => escapeHtml(part.trim()).replace(/\n/g, "<br />"))
    .filter(Boolean)
    .join("<br /><br />");
}

function truncateAtWord(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:.\-–—]+$/, "");
  return `${base}…`;
}

function eventDate(item: WebsiteItem) {
  if (!item.startAt) return "";
  const time = new Date(item.startAt);
  if (Number.isNaN(time.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: item.timezone || "UTC" }).format(time);
  } catch {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(time);
  }
}

const SIZE_UNIT = '(?:gal(?:lon)?s?|g|qt|quarts?|l|litres?|liters?|ml|in(?:ch(?:es)?)?|"|cm|mm|pots?|pk|packs?|oz|lbs?|kg)';
const SIZE_SUFFIX = new RegExp(`\\s*(?:[·•|]|\\s[-–—])\\s*#?\\d+(?:[.,/]\\d+)?\\s*${SIZE_UNIT}(?![a-z]).*$`, "i");
const SIZE_PARENS = new RegExp(`\\s*\\(\\s*#?\\d+(?:[.,/]\\d+)?\\s*${SIZE_UNIT}[^)]*\\)\\s*$`, "i");
function stripProductSizeSuffix(title: string) {
  const stripped = title.replace(SIZE_SUFFIX, "").replace(SIZE_PARENS, "").trim();
  return stripped || title.trim();
}

/** Mirrors buildConnectedContentBlock (src/lib/connectedContent.ts) field for field. */
function websiteBlock(item: WebsiteItem) {
  const isProduct = item.type === "product";
  const formattedDate = eventDate(item);
  const date = !isProduct && (item.upcomingDateCount ?? 0) > 1 && formattedDate
    ? `Multiple dates from ${formattedDate}`
    : formattedDate;
  const price = isProduct && item.price !== null && item.price !== undefined && item.price !== ""
    ? (typeof item.price === "number" ? `$${item.price.toFixed(2)}` : String(item.price).trim().slice(0, 30))
    : "";
  return {
    type: "image-text",
    headline: (isProduct ? stripProductSizeSuffix(item.title) : item.title).slice(0, 180),
    subheading: price || date || (isProduct ? "" : "Upcoming event"),
    body: isProduct ? truncateAtWord(item.description ?? "", 180) : (item.description ?? "").trim().slice(0, 440),
    imageUrl: item.imageUrl ?? "",
    imageAlt: item.title.slice(0, 130),
    buttonText: (item.ctaLabel || "Learn more").slice(0, 70),
    buttonUrl: item.publicUrl,
    connectedContent: {
      siteId: item.siteId,
      itemId: item.id,
      type: item.type,
      updatedAt: item.updatedAt,
      publicUrl: item.publicUrl,
      startAt: item.startAt ?? null,
      sourceTitle: item.title,
      sourceDescription: item.description,
      sourceImageUrl: item.imageUrl,
      upcomingDateCount: item.upcomingDateCount,
      siteName: item.siteName,
    },
  };
}

/** Studio content blocks: header and footer take their styling from brand defaults in Studio. */
function toStudioContent(draft: ModelDraft, context: GenerationContext) {
  const blocks: Record<string, unknown>[] = [
    { type: "newsletter-header", tagline: draft.headerTagline.trim() },
  ];
  for (const block of draft.blocks) {
    switch (block.type) {
      case "full-width-image":
        blocks.push({ type: "full-width-image", imageUrl: block.imageUrl, imageAlt: block.imageAlt.trim() });
        break;
      case "plain-text":
        blocks.push({ type: "plain-text", body: paragraphs(block.body) });
        break;
      case "image-text":
        blocks.push({
          type: "image-text",
          headline: block.headline.trim(),
          body: paragraphs(block.body),
          imageUrl: block.imageUrl,
          imageAlt: block.imageAlt.trim(),
        });
        break;
      case "product":
      case "event": {
        const item = context.websiteItems.find((entry) => entry.id === block.itemId);
        if (item) blocks.push(websiteBlock(item));
        break;
      }
      case "call-to-action":
        blocks.push({
          type: "call-to-action",
          headline: block.headline.trim(),
          body: paragraphs(block.body),
          buttonText: block.buttonText.trim(),
          buttonUrl: block.buttonUrl,
        });
        break;
    }
  }
  blocks.push({ type: "footer" });
  return blocks;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function logGeneration(entry: Record<string, unknown>) {
  // One line per generation; there is no tenant AI-usage table to write to.
  console.log(JSON.stringify({ event: "theme_newsletter_generation", ...entry }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const startedAt = Date.now();

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceRole) return respond({ error: "service_unavailable" }, 503);
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond({ error: "authentication_required" }, 401);

  const input = await req.json().catch(() => null) as Record<string, unknown> | null;
  const tenantId = typeof input?.tenantId === "string" ? input.tenantId : "";
  const campaignId = typeof input?.campaignId === "string" ? input.campaignId : "";
  const weekInput = Number(input?.weekNumber);
  const fallbackInput = Number(input?.fallbackWeekNumber);
  const weekNumber = Number.isInteger(weekInput) && weekInput >= 1 && weekInput <= 53 ? weekInput : null;
  const fallbackWeekNumber = Number.isInteger(fallbackInput) && fallbackInput >= 1 && fallbackInput <= 53 ? fallbackInput : null;
  const trustedService = token === serviceRole;
  // The service-role path exists for internal verification runs only and
  // may omit a campaign; user calls always name a draft in their tenant.
  if (!UUID.test(tenantId) || (campaignId && !UUID.test(campaignId)) || (!campaignId && !trustedService)) {
    return respond({ error: "invalid_request" }, 400);
  }

  const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  let campaignOrigin: string | null = null;
  if (!trustedService) {
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await authed.auth.getUser(token);
    if (userError || !user) return respond({ error: "unauthorized" }, 401);
    const permission = await authed.rpc("has_tenant_permission", {
      p_tenant_id: tenantId,
      p_permission: "campaign.write",
      p_location_id: null,
    });
    if (permission.error || permission.data !== true) return respond({ error: "campaign_permission_required" }, 403);
    // RLS-scoped read: the caller must be able to see this draft in this tenant.
    const campaign = await authed
      .from("crm_campaigns")
      .select("id, origin")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (campaign.error || !campaign.data) return respond({ error: "campaign_not_found" }, 404);
    campaignOrigin = campaign.data.origin ?? null;
  } else if (campaignId) {
    const campaign = await admin
      .from("crm_campaigns")
      .select("id, origin")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (campaign.error || !campaign.data) return respond({ error: "campaign_not_found" }, 404);
    campaignOrigin = campaign.data.origin ?? null;
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("THEME_NEWSLETTER_MODEL") || DEFAULT_MODEL;
  const base = { tenantId, campaignId: campaignId || null, model, service: trustedService };
  if (!apiKey) {
    logGeneration({ ...base, outcome: "not_configured", latencyMs: Date.now() - startedAt });
    return respond({ error: "ai_not_configured" }, 503);
  }

  const week = await resolveWeek(admin, tenantId, campaignOrigin, weekNumber, fallbackWeekNumber);
  if (!week) return respond({ error: "week_required" }, 400);

  let context: GenerationContext;
  try {
    context = await loadContext(admin, tenantId, week, toImages(input?.themeImages));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "context_failed";
    logGeneration({ ...base, week, outcome: reason, latencyMs: Date.now() - startedAt });
    return respond({ error: reason }, reason === "no_theme_for_week" ? 404 : 503);
  }

  const tokens = { prompt: 0, completion: 0, total: 0 };
  let errors: string[] = [];
  let attempts = 0;
  for (attempts = 1; attempts <= 2; attempts++) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < 8_000) break;
    try {
      const result = await callModel(apiKey, model, context, errors, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
      tokens.prompt += result.usage?.prompt_tokens ?? 0;
      tokens.completion += result.usage?.completion_tokens ?? 0;
      tokens.total += result.usage?.total_tokens ?? 0;
      errors = validateDraft(result.draft, context);
      if (!errors.length) {
        const draft = result.draft as ModelDraft;
        const contentBlocks = toStudioContent(draft, context);
        const latencyMs = Date.now() - startedAt;
        logGeneration({ ...base, week, outcome: "success", attempts, tokens, latencyMs, blocks: contentBlocks.length });
        return respond({
          ok: true,
          subjectLine: draft.subjectLine.trim(),
          previewText: draft.previewText.trim(),
          contentBlocks,
          theme: {
            weekNumber: context.weekNumber,
            themeCampaignId: context.themeCampaignId,
            title: context.theme.title,
            brief: context.theme.brief,
          },
          context: {
            imageUrls: [
              ...context.images.map((image) => image.url),
              ...context.websiteItems.flatMap((item) => (item.imageUrl ? [item.imageUrl] : [])),
            ],
            links: context.links,
            websiteItems: context.websiteItems,
          },
          model,
          attempts,
          tokens,
          latencyMs,
        });
      }
    } catch (error) {
      errors = [error instanceof Error ? error.message.slice(0, 200) : "model_error"];
      if (errors[0].startsWith("model_http_4")) break;
    }
  }
  logGeneration({ ...base, week, outcome: "rejected", attempts: Math.min(attempts, 2), tokens, latencyMs: Date.now() - startedAt, errors: errors.slice(0, 8) });
  return respond({ error: "generation_failed", reasons: errors.slice(0, 8) }, 422);
});
