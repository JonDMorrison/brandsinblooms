/**
 * Server-side Newsletter Footer HTML Generator
 * Used by edge functions to generate email footers with social icons
 */

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

// Default deep green footer colors
const DEFAULT_FOOTER_COLORS: FooterStyleConfig = {
  backgroundColor: '#283024',
  textPrimary: '#F3F4F6',
  textMuted: '#D1D5DB',
  linkAccent: '#E5BFA7',
  dividerColor: '#3D4A38',
};

// Inline SVG icons for social platforms
const socialIcons = {
  facebook: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  tiktok: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  pinterest: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/></svg>`,
  youtube: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  linkedin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
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
  brandPrimaryColor?: string
): FooterStyleConfig {
  const bgColor = footerBackgroundColor || brandPrimaryColor || DEFAULT_FOOTER_COLORS.backgroundColor;
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

function buildSocialIconsHtml(profile: CompanyProfileData, styles: FooterStyleConfig): string {
  const socialLinks: { url: string; icon: string; name: string }[] = [];
  
  if (profile.facebook_url) socialLinks.push({ url: profile.facebook_url, icon: socialIcons.facebook, name: 'Facebook' });
  if (profile.instagram_url) socialLinks.push({ url: profile.instagram_url, icon: socialIcons.instagram, name: 'Instagram' });
  if (profile.tiktok_url) socialLinks.push({ url: profile.tiktok_url, icon: socialIcons.tiktok, name: 'TikTok' });
  if (profile.pinterest_url) socialLinks.push({ url: profile.pinterest_url, icon: socialIcons.pinterest, name: 'Pinterest' });
  if (profile.youtube_url) socialLinks.push({ url: profile.youtube_url, icon: socialIcons.youtube, name: 'YouTube' });
  if (profile.linkedin_url) socialLinks.push({ url: profile.linkedin_url, icon: socialIcons.linkedin, name: 'LinkedIn' });
  
  console.log(`📧 Social links found: ${socialLinks.map(l => l.name).join(', ') || 'none'}`);
  
  if (socialLinks.length === 0) return '';
  
  const iconsHtml = socialLinks.map(({ url, icon, name }) => `
    <a href="${url}" target="_blank" rel="noopener noreferrer" title="${name}" style="display: inline-block; margin: 0 6px; color: ${styles.textPrimary}; text-decoration: none;">
      ${icon}
    </a>
  `).join('');
  
  return `
    <div style="text-align: right;">
      ${iconsHtml}
    </div>
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
              ${hasSocial ? buildSocialIconsHtml(profile, styles) : ''}
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
  // Check for social icons presence
  const hasSocialIcons = htmlContent.includes('viewBox="0 0 24 24"') && 
                         (htmlContent.includes('facebook') || 
                          htmlContent.includes('instagram') || 
                          htmlContent.includes('linkedin'));
  
  // Check for unsubscribe link
  const hasUnsubscribe = htmlContent.includes('Unsubscribe') || 
                         htmlContent.includes('unsubscribe');
  
  return hasSocialIcons && hasUnsubscribe;
}
