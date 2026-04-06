/**
 * Newsletter Footer HTML Generator
 * Generates email-compatible HTML for the footer
 * Used by both React preview and email send pipeline
 */

import { 
  NewsletterFooterProps, 
  getFooterStyleConfig, 
  getCompanyInitials,
  FooterStyleConfig 
} from '@/types/newsletterFooter';
import { ICON_BASE_URL, socialIconUrls, getAbsoluteSocialIconUrl } from '@/utils/socialIcons';

/**
 * Get social icon HTML with absolute URL for email client compatibility
 * Uses absolute URLs so icons work in email clients
 */
function getSocialIconHtml(platform: keyof typeof socialIconUrls, baseUrl: string): string {
  return `<img src="${baseUrl}${socialIconUrls[platform]}" alt="${platform}" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`;
}

/**
 * Build formatted address string from parts
 */
function buildAddressHtml(props: NewsletterFooterProps, styles: FooterStyleConfig): string {
  const lines: string[] = [];
  
  if (props.addressLine1) lines.push(props.addressLine1);
  if (props.addressLine2) lines.push(props.addressLine2);
  
  const cityLine: string[] = [];
  if (props.city) cityLine.push(props.city);
  if (props.region) cityLine.push(props.region);
  if (props.postalCode) cityLine.push(props.postalCode);
  if (cityLine.length > 0) lines.push(cityLine.join(', '));
  
  if (props.country) lines.push(props.country);
  
  if (lines.length === 0) return '';
  
  return `
    <div style="margin-bottom: 8px; color: ${styles.textMuted}; font-size: 13px; line-height: 1.6;">
      ${lines.join('<br />')}
    </div>
  `;
}

/**
 * Build contact info HTML
 */
function buildContactHtml(props: NewsletterFooterProps, styles: FooterStyleConfig): string {
  const items: string[] = [];
  
  if (props.email) {
    items.push(`<a href="mailto:${props.email}" style="color: ${styles.textMuted}; text-decoration: none;">${props.email}</a>`);
  }
  if (props.phone) {
    items.push(`<a href="tel:${props.phone}" style="color: ${styles.textMuted}; text-decoration: none;">${props.phone}</a>`);
  }
  
  if (items.length === 0) return '';
  
  return `
    <div style="font-size: 12px; color: ${styles.textMuted}; margin-top: 4px;">
      ${items.join(' &nbsp;|&nbsp; ')}
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
function buildSocialIconsHtml(props: NewsletterFooterProps, baseUrl: string): string {
  const socialConfigs: SocialConfig[] = [
    { key: "facebook", url: props.facebookUrl || "", name: "Facebook" },
    { key: "instagram", url: props.instagramUrl || "", name: "Instagram" },
    { key: "tiktok", url: props.tiktokUrl || "", name: "TikTok" },
    { key: "pinterest", url: props.pinterestUrl || "", name: "Pinterest" },
    { key: "youtube", url: props.youtubeUrl || "", name: "YouTube" },
    { key: "linkedin", url: props.linkedinUrl || "", name: "LinkedIn" },
  ];

  const activeSocials = socialConfigs.filter(s => !!s.url && !!socialIconUrls[s.key]);
  
  if (activeSocials.length === 0) return '';

  const iconsHtml = activeSocials.map(({ url, key }) => `
    <a href="${url}" target="_blank" style="display:inline-block;margin:0 6px;text-decoration:none;">
      ${getSocialIconHtml(key, baseUrl)}
    </a>
  `).join('');

  // Email-safe table wrapper for robust rendering
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
      <tr>
        <td align="right" style="padding:8px 0;">
          ${iconsHtml}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Build logo HTML (image or initials fallback)
 */
function buildLogoHtml(props: NewsletterFooterProps, styles: FooterStyleConfig): string {
  if (props.logoUrl) {
    return `
      <img src="${props.logoUrl}" alt="${props.companyName || 'Company'}" style="height: 40px; width: auto; object-fit: contain; margin-bottom: 12px;" />
    `;
  }
  
  // Fallback: initials in a rounded square
  // Use logo colors from props if available, otherwise fall back to styles
  const logoBgColor = props.footerLogoBackgroundColor || styles.linkAccent;
  const logoTextColor = props.footerLogoTextColor || styles.backgroundColor;
  const initials = getCompanyInitials(props.companyName);
  return `
    <div style="width: 48px; height: 48px; background-color: ${logoBgColor}; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
      <span style="color: ${logoTextColor}; font-size: 18px; font-weight: bold; line-height: 48px;">${initials}</span>
    </div>
  `;
}

/**
 * Generate the complete footer HTML
 */
export function generateNewsletterFooterHtml(props: NewsletterFooterProps, appBaseUrl?: string): string {
  const baseStyles = getFooterStyleConfig(props.footerBackgroundColor, props.brandPrimaryColor);
  
  // Get base URL for social icons - MUST use production URL for email clients
  // Use provided appBaseUrl, or production URL for emails (NOT window.location.origin which is dev URL)
  const baseUrl = appBaseUrl || 'https://bloomsuite.app';
  
  // Apply custom style overrides from campaign metadata with complete fallback
  // All colors should already have fallbacks from emailFooterRenderer, but double-check here
  const styles: FooterStyleConfig = {
    backgroundColor: props.footerBackgroundColor || baseStyles.backgroundColor,
    textPrimary: props.footerTextColor || baseStyles.textPrimary,
    textMuted: props.footerTextColor || baseStyles.textMuted,
    linkAccent: props.footerLinkColor || baseStyles.linkAccent,
    dividerColor: props.footerDividerColor || baseStyles.dividerColor,
  };
  
  console.log('📧 Newsletter footer styles applied:', styles);
  
  const hasAddress = props.addressLine1 || props.city || props.region || props.postalCode || props.country;
  const hasContact = props.email || props.phone;
  const hasSocial = props.facebookUrl || props.instagramUrl || props.tiktokUrl || props.pinterestUrl || props.youtubeUrl || props.linkedinUrl;
  
  return `
    <div style="background-color: ${styles.backgroundColor}; width: 100%; margin-top: 40px;">
      <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
        <!--[if mso]>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
        <td width="33%" valign="top" style="padding: 0 8px;">
        <![endif]-->
        
        <!-- Three Column Layout for Desktop, stacks on mobile via footer-column class -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <!-- Left Column: Logo & Brand -->
            <td width="33%" valign="top" class="footer-column" style="display: inline-block; vertical-align: top; padding: 0 8px; text-align: left; width: 33%;">
              ${buildLogoHtml(props, styles)}
              ${props.companyName ? `<div style="font-size: 14px; font-weight: 500; color: ${styles.textPrimary}; margin-bottom: 4px;">${props.companyName}</div>` : ''}
              ${props.websiteUrl ? `<a href="${props.websiteUrl}" style="font-size: 12px; color: ${styles.textMuted}; text-decoration: none;">${props.websiteUrl.replace(/^https?:\/\//, '')}</a>` : ''}
            </td>

            <!-- Middle Column: Address & Contact -->
            <td width="34%" valign="top" class="footer-column" style="display: inline-block; vertical-align: top; padding: 0 8px; text-align: left; width: 34%;">
              ${hasAddress ? buildAddressHtml(props, styles) : ''}
              ${hasContact ? buildContactHtml(props, styles) : ''}
            </td>

            <!-- Right Column: Social Icons -->
            <td width="33%" valign="top" class="footer-column footer-social" style="display: inline-block; vertical-align: top; padding: 0 8px; text-align: right; width: 33%;">
              ${hasSocial ? buildSocialIconsHtml(props, baseUrl) : ''}
            </td>
          </tr>
        </table>
        
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
        
        <!-- Divider -->
        <div style="height: 1px; background-color: ${styles.dividerColor}; margin: 24px 0;"></div>
        
        <!-- Compliance Strip -->
        <div style="text-align: center;">
          ${props.legalText ? `<p style="font-size: 11px; color: ${styles.textMuted}; max-width: 448px; margin: 0 auto 12px; line-height: 1.5;">${props.legalText}</p>` : ''}
          
          <div style="font-size: 12px;">
            <a href="${props.unsubscribeUrl}" style="color: ${styles.linkAccent}; text-decoration: underline;">Unsubscribe</a>
            ${props.managePreferencesUrl ? `
              <span style="color: ${styles.textMuted}; margin: 0 8px;">|</span>
              <a href="${props.managePreferencesUrl}" style="color: ${styles.linkAccent}; text-decoration: underline;">Manage Preferences</a>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
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
        .footer-column {
          display: block !important;
          width: 100% !important;
          text-align: center !important;
          padding: 12px 8px !important;
        }
        .footer-social {
          text-align: center !important;
          margin-top: 16px !important;
        }
      }
    </style>
  `;
}
