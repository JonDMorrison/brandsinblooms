// One source of truth for social icons in the Footer and Social Media Links
// blocks. The Studio canvas, Preview & Test and the sent email all call these
// helpers, so the three can no longer drift apart.
//
// Every icon is a PNG <img>: email clients do not render SVG and ignore CSS
// filters. Single-colour icons come from /social-icon/:platform/:style/:hex.png
// (api/social-icon.js); unstyled brand icons keep the hosted brand PNGs.
//
// Relative, extension-bearing imports: the send pipeline loads this in Deno.
import type {
  SocialLink,
  StudioBlock,
  StudioSocialPlatform,
} from "../../types/studioBlocks.ts";

export const SOCIAL_ICON_ORIGIN = "https://bloomsuite.app";

export type SocialIconShape = "filled" | "square" | "outlined" | "minimal";

export const SOCIAL_PLATFORM_ORDER: StudioSocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
];

export const SOCIAL_PLATFORM_LABELS: Record<StudioSocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  threads: "Threads",
};

export const SOCIAL_PLATFORM_BRAND_COLORS: Record<StudioSocialPlatform, string> = {
  facebook: "#1877F2",
  instagram: "#C13584",
  twitter: "#111111",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#111111",
  pinterest: "#E60023",
  threads: "#111111",
};

// Full-colour brand icons already hosted under /social-icons. Used only for
// the filled style when no colour has been chosen.
const BRAND_ICON_PLATFORMS = new Set<StudioSocialPlatform>([
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
]);

// Colours the block factory wrote as footer defaults. A footer carrying one of
// these did not have its colour picked by a person.
const FOOTER_FACTORY_ICON_COLORS = new Set(["cbd5e1", "64748b"]);

const SHAPES: SocialIconShape[] = ["filled", "square", "outlined", "minimal"];

function isPlatform(value: unknown): value is StudioSocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORM_ORDER as string[]).includes(value);
}

/** "#abc", "#aabbcc" or "aabbcc" → "aabbcc"; anything else → null. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^[0-9a-f]{3}$/.test(raw)) return raw.split("").map((c) => c + c).join("");
  return null;
}

function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** White icons on dark backgrounds, dark icons on light ones. */
export function contrastIconColor(backgroundColor: unknown): string {
  const hex = normalizeHexColor(backgroundColor);
  if (!hex) return "1f2937";
  return luminance(hex) < 0.4 ? "ffffff" : "1f2937";
}

export function normalizeSocialIconShape(value: unknown): SocialIconShape {
  return SHAPES.includes(value as SocialIconShape) ? (value as SocialIconShape) : "filled";
}

/**
 * The image URL for one icon. `color` null means "brand colours": the hosted
 * brand PNG where one exists, otherwise the brand colour through the route.
 */
export function socialIconSrc(
  platform: StudioSocialPlatform,
  shape: SocialIconShape,
  color: string | null,
  origin = SOCIAL_ICON_ORIGIN,
): string {
  if (color === null && shape === "filled" && BRAND_ICON_PLATFORMS.has(platform)) {
    return `${origin}/social-icons/${platform}.png`;
  }
  const hex = color ?? normalizeHexColor(SOCIAL_PLATFORM_BRAND_COLORS[platform]) ?? "111111";
  return `${origin}/social-icon/${platform}/${shape}/${hex}.png`;
}

/**
 * Social links as an ordered array. Saved campaigns may hold the legacy
 * platform-keyed object, whose key order Postgres jsonb does not keep; the
 * saved `order` (the panel order) restores it, then the default order.
 */
export function normalizeSocialLinks(value: unknown, order?: unknown): SocialLink[] {
  if (Array.isArray(value)) {
    return value.filter(
      (link): link is SocialLink => Boolean(link) && isPlatform((link as SocialLink).platform),
    );
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, { enabled?: unknown; url?: unknown } | undefined>;
  const saved = Array.isArray(order) ? order.filter(isPlatform) : [];
  const platforms = [
    ...saved,
    ...SOCIAL_PLATFORM_ORDER.filter((platform) => !saved.includes(platform)),
  ];
  return platforms.flatMap((platform) => {
    const entry = record[platform];
    if (!entry) return [];
    return [{
      platform,
      enabled: Boolean(entry.enabled),
      url: typeof entry.url === "string" ? entry.url : "",
    }];
  });
}

/**
 * The footer's "Show Social Icons" switch. An explicit choice always wins;
 * a footer that never set it follows whether brand settings hold links.
 */
export function isFooterSocialVisible(block: StudioBlock, hasConfiguredLinks: boolean) {
  return typeof block.showSocialInFooter === "boolean"
    ? block.showSocialInFooter
    : hasConfiguredLinks;
}

export function isFooterIconColorPicked(block: StudioBlock) {
  if (block.footerIconColorPicked === true) return true;
  const hex = normalizeHexColor(block.footerIconColor);
  if (!hex) return false;
  if (FOOTER_FACTORY_ICON_COLORS.has(hex)) return false;
  // The factory also seeded the footer link colour as the icon colour.
  return hex !== normalizeHexColor(block.linkColor);
}

/**
 * Footer icon: Minimal and Outlined draw the glyph in the Icon Colour (or a
 * colour that contrasts with the footer). Filled keeps brand colours unless a
 * colour was picked; then it is a circle in that colour with a white glyph.
 */
export function resolveFooterSocialIcon(
  block: StudioBlock,
  platform: StudioSocialPlatform,
  backgroundColor: unknown,
) {
  const shape = normalizeSocialIconShape(block.footerIconStyle);
  const picked = isFooterIconColorPicked(block) ? normalizeHexColor(block.footerIconColor) : null;
  const color =
    shape === "filled" || shape === "square"
      ? picked
      : picked ?? normalizeHexColor(block.footerIconColor) ?? contrastIconColor(backgroundColor);
  return { shape, color, src: socialIconSrc(platform, shape, color) };
}

/** Social Media Links icon, following its Color Mode (brand, mono, custom). */
export function resolveSocialFollowIcon(
  block: StudioBlock,
  platform: StudioSocialPlatform,
  monoColor: unknown,
) {
  const shape = normalizeSocialIconShape(block.iconStyle ?? block.socialIconStyle);
  const mode =
    block.iconColorMode ??
    (block.socialColorMode === "monochrome" ? "mono" : block.socialColorMode) ??
    "brand";
  let color: string | null;
  if (mode === "custom") color = normalizeHexColor(block.customIconColor) ?? "111827";
  else if (mode === "mono") color = normalizeHexColor(monoColor) ?? "111827";
  else color = shape === "filled" ? null : normalizeHexColor(SOCIAL_PLATFORM_BRAND_COLORS[platform]);
  return { shape, color, src: socialIconSrc(platform, shape, color) };
}
