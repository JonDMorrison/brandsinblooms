/**
 * Per-newsletter footer styling configuration
 * Stored in campaign metadata.footer_styling
 */

export interface FooterStyling {
  // Background color for the footer
  backgroundColor?: string;
  
  // Primary text color
  textColor?: string;
  
  // Logo initials background color (when no logo image)
  logoBackgroundColor?: string;
  
  // Logo initials text color
  logoTextColor?: string;
  
  // Override company name for this campaign
  companyNameOverride?: string;
  
  // Link accent color (Unsubscribe, Manage Preferences)
  linkColor?: string;
  
  // Divider line color
  dividerColor?: string;
}

/**
 * Check if footer styling has any explicit overrides
 */
export function hasFooterStylingOverrides(styling?: FooterStyling): boolean {
  if (!styling) return false;
  return !!(
    styling.backgroundColor ||
    styling.textColor ||
    styling.logoBackgroundColor ||
    styling.logoTextColor ||
    styling.companyNameOverride ||
    styling.linkColor ||
    styling.dividerColor
  );
}
