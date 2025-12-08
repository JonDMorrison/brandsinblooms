/**
 * Newsletter Footer Types
 * Standardized, brand-aware footer configuration
 */

export interface NewsletterFooterProps {
  // Logo & Brand
  logoUrl?: string;
  companyName?: string;

  // Address / contact (from tenant settings)
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;

  // Social URLs – render icon only if link exists
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;

  // Compliance links
  unsubscribeUrl: string;
  managePreferencesUrl?: string;

  // Optional legal line
  legalText?: string;

  // Campaign-level background color override (hex like "#283024")
  footerBackgroundColor?: string;
  
  // Brand colors for fallback
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
}

export interface FooterStyleConfig {
  backgroundColor: string;
  textPrimary: string;
  textMuted: string;
  linkAccent: string;
  dividerColor: string;
}

// Default deep green footer colors
export const DEFAULT_FOOTER_COLORS: FooterStyleConfig = {
  backgroundColor: '#283024',
  textPrimary: '#F3F4F6',
  textMuted: '#D1D5DB',
  linkAccent: '#E5BFA7',
  dividerColor: '#3D4A38',
};

/**
 * Generate footer style configuration based on provided colors
 */
export function getFooterStyleConfig(
  footerBackgroundColor?: string,
  brandPrimaryColor?: string
): FooterStyleConfig {
  const bgColor = footerBackgroundColor || brandPrimaryColor || DEFAULT_FOOTER_COLORS.backgroundColor;
  
  // Determine if background is dark for text color contrast
  const isDark = isColorDark(bgColor);
  
  return {
    backgroundColor: bgColor,
    textPrimary: isDark ? '#F3F4F6' : '#1F2937',
    textMuted: isDark ? '#D1D5DB' : '#6B7280',
    linkAccent: isDark ? '#E5BFA7' : '#2563EB',
    dividerColor: isDark ? lightenColor(bgColor, 15) : darkenColor(bgColor, 10),
  };
}

/**
 * Check if a hex color is considered dark
 */
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Get company initials for fallback logo
 */
export function getCompanyInitials(companyName?: string): string {
  if (!companyName) return 'CO';
  const words = companyName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
