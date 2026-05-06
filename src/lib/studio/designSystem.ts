import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import type { SocialLink, StudioSocialPlatform } from "@/types/studioBlocks";

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

function getAddressLines(companyInfo: CompanyInfo) {
  const addressLines = [
    stringValue(companyInfo.streetAddress),
    [
      stringValue(companyInfo.city),
      stringValue(companyInfo.stateProvince),
      stringValue(companyInfo.postalCode),
    ]
      .filter(Boolean)
      .join(", "),
    stringValue(companyInfo.country),
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

export function buildStudioDesignSystem(companyInfo: CompanyInfo) {
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
    colorPresets: {
      core: configuredColors.slice(0, 5),
      expanded: configuredColors.slice(5),
    },
    fontUrls,
  } satisfies StudioDesignSystem;
}
