export function generateUnsplashAttribution(
  authorName: string,
  authorLink: string,
  platform: 'facebook' | 'instagram' | 'email' | 'blog' = 'facebook'
): string {
  const baseAttribution = `Photo by ${authorName} on Unsplash`;
  
  switch (platform) {
    case 'email':
    case 'blog':
      return `<p style="font-size: 12px; color: #666; margin-top: 16px;">📸 <a href="${authorLink}" target="_blank" style="color: #666; text-decoration: none;">${baseAttribution}</a></p>`;
    case 'facebook':
    case 'instagram':
    default:
      return `📸 ${baseAttribution}`;
  }
}

export function trackUnsplashDownload(photoId: string): Promise<void> {
  return fetch(`https://api.unsplash.com/photos/${photoId}/download`, {
    headers: {
      'Authorization': `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'demo-key'}`,
      'Accept-Version': 'v1'
    }
  }).then(() => {
    console.log(`Tracked Unsplash download for photo ${photoId}`);
  }).catch(err => {
    console.warn('Failed to track Unsplash download:', err);
  });
}