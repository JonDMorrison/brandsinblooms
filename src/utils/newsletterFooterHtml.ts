/**
 * Newsletter Footer HTML Generator
 * Generates email-compatible HTML for the footer
 * Used by both React preview and email send pipeline
 */

import {
  NewsletterFooterProps,
  getFooterStyleConfig,
  getCompanyInitials,
  FooterStyleConfig,
} from "../types/newsletterFooter.ts";
import { socialIconUrls } from "./socialIcons.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function deriveMutedTextColor(
  primaryColor: string | undefined,
  fallbackColor: string,
): string {
  if (!primaryColor) {
    return fallbackColor;
  }

  const trimmed = primaryColor.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `${trimmed}B3`;
  }

  return fallbackColor;
}

/**
 * Get social icon HTML with absolute URL for email client compatibility
 * Uses absolute URLs so icons work in email clients
 */
function getSocialIconHtml(
  platform: keyof typeof socialIconUrls,
  baseUrl: string,
): string {
  return `<img src="${escapeAttribute(baseUrl + socialIconUrls[platform])}" alt="${escapeAttribute(platform)}" width="20" height="20" style="display:block;border:0;outline:none;text-decoration:none;" />`;
}

/**
 * Build formatted address string from parts
 */
function buildAddressHtml(
  props: NewsletterFooterProps,
  styles: FooterStyleConfig,
): string {
  const lines: string[] = [];

  if (props.addressLine1) lines.push(props.addressLine1);
  if (props.addressLine2) lines.push(props.addressLine2);

  const cityLine: string[] = [];
  if (props.city) cityLine.push(props.city);
  if (props.region) cityLine.push(props.region);
  if (props.postalCode) cityLine.push(props.postalCode);
  if (cityLine.length > 0) lines.push(cityLine.join(", "));

  if (props.country) lines.push(props.country);

  if (lines.length === 0) return "";

  return `
    <div style="margin-bottom:8px;color:${styles.textMuted};font-size:13px;line-height:1.625;">
      ${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

/**
 * Build contact info HTML
 */
function buildContactHtml(
  props: NewsletterFooterProps,
  styles: FooterStyleConfig,
): string {
  const items: string[] = [];

  if (props.email) {
    items.push(
      `<a href="mailto:${escapeAttribute(props.email)}" style="color:${styles.textMuted};text-decoration:none;">${escapeHtml(props.email)}</a>`,
    );
  }
  if (props.phone) {
    items.push(`<span>${escapeHtml(props.phone)}</span>`);
  }

  if (items.length === 0) return "";

  return `
    <div style="font-size:12px;color:${styles.textMuted};margin-top:4px;">
      ${items.join(` <span style="color:${styles.textMuted};">|</span> `)}
    </div>
  `;
}

type SocialConfig = {
  key: keyof typeof socialIconUrls;
  url: string;
  name: string;
};

/**
 * Build social icons HTML with email-safe table wrapper
 */
function buildSocialIconsHtml(
  props: NewsletterFooterProps,
  baseUrl: string,
): string {
  const socialConfigs: SocialConfig[] = [
    { key: "facebook", url: props.facebookUrl || "", name: "Facebook" },
    { key: "instagram", url: props.instagramUrl || "", name: "Instagram" },
    { key: "tiktok", url: props.tiktokUrl || "", name: "TikTok" },
    { key: "pinterest", url: props.pinterestUrl || "", name: "Pinterest" },
    { key: "youtube", url: props.youtubeUrl || "", name: "YouTube" },
    { key: "linkedin", url: props.linkedinUrl || "", name: "LinkedIn" },
  ];

  const activeSocials = socialConfigs.filter(
    (s) => !!s.url && !!socialIconUrls[s.key],
  );

  if (activeSocials.length === 0) return "";

  const iconsHtml = activeSocials
    .map(
      ({ url, key }) => `
    <a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;vertical-align:top;">
      ${getSocialIconHtml(key, baseUrl)}
    </a>
  `,
    )
    .join("");

  // Email-safe table wrapper for robust rendering
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right" class="bloomsuite-footer__social-table">
      <tr>
        <td align="right" style="padding:0;">
          ${iconsHtml}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Build logo HTML (image or initials fallback)
 */
function buildLogoHtml(
  props: NewsletterFooterProps,
  styles: FooterStyleConfig,
): string {
  if (props.logoUrl) {
    return `
      <img src="${escapeAttribute(props.logoUrl)}" alt="${escapeAttribute(props.companyName || "Company")} logo" style="display:inline-block;height:40px;width:auto;object-fit:contain;margin-bottom:12px;vertical-align:top;" />
    `;
  }

  // Fallback: initials in a rounded square
  // Use logo colors from props if available, otherwise fall back to styles
  const logoBgColor = props.footerLogoBackgroundColor || styles.linkAccent;
  const logoTextColor = props.footerLogoTextColor || styles.backgroundColor;
  const initials = getCompanyInitials(props.companyName);
  return `
    <div style="width:48px;height:48px;background-color:${logoBgColor};border-radius:8px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;vertical-align:top;">
      <span style="color:${logoTextColor};font-size:18px;font-weight:700;line-height:1;">${escapeHtml(initials)}</span>
    </div>
  `;
}

/**
 * Generate the complete footer HTML
 */
export function generateNewsletterFooterHtml(
  props: NewsletterFooterProps,
  appBaseUrl?: string,
): string {
  const baseStyles = getFooterStyleConfig(
    props.footerBackgroundColor,
    props.brandPrimaryColor,
  );

  const baseUrl =
    appBaseUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://bloomsuite.app");

  // Apply custom style overrides from campaign metadata with complete fallback
  // All colors should already have fallbacks from emailFooterRenderer, but double-check here
  const styles: FooterStyleConfig = {
    backgroundColor: props.footerBackgroundColor || baseStyles.backgroundColor,
    textPrimary: props.footerTextColor || baseStyles.textPrimary,
    textMuted: deriveMutedTextColor(
      props.footerTextColor,
      baseStyles.textMuted,
    ),
    linkAccent: props.footerLinkColor || baseStyles.linkAccent,
    dividerColor: props.footerDividerColor || baseStyles.dividerColor,
  };
  const hasAddress =
    props.addressLine1 ||
    props.city ||
    props.region ||
    props.postalCode ||
    props.country;
  const hasContact = props.email || props.phone;
  const hasSocial =
    props.facebookUrl ||
    props.instagramUrl ||
    props.tiktokUrl ||
    props.pinterestUrl ||
    props.youtubeUrl ||
    props.linkedinUrl;
  const companyName = props.companyName || "Your Company";
  const legalText = props.legalText
    ? props.legalText.replace(
        /\{\{company\.name\}\}/g,
        companyName || "Our Company",
      )
    : "";
  const desktopLeftCellWidth = hasSocial ? "33%" : "50%";
  const desktopMiddleCellWidth = hasSocial ? "34%" : "50%";
  const desktopRightCellWidth = hasSocial ? "33%" : "0%";

  return `
    <!-- BLOOMSUITE_FOOTER_START -->
    <style type="text/css">
      @media only screen and (max-width: 600px) {
        .bloomsuite-footer__column {
          display:block !important;
          width:100% !important;
          text-align:center !important;
          padding:12px 0 !important;
        }
        .bloomsuite-footer__social-cell {
          text-align:center !important;
        }
        .bloomsuite-footer__social-table {
          margin:0 auto !important;
        }
      }
    </style>
    <div data-bloomsuite-footer="true" style="background-color:${styles.backgroundColor};width:100%;margin-top:40px;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <!-- Left Column: Logo & Brand -->
            <td width="${desktopLeftCellWidth}" valign="top" class="bloomsuite-footer__column" style="padding:0 12px 0 0;text-align:left;width:${desktopLeftCellWidth};vertical-align:top;">
              ${buildLogoHtml(props, styles)}
              ${companyName ? `<div style="font-size:14px;font-weight:500;color:${styles.textPrimary};margin-bottom:4px;">${escapeHtml(companyName)}</div>` : ""}
              ${props.websiteUrl ? `<a href="${escapeAttribute(props.websiteUrl)}" style="font-size:12px;color:${styles.textMuted};text-decoration:none;">${escapeHtml(props.websiteUrl.replace(/^https?:\/\//, ""))}</a>` : ""}
            </td>

            <!-- Middle Column: Address & Contact -->
            <td width="${desktopMiddleCellWidth}" valign="top" class="bloomsuite-footer__column" style="padding:0 ${hasSocial ? "12px" : "0 0 0 12px"};text-align:left;width:${desktopMiddleCellWidth};vertical-align:top;">
              ${hasAddress ? buildAddressHtml(props, styles) : ""}
              ${hasContact ? buildContactHtml(props, styles) : ""}
            </td>

            <!-- Right Column: Social Icons -->
            <td width="${desktopRightCellWidth}" valign="top" class="bloomsuite-footer__column bloomsuite-footer__social-cell" style="padding:0 0 0 12px;text-align:right;width:${desktopRightCellWidth};vertical-align:top;${hasSocial ? "" : "display:none;"}">
              ${hasSocial ? buildSocialIconsHtml(props, baseUrl) : ""}
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="height:1px;background-color:${styles.dividerColor};margin:24px 0;"></div>

        <!-- Compliance Strip -->
        <div style="text-align:center;">
          ${legalText ? `<p style="font-size:12px;color:${styles.textMuted};max-width:448px;margin:0 auto 12px;line-height:1.625;">${escapeHtml(legalText)}</p>` : ""}

          <div style="font-size:12px;">
            <a href="${escapeAttribute(props.unsubscribeUrl)}" style="color:${styles.linkAccent};text-decoration:underline;">Unsubscribe</a>
            ${
              props.managePreferencesUrl
                ? `
              <span style="color:${styles.textMuted};margin:0 8px;">|</span>
              <a href="${escapeAttribute(props.managePreferencesUrl)}" style="color:${styles.linkAccent};text-decoration:underline;">Manage Preferences</a>
            `
                : ""
            }
          </div>
        </div>
      </div>
    </div>
    <!-- BLOOMSUITE_FOOTER_END -->
  `;
}

/**
 * Generate mobile-responsive footer HTML with media queries
 * (For email clients that support embedded styles)
 */
export function generateResponsiveFooterStyles(): string {
  return `
    <style type="text/css">
      @media only screen and (max-width: 600px) {
        .bloomsuite-footer__column {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          padding: 12px 0 !important;
        }
        .bloomsuite-footer__social-cell {
          text-align: center !important;
        }
        .bloomsuite-footer__social-table {
          margin: 0 auto !important;
        }
      }
    </style>
  `;
}
