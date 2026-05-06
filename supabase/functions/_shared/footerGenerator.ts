import {
  createFooterBlockFromProfile,
  renderFooterBlockToEmailHtml,
  type StudioFooterProfile,
} from "../../../src/lib/studio/emailHtmlGenerator.ts";
import {
  resolveDesignSystem,
  type ServerCompanyProfileShape,
} from "./resolveDesignSystem.ts";

const ICON_BASE_URL = "https://bloomsuite.app/social-icons";

export interface CompanyProfileData
  extends StudioFooterProfile, ServerCompanyProfileShape {}

export const socialIcons: Record<string, string> = {
  facebook: `<img src="${ICON_BASE_URL}/facebook.png" alt="Facebook" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  instagram: `<img src="${ICON_BASE_URL}/instagram.png" alt="Instagram" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  tiktok: `<img src="${ICON_BASE_URL}/tiktok.png" alt="TikTok" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  pinterest: `<img src="${ICON_BASE_URL}/pinterest.png" alt="Pinterest" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  youtube: `<img src="${ICON_BASE_URL}/youtube.png" alt="YouTube" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  linkedin: `<img src="${ICON_BASE_URL}/linkedin.png" alt="LinkedIn" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
};

function normalizeFooterProfile(
  profile: CompanyProfileData,
): StudioFooterProfile {
  const colors = profile.feature_flags?.footer_colors;

  return {
    ...profile,
    feature_flags: {
      ...profile.feature_flags,
      company_logo_url: profile.feature_flags?.company_logo_url,
      footer_settings: profile.feature_flags?.footer_settings,
      footer_colors: colors
        ? {
            backgroundColor: colors.backgroundColor || colors.background,
            textColor: colors.textColor || colors.text,
            linkColor: colors.linkColor || colors.link,
            dividerColor: colors.dividerColor,
            logoBackgroundColor: colors.logoBackgroundColor,
            logoTextColor: colors.logoTextColor,
          }
        : undefined,
    },
  };
}

export function generateServerFooterHtml(
  profile: CompanyProfileData,
  unsubscribeUrl: string,
  managePreferencesUrl?: string,
): string {
  const normalizedProfile = normalizeFooterProfile(profile);
  const websiteUrl =
    profile.website_url ||
    profile.feature_flags?.footer_settings?.websiteUrl ||
    "";
  const footerBlock = createFooterBlockFromProfile(normalizedProfile, {
    logoUrl:
      profile.feature_flags?.footer_settings?.showLogo === false
        ? ""
        : profile.feature_flags?.company_logo_url || "",
    showManagePreferences:
      profile.feature_flags?.footer_settings?.showManagePreferences !== false,
    showWebsiteLink: Boolean(websiteUrl),
    websiteUrl,
  });
  const designSystem = resolveDesignSystem(normalizedProfile);

  return renderFooterBlockToEmailHtml(
    footerBlock,
    {
      unsubscribeUrl,
      preferencesUrl: managePreferencesUrl || unsubscribeUrl,
      websiteUrl,
    },
    designSystem,
  );
}

export function hasProperFooter(htmlContent: string): boolean {
  if (htmlContent.includes("BLOOMSUITE_FOOTER_START")) {
    return true;
  }

  const lower = htmlContent.toLowerCase();
  return lower.includes("unsubscribe") && lower.includes("preferences");
}
