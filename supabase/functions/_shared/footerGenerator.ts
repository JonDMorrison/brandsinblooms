/**
 * Server-side Newsletter Footer HTML Generator
 * Used by edge functions to generate email footers with social icons
 */

import { generateNewsletterFooterHtml } from "../../../src/utils/newsletterFooterHtml.ts";

// Use deployed app URL for PNG social icons hosted in public folder
const ICON_BASE_URL = "https://bloomsuite.app/social-icons";

export interface CompanyProfileData {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  website_url?: string;
  street_address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  pinterest_url?: string;
  youtube_url?: string;
  linkedin_url?: string;
  footer_legal_text?: string;
  brand_primary_color?: string;
  brand_text_color?: string;
  feature_flags?: {
    company_logo_url?: string;
    footer_settings?: {
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
    footer_colors?: {
      backgroundColor?: string;
      textColor?: string;
      linkColor?: string;
      dividerColor?: string;
      logoBackgroundColor?: string;
      logoTextColor?: string;
    };
  };
}

interface FooterStyleConfig {
  backgroundColor: string;
  textPrimary: string;
  textMuted: string;
  linkAccent: string;
  dividerColor: string;
}

// Default white footer colors
const DEFAULT_FOOTER_COLORS: FooterStyleConfig = {
  backgroundColor: "#FFFFFF",
  textPrimary: "#1F2937",
  textMuted: "#6B7280",
  linkAccent: "#2563EB",
  dividerColor: "#E5E7EB",
};

// PNG social icons hosted on deployed app.
// Exported so that the campaign-content renderer in campaignEmailSource.ts
// can reuse the exact same icon markup for user-authored social-follow
// blocks — keeping per-tenant social rows visually identical to the
// auto-injected unsubscribe footer's social row.
export const socialIcons: Record<string, string> = {
  facebook: `<img src="${ICON_BASE_URL}/facebook.png" alt="Facebook" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  instagram: `<img src="${ICON_BASE_URL}/instagram.png" alt="Instagram" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  tiktok: `<img src="${ICON_BASE_URL}/tiktok.png" alt="TikTok" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  pinterest: `<img src="${ICON_BASE_URL}/pinterest.png" alt="Pinterest" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  youtube: `<img src="${ICON_BASE_URL}/youtube.png" alt="YouTube" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  linkedin: `<img src="${ICON_BASE_URL}/linkedin.png" alt="LinkedIn" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
};

/**
 * Generate complete footer HTML from company profile data
 */
export function generateServerFooterHtml(
  profile: CompanyProfileData,
  unsubscribeUrl: string,
  managePreferencesUrl?: string,
): string {
  const footerSettings = profile.feature_flags?.footer_settings;
  const footerColors = profile.feature_flags?.footer_colors;
  return generateNewsletterFooterHtml(
    {
      logoUrl:
        footerSettings?.showLogo === false
          ? undefined
          : profile.feature_flags?.company_logo_url,
      companyName: profile.company_name,
      addressLine1: profile.street_address,
      addressLine2: footerSettings?.addressLine2,
      city: profile.city || footerSettings?.city,
      region: profile.state_province || footerSettings?.region,
      postalCode: profile.postal_code || footerSettings?.postalCode,
      country: profile.country || footerSettings?.country,
      websiteUrl: footerSettings?.websiteUrl || profile.website_url,
      email: profile.company_email || footerSettings?.email,
      phone:
        footerSettings?.showPhone === false ? undefined : profile.company_phone,
      facebookUrl: profile.facebook_url || footerSettings?.facebookUrl,
      instagramUrl: profile.instagram_url || footerSettings?.instagramUrl,
      tiktokUrl: profile.tiktok_url || footerSettings?.tiktokUrl,
      pinterestUrl: profile.pinterest_url || footerSettings?.pinterestUrl,
      youtubeUrl: profile.youtube_url || footerSettings?.youtubeUrl,
      linkedinUrl: profile.linkedin_url || footerSettings?.linkedinUrl,
      unsubscribeUrl,
      managePreferencesUrl:
        footerSettings?.showManagePreferences === false
          ? undefined
          : managePreferencesUrl,
      legalText: profile.footer_legal_text || footerSettings?.complianceText,
      footerBackgroundColor: footerColors?.backgroundColor,
      footerTextColor: footerColors?.textColor,
      footerLinkColor: footerColors?.linkColor,
      footerDividerColor: footerColors?.dividerColor,
      footerLogoBackgroundColor: footerColors?.logoBackgroundColor,
      footerLogoTextColor: footerColors?.logoTextColor,
      brandPrimaryColor: profile.brand_primary_color,
      brandTextColor: profile.brand_text_color,
    },
    "https://bloomsuite.app",
  );
}

/**
 * Check if email content already has a proper footer
 */
export function hasProperFooter(htmlContent: string): boolean {
  if (htmlContent.includes("BLOOMSUITE_FOOTER_START")) {
    return true;
  }

  // Check for PNG social icons in Supabase Storage or legacy formats
  const hasSocialIcons =
    htmlContent.includes("/storage/v1/object/public/assets/social-icons/") ||
    htmlContent.includes("data:image/svg+xml;base64") ||
    htmlContent.includes("s.magecdn.com/social") ||
    htmlContent.includes("/social-icons/");

  // Check for unsubscribe link
  const hasUnsubscribe = htmlContent.toLowerCase().includes("unsubscribe");

  return hasSocialIcons && hasUnsubscribe;
}
