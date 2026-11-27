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

/**
 * A company_profiles row as the send functions load it. The server shape
 * already carries every field the footer reads, with the wider stored
 * feature_flags (legacy colour keys, showLogo); normalizeFooterProfile
 * narrows it to what the shared footer renderer takes.
 */
export type CompanyProfileData = ServerCompanyProfileShape;

const textOrUndefined = (value: string | null | undefined) => value || undefined;

export const socialIcons: Record<string, string> = {
  facebook: `<img src="${ICON_BASE_URL}/facebook.png" alt="Facebook" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  instagram: `<img src="${ICON_BASE_URL}/instagram.png" alt="Instagram" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  tiktok: `<img src="${ICON_BASE_URL}/tiktok.png" alt="TikTok" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  pinterest: `<img src="${ICON_BASE_URL}/pinterest.png" alt="Pinterest" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  youtube: `<img src="${ICON_BASE_URL}/youtube.png" alt="YouTube" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  linkedin: `<img src="${ICON_BASE_URL}/linkedin.png" alt="LinkedIn" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`,
};

/** A stored profile narrowed to what the shared footer renderer reads. */
export function normalizeFooterProfile(
  profile: CompanyProfileData,
): StudioFooterProfile {
  const colors = profile.feature_flags?.footer_colors;

  return {
    ...profile,
    feature_flags: {
      ...profile.feature_flags,
      company_logo_url: profile.feature_flags?.company_logo_url,
      footer_settings: profile.feature_flags?.footer_settings ?? undefined,
      footer_colors: colors
        ? {
            backgroundColor: textOrUndefined(colors.backgroundColor) ?? textOrUndefined(colors.background),
            textColor: textOrUndefined(colors.textColor) ?? textOrUndefined(colors.text),
            linkColor: textOrUndefined(colors.linkColor) ?? textOrUndefined(colors.link),
            dividerColor: textOrUndefined(colors.dividerColor),
            logoBackgroundColor: textOrUndefined(colors.logoBackgroundColor),
            logoTextColor: textOrUndefined(colors.logoTextColor),
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
  // The website link comes from the design system resolved from this same
  // profile (resolveFooterWebsiteUrl), and is hidden when it has none.
  const footerBlock = createFooterBlockFromProfile(normalizedProfile, {
    logoUrl:
      profile.feature_flags?.footer_settings?.showLogo === false
        ? ""
        : profile.feature_flags?.company_logo_url || "",
    showManagePreferences:
      profile.feature_flags?.footer_settings?.showManagePreferences !== false,
  });
  const designSystem = resolveDesignSystem(normalizedProfile);

  return renderFooterBlockToEmailHtml(
    footerBlock,
    {
      unsubscribeUrl,
      preferencesUrl: managePreferencesUrl || unsubscribeUrl,
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
