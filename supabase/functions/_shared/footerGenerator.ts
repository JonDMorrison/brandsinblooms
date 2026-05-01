/**
 * Server-side Newsletter Footer HTML Generator
 * Used by edge functions to generate email footers with social icons
 */

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
  backgroundColor: '#FFFFFF',
  textPrimary: '#1F2937',
  textMuted: '#6B7280',
  linkAccent: '#2563EB',
  dividerColor: '#E5E7EB',
};

// PNG social icons hosted on deployed app.
// Exported so that the campaign-content renderer in campaignEmailSource.ts
// can reuse the exact same icon markup for user-authored social-follow
// blocks — keeping per-tenant social rows visually identical to the
// auto-injected unsubscribe footer's social row.
export const socialIcons: Record<string, string> = {
  facebook: `<img src="${ICON_BASE_URL}/facebook.png" alt="Facebook" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  instagram: `<img src="${ICON_BASE_URL}/instagram.png" alt="Instagram" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  tiktok: `<img src="${ICON_BASE_URL}/tiktok.png" alt="TikTok" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  pinterest: `<img src="${ICON_BASE_URL}/pinterest.png" alt="Pinterest" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  youtube: `<img src="${ICON_BASE_URL}/youtube.png" alt="YouTube" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
  linkedin: `<img src="${ICON_BASE_URL}/linkedin.png" alt="LinkedIn" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`,
};

function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function getFooterStyleConfig(
  footerBackgroundColor?: string,
  _brandPrimaryColor?: string // Kept for API compatibility but NOT used - footer defaults to white
): FooterStyleConfig {
  // Footer defaults to white - only use explicit footer background color override
  const bgColor = footerBackgroundColor || DEFAULT_FOOTER_COLORS.backgroundColor;
  const isDark = isColorDark(bgColor);
  
  return {
    backgroundColor: bgColor,
    textPrimary: isDark ? '#F3F4F6' : '#1F2937',
    textMuted: isDark ? '#D1D5DB' : '#6B7280',
    linkAccent: isDark ? '#E5BFA7' : '#2563EB',
    dividerColor: isDark ? lightenColor(bgColor, 15) : bgColor,
  };
}

function getCompanyInitials(companyName?: string): string {
  if (!companyName) return 'CO';
  const words = companyName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function buildLogoHtml(profile: CompanyProfileData, styles: FooterStyleConfig): string {
  const logoUrl = profile.feature_flags?.company_logo_url;
  const companyName = profile.company_name || 'Company';
  
  if (logoUrl) {
    return `
      <img src="${logoUrl}" alt="${companyName}" style="height: 40px; width: auto; object-fit: contain; margin-bottom: 12px;" />
    `;
  }
  
  const logoBgColor = profile.feature_flags?.footer_colors?.logoBackgroundColor || styles.linkAccent;
  const logoTextColor = profile.feature_flags?.footer_colors?.logoTextColor || styles.backgroundColor;
  const initials = getCompanyInitials(companyName);
  
  return `
    <div style="width: 48px; height: 48px; background-color: ${logoBgColor}; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
      <span style="color: ${logoTextColor}; font-size: 18px; font-weight: bold; line-height: 48px;">${initials}</span>
    </div>
  `;
}

function buildAddressHtml(profile: CompanyProfileData, styles: FooterStyleConfig): string {
  const lines: string[] = [];
  
  if (profile.street_address) lines.push(profile.street_address);
  
  const cityLine: string[] = [];
  if (profile.city) cityLine.push(profile.city);
  if (profile.state_province) cityLine.push(profile.state_province);
  if (profile.postal_code) cityLine.push(profile.postal_code);
  if (cityLine.length > 0) lines.push(cityLine.join(', '));
  
  if (profile.country) lines.push(profile.country);
  
  if (lines.length === 0) return '';
  
  return `
    <div style="margin-bottom: 8px; color: ${styles.textMuted}; font-size: 13px; line-height: 1.6;">
      ${lines.join('<br />')}
    </div>
  `;
}

function buildContactHtml(profile: CompanyProfileData, styles: FooterStyleConfig): string {
  const items: string[] = [];
  
  if (profile.company_email) {
    items.push(`<a href="mailto:${profile.company_email}" style="color: ${styles.textMuted}; text-decoration: none;">${profile.company_email}</a>`);
  }
  if (profile.company_phone) {
    items.push(`<a href="tel:${profile.company_phone}" style="color: ${styles.textMuted}; text-decoration: none;">${profile.company_phone}</a>`);
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

function buildSocialIconsHtml(profile: CompanyProfileData): string {
  const socialConfigs: SocialConfig[] = [
    { key: "facebook", url: profile.facebook_url || "", name: "Facebook" },
    { key: "instagram", url: profile.instagram_url || "", name: "Instagram" },
    { key: "tiktok", url: profile.tiktok_url || "", name: "TikTok" },
    { key: "pinterest", url: profile.pinterest_url || "", name: "Pinterest" },
    { key: "youtube", url: profile.youtube_url || "", name: "YouTube" },
    { key: "linkedin", url: profile.linkedin_url || "", name: "LinkedIn" },
  ];

  const activeSocials = socialConfigs.filter(s => !!s.url && !!socialIcons[s.key]);
  
  console.log(`📧 Social links found: ${activeSocials.map(l => l.name).join(', ') || 'none'}`);
  
  if (activeSocials.length === 0) return '';

  const iconsHtml = activeSocials.map(({ url, key }) => `
    <a href="${url}" target="_blank" style="display:inline-block;margin:0 6px;text-decoration:none;">
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
 * Generate complete footer HTML from company profile data
 */
export function generateServerFooterHtml(
  profile: CompanyProfileData,
  unsubscribeUrl: string,
  managePreferencesUrl?: string
): string {
  console.log('📧 Generating server-side footer with profile:', {
    companyName: profile.company_name,
    hasFacebook: !!profile.facebook_url,
    hasInstagram: !!profile.instagram_url,
    hasTiktok: !!profile.tiktok_url,
    hasPinterest: !!profile.pinterest_url,
    hasYoutube: !!profile.youtube_url,
    hasLinkedin: !!profile.linkedin_url,
    iconBaseUrl: ICON_BASE_URL,
  });

  // Get footer colors from feature_flags or defaults
  const footerColors = profile.feature_flags?.footer_colors;
  const baseStyles = getFooterStyleConfig(
    footerColors?.backgroundColor,
    profile.brand_primary_color
  );
  
  const styles: FooterStyleConfig = {
    backgroundColor: footerColors?.backgroundColor || baseStyles.backgroundColor,
    textPrimary: footerColors?.textColor || baseStyles.textPrimary,
    textMuted: footerColors?.textColor || baseStyles.textMuted,
    linkAccent: footerColors?.linkColor || baseStyles.linkAccent,
    dividerColor: footerColors?.dividerColor || baseStyles.dividerColor,
  };

  const hasAddress = profile.street_address || profile.city || profile.state_province || profile.postal_code || profile.country;
  const hasContact = profile.company_email || profile.company_phone;
  const hasSocial = profile.facebook_url || profile.instagram_url || profile.tiktok_url || profile.pinterest_url || profile.youtube_url || profile.linkedin_url;
  
  console.log(`📧 Footer sections: address=${hasAddress}, contact=${hasContact}, social=${hasSocial}`);

  return `
    <div style="background-color: ${styles.backgroundColor}; width: 100%; margin-top: 40px;">
      <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          <tr>
            <!-- Left Column: Logo & Brand -->
            <td width="33%" valign="top" style="padding: 0 8px; text-align: left;">
              ${buildLogoHtml(profile, styles)}
              ${profile.company_name ? `<div style="font-size: 14px; font-weight: 500; color: ${styles.textPrimary}; margin-bottom: 4px;">${profile.company_name}</div>` : ''}
              ${profile.website_url ? `<a href="${profile.website_url}" style="font-size: 12px; color: ${styles.textMuted}; text-decoration: none;">${profile.website_url.replace(/^https?:\/\//, '')}</a>` : ''}
            </td>
            
            <!-- Middle Column: Address & Contact -->
            <td width="34%" valign="top" style="padding: 0 8px; text-align: left;">
              ${hasAddress ? buildAddressHtml(profile, styles) : ''}
              ${hasContact ? buildContactHtml(profile, styles) : ''}
            </td>
            
            <!-- Right Column: Social Icons -->
            <td width="33%" valign="top" style="padding: 0 8px; text-align: right;">
              ${hasSocial ? buildSocialIconsHtml(profile) : ''}
            </td>
          </tr>
        </table>
        
        <!-- Divider -->
        <div style="height: 1px; background-color: ${styles.dividerColor}; margin: 24px 0;"></div>
        
        <!-- Compliance Strip -->
        <div style="text-align: center;">
          ${profile.footer_legal_text ? `<p style="font-size: 11px; color: ${styles.textMuted}; max-width: 448px; margin: 0 auto 12px; line-height: 1.5;">${profile.footer_legal_text}</p>` : ''}
          
          <div style="font-size: 12px;">
            <a href="${unsubscribeUrl}" style="color: ${styles.linkAccent}; text-decoration: underline;">Unsubscribe</a>
            ${managePreferencesUrl ? `
              <span style="color: ${styles.textMuted}; margin: 0 8px;">|</span>
              <a href="${managePreferencesUrl}" style="color: ${styles.linkAccent}; text-decoration: underline;">Manage Preferences</a>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Check if email content already has a proper footer
 */
export function hasProperFooter(htmlContent: string): boolean {
  // Check for PNG social icons in Supabase Storage or legacy formats
  const hasSocialIcons = htmlContent.includes('/storage/v1/object/public/assets/social-icons/') ||
                         htmlContent.includes('data:image/svg+xml;base64') ||
                         htmlContent.includes('s.magecdn.com/social') || 
                         htmlContent.includes('/social-icons/');
  
  // Check for unsubscribe link
  const hasUnsubscribe = htmlContent.toLowerCase().includes('unsubscribe');
  
  return hasSocialIcons && hasUnsubscribe;
}
