/**
 * Social Media Icon URLs - PNG files hosted in Supabase Storage
 * Used by both frontend preview and email HTML generation
 */

// Supabase project URL
const SUPABASE_URL = 'https://udldmkqwnxhdeztyqcau.supabase.co';

export const ICON_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/assets/social-icons`;

export const socialIconUrls = {
  facebook: `${ICON_BASE_URL}/facebook.png`,
  instagram: `${ICON_BASE_URL}/instagram.png`,
  tiktok: `${ICON_BASE_URL}/tiktok.png`,
  pinterest: `${ICON_BASE_URL}/pinterest.png`,
  youtube: `${ICON_BASE_URL}/youtube.png`,
  linkedin: `${ICON_BASE_URL}/linkedin.png`,
};

/**
 * Get HTML img tag for a social icon
 */
export function getSocialIconImg(platform: keyof typeof socialIconUrls, alt: string): string {
  const url = socialIconUrls[platform];
  if (!url) return '';
  return `<img src="${url}" alt="${alt}" width="24" height="24" style="display:block;border:0;outline:none;text-decoration:none;" />`;
}
