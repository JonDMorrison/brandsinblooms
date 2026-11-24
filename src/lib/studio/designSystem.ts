// Relative, extension-bearing specifiers: this module is reachable from
// supabase/functions/_shared/* and must resolve under the Deno bundler.
// CompanyInfo comes from types/company rather than the useCompanyInfo hook
// so React and the browser Supabase client stay out of the function graph.
import type { CompanyInfo } from "../../types/company.ts";
import type {
  SocialLink,
  StudioSocialPlatform,
} from "../../types/studioBlocks.ts";

export const STUDIO_SOCIAL_PLATFORM_ORDER: StudioSocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
];

const DEFAULT_HEADLINE_FONT_FAMILY = "var(--joy-fontFamily-display)";
const DEFAULT_BODY_FONT_FAMILY = "var(--joy-fontFamily-body)";

export type StudioDesignSystemFont = {
  id: string;
  name: string;
  displayName: string;
  googleFontsUrl: string;
  fontFamilyCss: string;
};

export type StudioDesignSystemCompany = {
  name: string;
  email: string;
  phone: string;
  websiteUrl: string;
  address: string;
  addressLines: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  logoUrl: string;
  emailDomain: string;
  footerLegalText: string;
};

export type StudioDesignSystemColors = {
  /**
   * The profile still holds the company_profiles column defaults for all four
   * brand colours, i.e. nobody chose them. New content (blank canvas, new
   * blocks, new footers, colour swatches) then starts neutral instead of in a
   * stock green. Rendering ignores this flag, so stored and sent campaigns
   * render exactly as before.
   */
  brandColorsAreDefaults?: boolean;
  /**
   * brand_primary_color is empty or still the stock #22c55e. New footers and
   * buttons then use the neutral dark preset; drafts carrying
   * NewsletterSettings.contrastGuard render brand buttons neutral too.
   */
  primaryIsUnset?: boolean;
  primary?: string;
  secondary?: string;
  accent?: string;
  text?: string;
  primaryContrastText: string;
  footerBackground?: string;
  footerText?: string;
  footerLink?: string;
  footerDivider?: string;
  footerLogoBackground?: string;
  footerLogoText?: string;
};

export type StudioDesignSystemTypography = {
  selected: StudioDesignSystemFont | null;
  headline: StudioDesignSystemFont | null;
  subheading: StudioDesignSystemFont | null;
  body: StudioDesignSystemFont | null;
  button: StudioDesignSystemFont | null;
  brandFamily: string;
  headlineFamily: string;
  subheadingFamily: string;
  bodyFamily: string;
  buttonFamily: string;
  fontUrls: string[];
};

export type StudioDesignSystemColorPresets = {
  core: string[];
  expanded: string[];
};

export type StudioDesignSystemSocial = {
  links: SocialLink[];
  hasConfiguredLinks: boolean;
};

export type StudioDesignSystem = {
  company: StudioDesignSystemCompany;
  colors: StudioDesignSystemColors;
  typography: StudioDesignSystemTypography;
  social: StudioDesignSystemSocial;
  colorPresets: StudioDesignSystemColorPresets;
  fontUrls: string[];
};

function stringValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFontFamily(fontFamily: string) {
  return fontFamily
    .replace(/^font-family\s*:\s*/i, "")
    .replace(/;+\s*$/g, "")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const orderedValues: string[] = [];

  values.forEach((value) => {
    const normalizedValue = stringValue(value);

    if (!normalizedValue) {
      return;
    }

    const dedupeKey = normalizedValue.toLowerCase();

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    orderedValues.push(normalizedValue);
  });

  return orderedValues;
}

function normalizeFont(
  font:
    | CompanyInfo["selectedFont"]
    | CompanyInfo["headlineFont"]
    | CompanyInfo["subheadingFont"]
    | CompanyInfo["bodyFont"]
    | CompanyInfo["buttonFont"]
    | null
    | undefined,
): StudioDesignSystemFont | null {
  if (!font) {
    return null;
  }

  return {
    id: font.id,
    name: font.name,
    displayName: font.displayName,
    googleFontsUrl: stringValue(font.googleFontsUrl),
    fontFamilyCss: normalizeFontFamily(stringValue(font.fontFamilyCss)),
  };
}

function resolveFontFamily(
  font: StudioDesignSystemFont | null,
  fallback: string,
) {
  return font?.fontFamilyCss || fallback;
}

// Defense against malformed company_profiles rows where the email
// address ended up in the postal_code (or city / state) column. We saw
// this on a tenant whose website-extraction tool scraped the contact
// email into postal_code; the assembled footer line read
// "Chilliwack, BC, info@flowerhousemarket.ca". Suppress any field that
// matches an email shape so the address line stays clean even when the
// underlying data is wrong.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function suppressEmail(value: string) {
  return EMAIL_SHAPE.test(value) ? "" : value;
}

function getAddressLines(companyInfo: CompanyInfo) {
  const addressLines = [
    suppressEmail(stringValue(companyInfo.streetAddress)),
    [
      suppressEmail(stringValue(companyInfo.city)),
      suppressEmail(stringValue(companyInfo.stateProvince)),
      suppressEmail(stringValue(companyInfo.postalCode)),
    ]
      .filter(Boolean)
      .join(", "),
    suppressEmail(stringValue(companyInfo.country)),
  ].filter(Boolean);

  return addressLines.join("\n") || stringValue(companyInfo.address);
}

function parseColorChannels(color: string) {
  const normalizedColor = stringValue(color);

  if (!normalizedColor) {
    return null;
  }

  const shortHexMatch = normalizedColor.match(/^#([0-9a-f]{3})$/i);

  if (shortHexMatch) {
    return shortHexMatch[1].split("").map((channel) => {
      const expandedChannel = `${channel}${channel}`;
      return Number.parseInt(expandedChannel, 16);
    });
  }

  const hexMatch = normalizedColor.match(/^#([0-9a-f]{6})$/i);

  if (hexMatch) {
    return [0, 2, 4].map((index) =>
      Number.parseInt(hexMatch[1].slice(index, index + 2), 16),
    );
  }

  const rgbMatch = normalizedColor.match(
    /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*[\d.]+)?\)$/i,
  );

  if (rgbMatch) {
    return rgbMatch.slice(1, 4).map((channel) => Number.parseInt(channel, 10));
  }

  return null;
}

export function getContrastingTextColor(
  color: string,
  dark = "#111827",
  light = "#ffffff",
) {
  const channels = parseColorChannels(color);

  if (!channels) {
    return dark;
  }

  const [red, green, blue] = channels.map((channel) => {
    const normalizedChannel = Math.max(0, Math.min(255, channel)) / 255;

    return normalizedChannel <= 0.03928
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.42 ? dark : light;
}

function relativeLuminance(color: string): number | null {
  const channels = parseColorChannels(color);
  if (!channels) return null;
  const [red, green, blue] = channels.map((channel) => {
    const value = Math.max(0, Math.min(255, channel)) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio between two colours, or null if either is unreadable. */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

/** The neutral dark preset used when no brand colour is set. */
export const NEUTRAL_DARK_SURFACE = {
  background: "#1e293b",
  text: "#ffffff",
  link: "#cbd5e1",
  button: "#1f4341",
  buttonText: "#ffffff",
} as const;

function darken(color: string, amount: number) {
  const channels = parseColorChannels(color);
  if (!channels) return color;
  return `#${channels
    .map((channel) => Math.round(channel * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * A background + text pair that reads at 4.5:1 or better. White text stays
 * when it passes; otherwise dark text when that passes; otherwise the
 * background is darkened until white text passes.
 */
export function readableColorPair(
  background: string,
  preferredText = "#ffffff",
  darkText = "#111827",
): { background: string; text: string } {
  if ((contrastRatio(preferredText, background) ?? 0) >= MIN_TEXT_CONTRAST) {
    return { background, text: preferredText };
  }
  if ((contrastRatio(darkText, background) ?? 0) >= MIN_TEXT_CONTRAST) {
    return { background, text: darkText };
  }
  for (let step = 1; step <= 20; step += 1) {
    const darker = darken(background, step * 0.05);
    if ((contrastRatio("#ffffff", darker) ?? 0) >= MIN_TEXT_CONTRAST) {
      return { background: darker, text: "#ffffff" };
    }
  }
  return { background: NEUTRAL_DARK_SURFACE.background, text: NEUTRAL_DARK_SURFACE.text };
}

/** The stock signup green counts as "no brand colour chosen". */
export const UNTOUCHED_PRIMARY_COLOR = "#22c55e";

export function isPrimaryColorUnset(primary: string | null | undefined): boolean {
  const value = stringValue(primary ?? undefined).toLowerCase();
  return !value || value === UNTOUCHED_PRIMARY_COLOR;
}

function createSocialLinks(companyInfo: CompanyInfo): SocialLink[] {
  const platformUrls: Partial<Record<StudioSocialPlatform, string>> = {
    facebook: stringValue(companyInfo.facebookUrl),
    instagram: stringValue(companyInfo.instagramUrl),
    twitter: "",
    linkedin: stringValue(companyInfo.linkedinUrl),
    youtube: stringValue(companyInfo.youtubeUrl),
    tiktok: stringValue(companyInfo.tiktokUrl),
    pinterest: stringValue(companyInfo.pinterestUrl),
    threads: "",
  };

  return STUDIO_SOCIAL_PLATFORM_ORDER.map((platform) => ({
    platform,
    url: platformUrls[platform] || "",
    enabled: Boolean(platformUrls[platform]),
  }));
}

const UNTOUCHED_BRAND_COLORS = {
  primary: "#22c55e",
  secondary: "#1e40af",
  accent: "#f59e0b",
  text: "#1f2937",
} as const;

export function hasUntouchedDefaultBrandColors(
  companyInfo: Pick<
    CompanyInfo,
    | "brandPrimaryColorRaw"
    | "brandSecondaryColorRaw"
    | "brandAccentColorRaw"
    | "brandTextColorRaw"
  >,
): boolean {
  const same = (value: string | undefined, expected: string) =>
    stringValue(value).toLowerCase() === expected;
  return (
    same(companyInfo.brandPrimaryColorRaw, UNTOUCHED_BRAND_COLORS.primary) &&
    same(companyInfo.brandSecondaryColorRaw, UNTOUCHED_BRAND_COLORS.secondary) &&
    same(companyInfo.brandAccentColorRaw, UNTOUCHED_BRAND_COLORS.accent) &&
    same(companyInfo.brandTextColorRaw, UNTOUCHED_BRAND_COLORS.text)
  );
}

export function buildStudioDesignSystem(companyInfo: CompanyInfo) {
  const brandColorsAreDefaults = hasUntouchedDefaultBrandColors(companyInfo);
  const selectedFont = normalizeFont(companyInfo.selectedFont);
  const headlineFont = normalizeFont(companyInfo.headlineFont) ?? selectedFont;
  const subheadingFont =
    normalizeFont(companyInfo.subheadingFont) ?? headlineFont ?? selectedFont;
  const bodyFont = normalizeFont(companyInfo.bodyFont) ?? selectedFont;
  const buttonFont = normalizeFont(companyInfo.buttonFont) ?? bodyFont;
  const fontUrls = uniqueStrings([
    selectedFont?.googleFontsUrl,
    headlineFont?.googleFontsUrl,
    subheadingFont?.googleFontsUrl,
    bodyFont?.googleFontsUrl,
    buttonFont?.googleFontsUrl,
  ]);
  const socialLinks = createSocialLinks(companyInfo);
  const configuredColors = uniqueStrings([
    companyInfo.brandPrimaryColorRaw,
    companyInfo.brandSecondaryColorRaw,
    companyInfo.brandAccentColorRaw,
    companyInfo.brandTextColorRaw,
    companyInfo.brandFooterColors?.backgroundColor,
    companyInfo.brandFooterColors?.textColor,
    companyInfo.brandFooterColors?.linkColor,
    companyInfo.brandFooterColors?.dividerColor,
    companyInfo.brandFooterColors?.logoBackgroundColor,
    companyInfo.brandFooterColors?.logoTextColor,
  ]);
  const primaryColor =
    stringValue(companyInfo.brandPrimaryColorRaw) || undefined;

  const typography: StudioDesignSystemTypography = {
    selected: selectedFont,
    headline: headlineFont,
    subheading: subheadingFont,
    body: bodyFont,
    button: buttonFont,
    brandFamily: resolveFontFamily(
      selectedFont ?? bodyFont,
      DEFAULT_BODY_FONT_FAMILY,
    ),
    headlineFamily: resolveFontFamily(
      headlineFont,
      DEFAULT_HEADLINE_FONT_FAMILY,
    ),
    subheadingFamily: resolveFontFamily(
      subheadingFont,
      resolveFontFamily(headlineFont, DEFAULT_HEADLINE_FONT_FAMILY),
    ),
    bodyFamily: resolveFontFamily(bodyFont, DEFAULT_BODY_FONT_FAMILY),
    buttonFamily: resolveFontFamily(buttonFont, DEFAULT_BODY_FONT_FAMILY),
    fontUrls,
  };

  return {
    company: {
      name: stringValue(companyInfo.name) || "Your Business",
      email: stringValue(companyInfo.email),
      phone: stringValue(companyInfo.phone),
      websiteUrl: stringValue(companyInfo.websiteUrl),
      address: stringValue(companyInfo.address),
      addressLines: getAddressLines(companyInfo),
      streetAddress: stringValue(companyInfo.streetAddress),
      city: stringValue(companyInfo.city),
      stateProvince: stringValue(companyInfo.stateProvince),
      postalCode: stringValue(companyInfo.postalCode),
      country: stringValue(companyInfo.country),
      logoUrl: stringValue(companyInfo.logoUrl),
      emailDomain: stringValue(companyInfo.emailDomain),
      footerLegalText: stringValue(companyInfo.footerLegalText),
    },
    colors: {
      brandColorsAreDefaults,
      primaryIsUnset: isPrimaryColorUnset(primaryColor),
      primary: primaryColor,
      secondary: stringValue(companyInfo.brandSecondaryColorRaw) || undefined,
      accent: stringValue(companyInfo.brandAccentColorRaw) || undefined,
      text: stringValue(companyInfo.brandTextColorRaw) || undefined,
      primaryContrastText: getContrastingTextColor(primaryColor || "#111827"),
      footerBackground:
        stringValue(companyInfo.brandFooterColors?.backgroundColor) ||
        undefined,
      footerText:
        stringValue(companyInfo.brandFooterColors?.textColor) || undefined,
      footerLink:
        stringValue(companyInfo.brandFooterColors?.linkColor) || undefined,
      footerDivider:
        stringValue(companyInfo.brandFooterColors?.dividerColor) || undefined,
      footerLogoBackground:
        stringValue(companyInfo.brandFooterColors?.logoBackgroundColor) ||
        undefined,
      footerLogoText:
        stringValue(companyInfo.brandFooterColors?.logoTextColor) || undefined,
    },
    typography,
    social: {
      links: socialLinks,
      hasConfiguredLinks: socialLinks.some((link) => link.enabled),
    },
    // Swatches: untouched default brand colours are not offered as "brand".
    colorPresets: (() => {
      const unset = new Set<string>(
        brandColorsAreDefaults ? Object.values(UNTOUCHED_BRAND_COLORS) : [],
      );
      const swatches = configuredColors.filter(
        (color) => !unset.has(color.toLowerCase()),
      );
      return { core: swatches.slice(0, 5), expanded: swatches.slice(5) };
    })(),
    fontUrls,
  } satisfies StudioDesignSystem;
}
