/**
 * Email Footer Renderer
 * Generates HTML for email footers with brand-aware styling
 *
 * This is the legacy renderer - kept for backward compatibility.
 * New implementations should use generateNewsletterFooterHtml from newsletterFooterHtml.ts
 */

import { processEmailTokens, TokenData } from "./emailTokenProcessor";
import { generateNewsletterFooterHtml } from "./newsletterFooterHtml";
import { NewsletterFooterProps } from "@/types/newsletterFooter";

interface FooterSettings {
  showPhone: boolean;
  showLogo: boolean;
  showManagePreferences: boolean;
  padding: "compact" | "normal" | "spacious";
  alignment: "left" | "center";
  showDivider: boolean;
  backgroundColor: "light" | "dark" | "white";
  fontSize: "xs" | "sm";
  complianceText: string;
  customFooterText?: string;
  // Extended fields
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  websiteUrl?: string;
}

interface CompanyInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandTextColor?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  footerLegalText?: string;
  // Brand footer colors from profile settings
  brandFooterColors?: {
    backgroundColor?: string;
    textColor?: string;
    linkColor?: string;
    dividerColor?: string;
    logoBackgroundColor?: string;
    logoTextColor?: string;
  };
}

/**
 * Generate footer HTML - enhanced version using new footer system
 * Prioritizes fresh companyInfo data over footerSettings for contact/address info
 */
export const generateFooterHTML = (
  footerSettings: FooterSettings,
  companyInfo: CompanyInfo,
  tokenData?: TokenData,
  footerBackgroundColor?: string,
  footerStyling?: {
    backgroundColor?: string;
    textColor?: string;
    linkColor?: string;
    dividerColor?: string;
    logoBackgroundColor?: string;
    logoTextColor?: string;
  },
): string => {
  const tokens = tokenData || {
    companyName: companyInfo?.name || "Your Company",
    companyAddress:
      companyInfo?.address || "123 Business St, Suite 100, City, State 12345",
    companyPhone: companyInfo?.phone || "",
    unsubscribeUrl: "[Unsubscribe Link]",
    managePreferencesUrl: "[Manage Preferences Link]",
  };

  // Use fresh companyInfo data, fallback to footerSettings for backward compatibility
  const addressLine1 =
    companyInfo?.streetAddress ||
    footerSettings.addressLine1 ||
    companyInfo?.address;
  const city = companyInfo?.city || footerSettings.city;
  const region = companyInfo?.stateProvince || footerSettings.region;
  const postalCode = companyInfo?.postalCode || footerSettings.postalCode;
  const country = companyInfo?.country || footerSettings.country;
  const email = companyInfo?.email || footerSettings.email;
  const websiteUrl = companyInfo?.websiteUrl || footerSettings.websiteUrl;
  const phone = companyInfo?.phone || tokens.companyPhone;

  // Social URLs from companyInfo (fresh data)
  const facebookUrl = companyInfo?.facebookUrl || footerSettings.facebookUrl;
  const instagramUrl = companyInfo?.instagramUrl || footerSettings.instagramUrl;
  const tiktokUrl = companyInfo?.tiktokUrl || footerSettings.tiktokUrl;
  const pinterestUrl = companyInfo?.pinterestUrl || footerSettings.pinterestUrl;
  const youtubeUrl = companyInfo?.youtubeUrl || footerSettings.youtubeUrl;
  const linkedinUrl = companyInfo?.linkedinUrl || footerSettings.linkedinUrl;

  // Legal text from companyInfo
  const legalText =
    companyInfo?.footerLegalText || footerSettings.complianceText;

  // Check if we have extended footer settings - use new renderer
  const hasExtendedSettings =
    facebookUrl || instagramUrl || addressLine1 || footerBackgroundColor;

  if (hasExtendedSettings) {
    // Get brand footer colors from profile
    const brandFooterColors = companyInfo?.brandFooterColors;

    // Build complete effective colors with full fallback chain
    // Priority cascade: 1) Campaign footerStyling → 2) Brand footer_colors → 3) footerBackgroundColor → 4) brandPrimaryColor → 5) defaults
    const effectiveColors = {
      backgroundColor:
        footerStyling?.backgroundColor ||
        brandFooterColors?.backgroundColor ||
        footerBackgroundColor ||
        companyInfo?.brandPrimaryColor ||
        "#FFFFFF", // Default white
      textColor:
        footerStyling?.textColor || brandFooterColors?.textColor || "#1F2937", // Default dark text
      linkColor:
        footerStyling?.linkColor || brandFooterColors?.linkColor || "#2563EB", // Default blue accent
      dividerColor:
        footerStyling?.dividerColor ||
        brandFooterColors?.dividerColor ||
        "#E5E7EB", // Default light gray
      logoBackgroundColor:
        footerStyling?.logoBackgroundColor ||
        brandFooterColors?.logoBackgroundColor ||
        companyInfo?.brandPrimaryColor ||
        "#22C55E", // Default brand green
      logoTextColor:
        footerStyling?.logoTextColor ||
        brandFooterColors?.logoTextColor ||
        "#FFFFFF", // Default white
    };
    // Use the new newsletter footer HTML generator with fresh data and priority cascade
    const footerProps: NewsletterFooterProps = {
      logoUrl: footerSettings.showLogo ? companyInfo?.logoUrl : undefined,
      companyName: tokens.companyName,
      addressLine1,
      addressLine2: footerSettings.addressLine2,
      city,
      region,
      postalCode,
      country,
      websiteUrl,
      email,
      phone: footerSettings.showPhone ? phone : undefined,
      facebookUrl,
      instagramUrl,
      tiktokUrl,
      pinterestUrl,
      youtubeUrl,
      linkedinUrl,
      unsubscribeUrl: tokens.unsubscribeUrl || "#",
      managePreferencesUrl: footerSettings.showManagePreferences
        ? tokens.managePreferencesUrl
        : undefined,
      legalText: processEmailTokens(legalText, tokens),
      // Pass all effective colors with full fallbacks
      footerBackgroundColor: effectiveColors.backgroundColor,
      footerTextColor: effectiveColors.textColor,
      footerLinkColor: effectiveColors.linkColor,
      footerDividerColor: effectiveColors.dividerColor,
      footerLogoBackgroundColor: effectiveColors.logoBackgroundColor,
      footerLogoTextColor: effectiveColors.logoTextColor,
      brandPrimaryColor: companyInfo?.brandPrimaryColor,
    };

    return generateNewsletterFooterHtml(footerProps);
  }

  // Legacy footer rendering for backward compatibility
  const alignment = footerSettings.alignment === "center" ? "center" : "left";
  const bgColor =
    footerSettings.backgroundColor === "dark"
      ? "#1F2937"
      : footerSettings.backgroundColor === "white"
        ? "#ffffff"
        : "#f9fafb";
  const textColor =
    footerSettings.backgroundColor === "dark" ? "#F3F4F6" : "#6b7280";
  const linkColor =
    footerSettings.backgroundColor === "dark" ? "#60A5FA" : "#2563EB";
  const fontSize = footerSettings.fontSize === "xs" ? "11px" : "12px";
  const padding =
    footerSettings.padding === "spacious"
      ? "32px 16px"
      : footerSettings.padding === "compact"
        ? "16px 16px"
        : "24px 16px";

  let footerContent = "";

  // Add divider if enabled
  if (footerSettings.showDivider) {
    const dividerColor =
      footerSettings.backgroundColor === "dark" ? "#3D4A38" : "#e5e7eb";
    footerContent += `
      <div style="border-top: 1px solid ${dividerColor}; margin: 20px 0;"></div>
    `;
  }

  // Start footer container
  footerContent += `
    <div style="
      background-color: ${bgColor};
      padding: ${padding};
      text-align: ${alignment};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${fontSize};
      color: ${textColor};
      line-height: 1.5;
    ">
  `;

  // Company logo
  if (footerSettings.showLogo && companyInfo?.logoUrl) {
    footerContent += `
      <div style="margin-bottom: 16px;">
        <img src="${companyInfo.logoUrl}" alt="${tokens.companyName}" style="height: 40px; width: auto; object-fit: contain;" />
      </div>
    `;
  }

  // Company info section
  footerContent += `
    <div style="margin-bottom: 16px;">
      <strong style="color: ${footerSettings.backgroundColor === "dark" ? "#F3F4F6" : "#1f2937"};">${tokens.companyName}</strong>
  `;

  if (tokens.companyAddress) {
    footerContent += `
      <br />${tokens.companyAddress}
    `;
  }

  if (footerSettings.showPhone && tokens.companyPhone) {
    footerContent += `
      <br />Phone: ${tokens.companyPhone}
    `;
  }

  footerContent += `
    </div>
  `;

  // Custom footer text if provided
  if (footerSettings.customFooterText) {
    const processedCustomText = processEmailTokens(
      footerSettings.customFooterText,
      tokens,
    );
    footerContent += `
      <div style="margin-bottom: 16px;">
        ${processedCustomText}
      </div>
    `;
  }

  // Compliance notice
  const processedComplianceText = processEmailTokens(
    footerSettings.complianceText,
    tokens,
  );
  footerContent += `
    <div style="margin-bottom: 16px; font-size: ${fontSize};">
      ${processedComplianceText}
    </div>
  `;

  // Links section
  footerContent += `
    <div style="margin-bottom: 8px;">
  `;

  const links = [];

  if (tokens.unsubscribeUrl) {
    links.push(
      `<a href="${tokens.unsubscribeUrl}" style="color: ${linkColor}; text-decoration: underline;">Unsubscribe</a>`,
    );
  }

  if (footerSettings.showManagePreferences && tokens.managePreferencesUrl) {
    links.push(
      `<a href="${tokens.managePreferencesUrl}" style="color: ${linkColor}; text-decoration: underline;">Manage Preferences</a>`,
    );
  }

  if (links.length > 0) {
    footerContent += links.join(
      ` <span style="color: ${textColor}; margin: 0 8px;">|</span> `,
    );
  }

  footerContent += `
    </div>
  `;

  // Close footer container
  footerContent += `
    </div>
  `;

  return footerContent;
};
