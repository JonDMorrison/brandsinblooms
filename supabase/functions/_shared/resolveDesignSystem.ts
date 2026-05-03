import {
  buildStudioDesignSystem,
  type StudioDesignSystem,
} from "../../../src/lib/studio/designSystem.ts";
import type { CompanyInfo } from "../../../src/hooks/useCompanyInfo.ts";

type AvailableFontRow = {
  id?: string | null;
  name?: string | null;
  display_name?: string | null;
  google_fonts_url?: string | null;
  font_family_css?: string | null;
};

type FooterColorsRow = {
  background?: string | null;
  text?: string | null;
  link?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  linkColor?: string | null;
  dividerColor?: string | null;
  logoBackgroundColor?: string | null;
  logoTextColor?: string | null;
};

type FooterSettingsRow = {
  showPhone?: boolean;
  showLogo?: boolean;
  showManagePreferences?: boolean;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  websiteUrl?: string;
  complianceText?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
};

export type ServerCompanyProfileShape = {
  company_name?: string | null;
  location_info?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  website_url?: string | null;
  street_address?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  email_domain?: string | null;
  footer_legal_text?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  brand_accent_color?: string | null;
  brand_text_color?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  pinterest_url?: string | null;
  youtube_url?: string | null;
  linkedin_url?: string | null;
  feature_flags?: {
    company_logo_url?: string;
    footer_colors?: FooterColorsRow | null;
    footer_settings?: FooterSettingsRow | null;
  } | null;
  selected_font?: AvailableFontRow | null;
  headline_font?: AvailableFontRow | null;
  subheading_font?: AvailableFontRow | null;
  body_font?: AvailableFontRow | null;
  button_font?: AvailableFontRow | null;
};

export const COMPANY_PROFILE_WITH_DESIGN_SYSTEM_SELECT = `
  *,
  selected_font:available_fonts!selected_font_id(
    id,
    name,
    display_name,
    google_fonts_url,
    font_family_css
  ),
  headline_font:available_fonts!headline_font_id(
    id,
    name,
    display_name,
    google_fonts_url,
    font_family_css
  ),
  subheading_font:available_fonts!subheading_font_id(
    id,
    name,
    display_name,
    google_fonts_url,
    font_family_css
  ),
  body_font:available_fonts!body_font_id(
    id,
    name,
    display_name,
    google_fonts_url,
    font_family_css
  ),
  button_font:available_fonts!button_font_id(
    id,
    name,
    display_name,
    google_fonts_url,
    font_family_css
  )
`;

function stringValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFont(
  font: AvailableFontRow | null | undefined,
): CompanyInfo["selectedFont"] | undefined {
  if (!font) {
    return undefined;
  }

  const id = stringValue(font.id);
  const name = stringValue(font.name);
  const displayName = stringValue(font.display_name) || name;
  const googleFontsUrl = stringValue(font.google_fonts_url);
  const fontFamilyCss = stringValue(font.font_family_css);

  if (!id && !name && !displayName && !googleFontsUrl && !fontFamilyCss) {
    return undefined;
  }

  return {
    id,
    name,
    displayName,
    googleFontsUrl,
    fontFamilyCss,
  };
}

export function resolveDesignSystem(
  profile: ServerCompanyProfileShape | null | undefined,
): StudioDesignSystem | null {
  if (!profile) {
    return null;
  }

  const footerColors = profile.feature_flags?.footer_colors;

  const companyInfo: CompanyInfo = {
    name: stringValue(profile.company_name),
    address: stringValue(profile.location_info),
    phone: stringValue(profile.company_phone),
    email: stringValue(profile.company_email),
    websiteUrl: stringValue(profile.website_url),
    streetAddress: stringValue(profile.street_address),
    city: stringValue(profile.city),
    stateProvince: stringValue(profile.state_province),
    postalCode: stringValue(profile.postal_code),
    country: stringValue(profile.country),
    logoUrl: stringValue(profile.feature_flags?.company_logo_url),
    emailDomain: stringValue(profile.email_domain),
    brandPrimaryColor: stringValue(profile.brand_primary_color),
    brandSecondaryColor: stringValue(profile.brand_secondary_color),
    brandAccentColor: stringValue(profile.brand_accent_color),
    brandTextColor: stringValue(profile.brand_text_color),
    brandPrimaryColorRaw: stringValue(profile.brand_primary_color) || undefined,
    brandSecondaryColorRaw:
      stringValue(profile.brand_secondary_color) || undefined,
    brandAccentColorRaw: stringValue(profile.brand_accent_color) || undefined,
    brandTextColorRaw: stringValue(profile.brand_text_color) || undefined,
    facebookUrl: stringValue(profile.facebook_url) || undefined,
    instagramUrl: stringValue(profile.instagram_url) || undefined,
    tiktokUrl: stringValue(profile.tiktok_url) || undefined,
    pinterestUrl: stringValue(profile.pinterest_url) || undefined,
    youtubeUrl: stringValue(profile.youtube_url) || undefined,
    linkedinUrl: stringValue(profile.linkedin_url) || undefined,
    footerLegalText: stringValue(profile.footer_legal_text) || undefined,
    brandFooterColors: footerColors
      ? {
          backgroundColor:
            stringValue(
              footerColors.backgroundColor || footerColors.background,
            ) || undefined,
          textColor:
            stringValue(footerColors.textColor || footerColors.text) ||
            undefined,
          linkColor:
            stringValue(footerColors.linkColor || footerColors.link) ||
            undefined,
          dividerColor: stringValue(footerColors.dividerColor) || undefined,
          logoBackgroundColor:
            stringValue(footerColors.logoBackgroundColor) || undefined,
          logoTextColor: stringValue(footerColors.logoTextColor) || undefined,
        }
      : undefined,
    selectedFont: normalizeFont(profile.selected_font),
    headlineFont: normalizeFont(profile.headline_font),
    subheadingFont: normalizeFont(profile.subheading_font),
    bodyFont: normalizeFont(profile.body_font),
    buttonFont: normalizeFont(profile.button_font),
  };

  return buildStudioDesignSystem(companyInfo);
}
