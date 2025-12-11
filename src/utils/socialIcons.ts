/**
 * Social Media Icon URLs - PNG files in the public folder
 * Used by both frontend preview and email HTML generation
 */

// Use deployed app URL for email generation (production), or local for preview
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const ICON_BASE_URL = '/social-icons';

export const socialIconUrls = {
  facebook: `${ICON_BASE_URL}/facebook.png`,
  instagram: `${ICON_BASE_URL}/instagram.png`,
  tiktok: `${ICON_BASE_URL}/tiktok.png`,
  pinterest: `${ICON_BASE_URL}/pinterest.png`,
  youtube: `${ICON_BASE_URL}/youtube.png`,
  linkedin: `${ICON_BASE_URL}/linkedin.png`,
};

/**
 * Get absolute URL for social icon (for email HTML)
 */
export function getAbsoluteSocialIconUrl(platform: keyof typeof socialIconUrls): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${socialIconUrls[platform]}`;
}

/**
 * Get HTML img tag for a social icon
 */
export function getSocialIconImg(platform: keyof typeof socialIconUrls, alt: string): string {
  const url = socialIconUrls[platform];
  if (!url) return '';
  return `<img src="${url}" alt="${alt}" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`;
}
