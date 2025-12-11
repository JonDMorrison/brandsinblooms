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

/**
 * Base64-encoded SVG social icons (white #FFFFFF for dark backgrounds)
 * These are embedded directly in the email HTML - no external dependencies
 */
const socialIcons: Record<string, string> = {
  facebook: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTI0IDEyLjA3M2MwLTYuNjI3LTUuMzczLTEyLTEyLTEycy0xMiA1LjM3My0xMiAxMmMwIDUuOTkgNC4zODggMTAuOTU0IDEwLjEyNSAxMS44NTR2LTguMzg1SDcuMDc4di0zLjQ3aDMuMDQ3VjkuNDNjMC0zLjAwNyAxLjc5Mi00LjY2OSA0LjUzMy00LjY2OSAxLjMxMiAwIDIuNjg2LjIzNSAyLjY4Ni4yMzV2Mi45NTNIMTUuODNjLTEuNDkxIDAtMS45NTYuOTI1LTEuOTU2IDEuODc0djIuMjVoMy4zMjhsLS41MzIgMy40N2gtMi43OTZ2OC4zODVDMTkuNjEyIDIzLjAyNyAyNCAxOC4wNjIgMjQgMTIuMDczeiIvPjwvc3ZnPg==" alt="Facebook" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  instagram: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTEyIDIuMTYzYzMuMjA0IDAgMy41ODQuMDEyIDQuODUuMDcgMy4yNTIuMTQ4IDQuNzcxIDEuNjkxIDQuOTE5IDQuOTE5LjA1OCAxLjI2NS4wNjkgMS42NDUuMDY5IDQuODQ5IDAgMy4yMDUtLjAxMiAzLjU4NC0uMDY5IDQuODQ5LS4xNDkgMy4yMjUtMS42NjQgNC43NzEtNC45MTkgNC45MTktMS4yNjYuMDU4LTEuNjQ0LjA3LTQuODUuMDctMy4yMDQgMC0zLjU4NC0uMDEyLTQuODQ5LS4wNy0zLjI2LS4xNDktNC43NzEtMS42OTktNC45MTktNC45Mi0uMDU4LTEuMjY1LS4wNy0xLjY0NC0uMDctNC44NDkgMC0zLjIwNC4wMTMtMy41ODMuMDctNC44NDkuMTQ5LTMuMjI3IDEuNjY0LTQuNzcxIDQuOTE5LTQuOTE5IDEuMjY2LS4wNTcgMS42NDUtLjA2OSA0Ljg0OS0uMDY5em0wLTIuMTYzYy0zLjI1OSAwLTMuNjY3LjAxNC00LjkzNy4wNzItNC4zNTguMi02Ljc4IDIuNjE4LTYuOTggNi45OC0uMDU5IDEuMjgxLS4wNzMgMS42ODktLjA3MyA0LjkzOCAwIDMuMjU5LjAxNCAzLjY2OC4wNzIgNC45NDguMiA0LjM1OCAyLjYxOCA2Ljc4IDYuOTggNi45OCAxLjI4MS4wNTggMS42ODkuMDcyIDQuOTQ4LjA3MiAzLjI1OSAwIDMuNjY4LS4wMTQgNC45NDgtLjA3MiA0LjM1NC0uMiA2Ljc4Mi0yLjYxOCA2Ljk3OS02Ljk4LjA1OS0xLjI4LjA3My0xLjY4OS4wNzMtNC45NDggMC0zLjI1OS0uMDE0LTMuNjY3LS4wNzItNC45NDctLjE5Ni00LjM1NC0yLjYxNy02Ljc4LTYuOTc5LTYuOTgtMS4yODEtLjA1OS0xLjY5LS4wNzMtNC45NDktLjA3M3ptMCA1LjgzOGMtMy40MDMgMC02LjE2MiAyLjc1OS02LjE2MiA2LjE2MnMyLjc1OSA2LjE2MyA2LjE2MiA2LjE2MyA2LjE2Mi0yLjc1OSA2LjE2Mi02LjE2M2MwLTMuNDAzLTIuNzU5LTYuMTYyLTYuMTYyLTYuMTYyem0wIDEwLjE2MmMtMi4yMDkgMC00LTEuNzktNC00IDAtMi4yMDkgMS43OTEtNCA0LTRzNCAxLjc5MSA0IDRjMCAyLjIxLTEuNzkxIDQtNCA0em02LjQwNi0xMS44NDVjLS43OTYgMC0xLjQ0MS42NDUtMS40NDEgMS40NHMuNjQ1IDEuNDQgMS40NDEgMS40NGMuNzk1IDAgMS40MzktLjY0NSAxLjQzOS0xLjQ0cy0uNjQ0LTEuNDQtMS40MzktMS40NHoiLz48L3N2Zz4=" alt="Instagram" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  tiktok: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTEyLjUyNS4wMmMxLjMxLS4wMiAyLjYxLS4wMSAzLjkxLS4wMi4wOCAxLjUzLjYzIDMuMDkgMS43NSA0LjE3IDEuMTIgMS4xMSAyLjcgMS42MiA0LjI0IDEuNzl2NC4wM2MtMS40NC0uMDUtMi44OS0uMzUtNC4yLS45Ny0uNTctLjI2LTEuMS0uNTktMS42Mi0uOTMtLjAxIDIuOTIuMDEgNS44NC0uMDIgOC43NS0uMDggMS40LS41NCAyLjc5LTEuMzUgMy45NC0xLjMxIDEuOTItMy41OCAzLjE3LTUuOTEgMy4yMS0xLjQzLjA4LTIuODYtLjMxLTQuMDgtMS4wMy0yLjAyLTEuMTktMy40NC0zLjM3LTMuNjUtNS43MS0uMDItLjUtLjAzLTEtLjAxLTEuNDkuMTgtMS45IDEuMTItMy43MiAyLjU4LTQuOTYgMS42Ni0xLjQ0IDMuOTgtMi4xMyA2LjE1LTEuNzIuMDIgMS40OC0uMDQgMi45Ni0uMDQgNC40NC0uOTktLjMyLTIuMTUtLjIzLTMuMDIuMzctLjYzLjQxLTEuMTEgMS4wNC0xLjM2IDEuNzUtLjIxLjUxLS4xNSAxLjA3LS4xNCAxLjYxLjI0IDEuNjQgMS44MiAzLjAyIDMuNSAyLjg3IDEuMTItLjAxIDIuMTktLjY2IDIuNzctMS42MS4xOS0uMzMuNC0uNjcuNDEtMS4wNi4xLTEuNzkuMDYtMy41Ny4wNy01LjM2LjAxLTQuMDMtLjAxLTguMDUuMDItMTIuMDd6Ii8+PC9zdmc+" alt="TikTok" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  pinterest: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTEyIDBDNS4zNzMgMCAwIDUuMzcyIDAgMTJjMCA1LjA4NCAzLjE2MyA5LjQyNiA3LjYyNyAxMS4xNzQtLjEwNS0uOTQ5LS4yLTIuNDA1LjA0Mi0zLjQ0MS4yMTgtLjkzNyAxLjQwNy01Ljk2NSAxLjQwNy01Ljk2NXMtLjM1OS0uNzE5LS4zNTktMS43ODJjMC0xLjY2OC45NjctMi45MTQgMi4xNzEtMi45MTQgMS4wMjMgMCAxLjUxOC43NjkgMS41MTggMS42OSAwIDEuMDI5LS42NTUgMi41NjgtLjk5NCAzLjk5NS0uMjgzIDEuMTk0LjU5OSAyLjE2OSAxLjc3NyAyLjE2OSAyLjEzMyAwIDMuNzcyLTIuMjQ5IDMuNzcyLTUuNDk1IDAtMi44NzMtMi4wNjQtNC44ODItNS4wMTItNC44ODItMy40MTQgMC01LjQxOCAyLjU2MS01LjQxOCA1LjIwNyAwIDEuMDMxLjM5NyAyLjEzOC44OTMgMi43MzguMDk4LjExOS4xMTIuMjI0LjA4My4zNDVsLS4zMzMgMS4zNmMtLjA1My4yMi0uMTc0LjI2Ny0uNDAyLjE2MS0xLjQ5OS0uNjk4LTIuNDM2LTIuODg5LTIuNDM2LTQuNjQ5IDAtMy43ODUgMi43NS03LjI2MiA3LjkyOS03LjI2MiA0LjE2MyAwIDcuMzk4IDIuOTY3IDcuMzk4IDYuOTMxIDAgNC4xMzYtMi42MDcgNy40NjQtNi4yMjcgNy40NjQtMS4yMTYgMC0yLjM1OS0uNjMxLTIuNzUtMS4zNzhsLS43NDggMi44NTNjLS4yNzEgMS4wNDMtMS4wMDIgMi4zNS0xLjQ5MiAzLjE0NkM5LjU3IDIzLjgxMiAxMC43NjMgMjQgMTIgMjRjNi42MjcgMCAxMi01LjM3MyAxMi0xMiAwLTYuNjI4LTUuMzczLTEyLTEyLTEyeiIvPjwvc3ZnPg==" alt="Pinterest" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  youtube: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTIzLjQ5OCA2LjE4NmEzLjAxNiAzLjAxNiAwIDAgMC0yLjEyMi0yLjEzNkMxOS41MDUgMy41NDUgMTIgMy41NDUgMTIgMy41NDVzLTcuNTA1IDAtOS4zNzcuNTA1QTMuMDE3IDMuMDE3IDAgMCAwIC41MDIgNi4xODZDMCA4LjA3IDAgMTIgMCAxMnMwIDMuOTMuNTAyIDUuODE0YTMuMDE2IDMuMDE2IDAgMCAwIDIuMTIyIDIuMTM2YzEuODcxLjUwNSA5LjM3Ni41MDUgOS4zNzYuNTA1czcuNTA1IDAgOS4zNzctLjUwNWEzLjAxNSAzLjAxNSAwIDAgMCAyLjEyMi0yLjEzNkMyNCAxNS45MyAyNCAxMiAyNCAxMnMwLTMuOTMtLjUwMi01LjgxNHpNOS41NDUgMTUuNTY4VjguNDMyTDE1LjgxOCAxMmwtNi4yNzMgMy41Njh6Ii8+PC9zdmc+" alt="YouTube" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  linkedin: `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTIwLjQ0NyAyMC40NTJoLTMuNTU0di01LjU2OWMwLTEuMzI4LS4wMjctMy4wMzctMS44NTItMy4wMzctMS44NTMgMC0yLjEzNiAxLjQ0NS0yLjEzNiAyLjkzOXY1LjY2N0g5LjM1MVY5aDMuNDE0djEuNTYxaC4wNDZjLjQ3Ny0uOSAxLjYzNy0xLjg1IDMuMzctMS44NSAzLjYwMSAwIDQuMjY3IDIuMzcgNC4yNjcgNS40NTV2Ni4yODZ6TTUuMzM3IDcuNDMzYy0xLjE0NCAwLTIuMDYzLS45MjYtMi4wNjMtMi4wNjUgMC0xLjEzOC45Mi0yLjA2MyAyLjA2My0yLjA2MyAxLjE0IDAgMi4wNjQuOTI1IDIuMDY0IDIuMDYzIDAgMS4xMzktLjkyNSAyLjA2NS0yLjA2NCAyLjA2NXptMS43ODIgMTMuMDE5SDMuNTU1VjloMy41NjR2MTEuNDUyek0yMi4yMjUgMEgxLjc3MUMuNzkyIDAgMCAuNzc0IDAgMS43Mjl2MjAuNTQyQzAgMjMuMjI3Ljc5MiAyNCAxLjc3MSAyNGgyMC40NTFDMJM4IDI0IDI0IDIzLjIyNyAyNCAyMi4yNzFWMS43MjlDMjQgLjc3NCAyMy4yIDAgMjIuMjIyIDBoLjAwM3oiLz48L3N2Zz4=" alt="LinkedIn" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
};

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
  key: keyof typeof socialIcons;
  url: string;
  name: string;
};

/**
 * Build social icons HTML with email-safe table wrapper
 */
function buildSocialIconsHtml(props: NewsletterFooterProps, styles: FooterStyleConfig): string {
  const socialConfigs: SocialConfig[] = [
    { key: "facebook", url: props.facebookUrl || "", name: "Facebook" },
    { key: "instagram", url: props.instagramUrl || "", name: "Instagram" },
    { key: "tiktok", url: props.tiktokUrl || "", name: "TikTok" },
    { key: "pinterest", url: props.pinterestUrl || "", name: "Pinterest" },
    { key: "youtube", url: props.youtubeUrl || "", name: "YouTube" },
    { key: "linkedin", url: props.linkedinUrl || "", name: "LinkedIn" },
  ];

  const activeSocials = socialConfigs.filter(s => !!s.url && !!socialIcons[s.key]);
  
  if (activeSocials.length === 0) return '';

  const iconsHtml = activeSocials.map(({ url, key }) => `
    <a href="${url}" target="_blank" rel="noopener noreferrer" 
       style="display:inline-block;margin:0 6px;text-decoration:none;">
      ${socialIcons[key]}
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
export function generateNewsletterFooterHtml(props: NewsletterFooterProps): string {
  const baseStyles = getFooterStyleConfig(props.footerBackgroundColor, props.brandPrimaryColor);
  
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
        
        <!-- Three Column Layout for Desktop -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <!-- Left Column: Logo & Brand -->
            <td width="33%" valign="top" style="padding: 0 8px; text-align: left;">
              ${buildLogoHtml(props, styles)}
              ${props.companyName ? `<div style="font-size: 14px; font-weight: 500; color: ${styles.textPrimary}; margin-bottom: 4px;">${props.companyName}</div>` : ''}
              ${props.websiteUrl ? `<a href="${props.websiteUrl}" style="font-size: 12px; color: ${styles.textMuted}; text-decoration: none;">${props.websiteUrl.replace(/^https?:\/\//, '')}</a>` : ''}
            </td>
            
            <!-- Middle Column: Address & Contact -->
            <td width="34%" valign="top" style="padding: 0 8px; text-align: left;">
              ${hasAddress ? buildAddressHtml(props, styles) : ''}
              ${hasContact ? buildContactHtml(props, styles) : ''}
            </td>
            
            <!-- Right Column: Social Icons -->
            <td width="33%" valign="top" style="padding: 0 8px; text-align: right;">
              ${hasSocial ? buildSocialIconsHtml(props, styles) : ''}
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
