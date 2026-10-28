import type {
  BlockAppearance,
  EdgeSpacing,
  HeadingLevel,
  NewsletterSettings,
  TextAppearance,
  TextRole,
} from "../../../types/newsletterDesign.ts";

export const EMAIL_FONTS = [
  "Arial, Helvetica, sans-serif",
  "Verdana, Geneva, sans-serif",
  "Tahoma, Geneva, sans-serif",
  "Georgia, Times, serif",
  "Times New Roman, Times, serif",
  "Trebuchet MS, Arial, sans-serif",
  "Courier New, Courier, monospace",
] as const;
export const HEADING_SIZES: Record<HeadingLevel, number> = {
  h1: 32,
  h2: 26,
  h3: 22,
  h4: 20,
  h5: 18,
  h6: 16,
};
export const DEFAULT_NEWSLETTER_SETTINGS: NewsletterSettings = {
  version: 1,
  width: 640,
  backgroundColor: "#f5f5f5",
  contentBackgroundColor: "#ffffff",
  blockGap: 16,
};
export const clampNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
export function emailColor(value: unknown, fallback = "#172d2c"): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color))
    return color;
  if (
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i.test(
      color,
    )
  )
    return color;
  return color === "transparent" ? color : fallback;
}
export function emailFont(
  value: unknown,
  fallback = EMAIL_FONTS[0] as string,
): string {
  return typeof value === "string" &&
    value.length <= 180 &&
    /^[a-z\d\s,'"-]+$/i.test(value) &&
    !/url|expression|javascript/i.test(value)
    ? value.replace(/"/g, "\'")
    : fallback;
}
export function normalizeNewsletterSettings(
  value: unknown,
): NewsletterSettings {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as NewsletterSettings)
      : ({} as NewsletterSettings);
  return {
    ...raw,
    version: 1,
    width: clampNumber(raw.width, 640, 480, 800),
    backgroundColor: emailColor(raw.backgroundColor, "#f5f5f5"),
    contentBackgroundColor: emailColor(raw.contentBackgroundColor, "#ffffff"),
    blockGap: clampNumber(raw.blockGap, 16, 0, 96),
    fontFamily: raw.fontFamily ? emailFont(raw.fontFamily) : undefined,
    allowedFonts: Array.isArray(raw.allowedFonts)
      ? raw.allowedFonts
          .filter(
            (font) => typeof font === "string" && emailFont(font, "") === font,
          )
          .slice(0, 20)
      : undefined,
    assetLocations: Array.isArray(raw.assetLocations)
      ? raw.assetLocations
          .filter(
            (entry) =>
              entry &&
              typeof entry.id === "string" &&
              typeof entry.name === "string" &&
              typeof entry.url === "string",
          )
          .slice(0, 20)
      : [],
  };
}
function definedProperties<T extends object>(value?: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
export function mergeAppearance(
  defaults?: BlockAppearance,
  overrides?: BlockAppearance,
): BlockAppearance {
  const text: Partial<Record<TextRole, TextAppearance>> = {};
  for (const role of new Set([
    ...Object.keys(defaults?.text ?? {}),
    ...Object.keys(overrides?.text ?? {}),
  ]) as Set<TextRole>) {
    text[role] = {
      ...definedProperties(defaults?.text?.[role]),
      ...definedProperties(overrides?.text?.[role]),
    };
  }
  const edge = (key: "margin" | "padding" | "imagePadding" | "imageMargin") =>
    defaults?.[key] || overrides?.[key]
      ? {
          ...definedProperties(defaults?.[key]),
          ...definedProperties(overrides?.[key]),
        }
      : undefined;
  return {
    ...definedProperties(defaults),
    ...definedProperties(overrides),
    margin: edge("margin"),
    padding: edge("padding"),
    imagePadding: edge("imagePadding"),
    imageMargin: edge("imageMargin"),
    border:
      defaults?.border || overrides?.border
        ? {
            ...definedProperties(defaults?.border),
            ...definedProperties(overrides?.border),
          }
        : undefined,
    text,
  };
}
export function edgeCss(value?: EdgeSpacing, fallback = 0): string {
  return ["top", "right", "bottom", "left"]
    .map(
      (key) =>
        `${clampNumber(value?.[key as keyof EdgeSpacing], fallback, 0, 160)}px`,
    )
    .join(" ");
}
export function textCss(
  value: TextAppearance = {},
  fallback: TextAppearance = {},
): string {
  const merged = { ...fallback, ...value };
  return (
    [
      merged.size != null
        ? `font-size:${clampNumber(merged.size, 16, 8, 96)}px`
        : "",
      merged.weight != null
        ? `font-weight:${Math.round(clampNumber(merged.weight, 400, 100, 900) / 100) * 100}`
        : "",
      merged.lineHeight != null
        ? `line-height:${clampNumber(merged.lineHeight, 1.6, 1, 3)}`
        : "",
      merged.color ? `color:${emailColor(merged.color)}` : "",
      merged.fontFamily ? `font-family:${emailFont(merged.fontFamily)}` : "",
    ]
      .filter(Boolean)
      .join(";") + ";"
  );
}
export function safeEmailUrl(value: unknown, image = false): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    /[\u0000-\u0020\u007f<>"`\\]/.test(value.trim())
  )
    return "";
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) return "";
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    if (!image && ["mailto:", "tel:"].includes(url.protocol)) return url.href;
  } catch {
    /* invalid/relative link */
  }
  return "";
}
export function resolveAssetUrl(value: string, base?: string): string {
  if (!value.trim()) return "";
  if (safeEmailUrl(value, true)) return safeEmailUrl(value, true);
  let decoded = value;
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return "";
  }
  if (
    /(?:^|\/)\.\.(?:\/|$)|[\\\u0000-\u001f]/.test(decoded) ||
    decoded.startsWith("//")
  )
    return "";
  const baseUrl = safeEmailUrl(base, true);
  if (
    !baseUrl ||
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    value.startsWith("//") ||
    value.startsWith("/") ||
    /(?:^|\/)\.\.(?:\/|$)|[\\\u0000-\u001f]/.test(value)
  )
    return "";
  try {
    return safeEmailUrl(
      new URL(value, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).href,
      true,
    );
  } catch {
    return "";
  }
}
