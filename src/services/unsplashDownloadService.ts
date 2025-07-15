import { supabase } from "@/integrations/supabase/client";

export interface UnsplashDownloadData {
  imageUrl: string;
  photographer: string;
  photographerUsername?: string;
  photographerUrl?: string;
  unsplashId: string;
  downloadLocation?: string;
  quality?: 'raw' | 'full' | 'regular';
}

export interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

/**
 * Downloads an Unsplash image with proper attribution tracking
 */
export async function downloadUnsplashImage(data: UnsplashDownloadData): Promise<DownloadResult> {
  try {
    console.log(`[DOWNLOAD] Starting download for image ${data.unsplashId} by ${data.photographer}`);
    
    // Track download with Unsplash API if download_location is available
    if (data.downloadLocation) {
      try {
        await trackUnsplashDownload(data.downloadLocation);
        console.log(`[DOWNLOAD] Successfully tracked download for ${data.unsplashId}`);
      } catch (error) {
        console.warn(`[DOWNLOAD] Failed to track download for ${data.unsplashId}:`, error);
        // Continue with download even if tracking fails
      }
    }
    
    // Use highest quality URL available
    const downloadUrl = getDownloadUrl(data);
    const filename = generateAttributedFilename(data);
    
    // Create download link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    
    // For security, append to body, click, then remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`[DOWNLOAD] Successfully initiated download: ${filename}`);
    
    return {
      success: true,
      downloadUrl,
      filename
    };
    
  } catch (error) {
    console.error('[DOWNLOAD] Error downloading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown download error'
    };
  }
}

/**
 * Track download with Unsplash API (required by API terms)
 */
async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  const { error } = await supabase.functions.invoke('track-unsplash-download', {
    body: { downloadLocation }
  });
  
  if (error) {
    throw new Error(`Download tracking failed: ${error.message}`);
  }
}

/**
 * Get the best quality download URL available
 */
function getDownloadUrl(data: UnsplashDownloadData): string {
  // Use highest quality specified, fallback to provided imageUrl
  switch (data.quality) {
    case 'raw':
    case 'full':
    case 'regular':
      return data.imageUrl; // Assume imageUrl is already the correct quality
    default:
      return data.imageUrl;
  }
}

/**
 * Generate filename with photographer attribution
 */
function generateAttributedFilename(data: UnsplashDownloadData): string {
  const photographer = data.photographerUsername || data.photographer.replace(/\s+/g, '-');
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `unsplash-${photographer}-${data.unsplashId}-${timestamp}.jpg`;
}

/**
 * Generate attribution text for various platforms
 */
export function generateAttributionText(
  photographer: string,
  photographerUrl?: string,
  platform: 'facebook' | 'instagram' | 'email' | 'blog' | 'copy' = 'copy'
): string {
  const baseAttribution = `Photo by ${photographer} on Unsplash`;
  const linkAttribution = photographerUrl ? `Photo by ${photographer} (${photographerUrl}) on Unsplash` : baseAttribution;
  
  switch (platform) {
    case 'email':
    case 'blog':
      return photographerUrl 
        ? `<p style="font-size: 12px; color: #666; margin-top: 16px;">📸 <a href="${photographerUrl}" target="_blank" style="color: #666; text-decoration: none;">${baseAttribution}</a></p>`
        : `<p style="font-size: 12px; color: #666; margin-top: 16px;">📸 ${baseAttribution}</p>`;
    case 'facebook':
    case 'instagram':
      return `📸 ${baseAttribution}`;
    case 'copy':
    default:
      return linkAttribution;
  }
}

/**
 * Copy attribution text to clipboard
 */
export async function copyAttributionToClipboard(
  photographer: string,
  photographerUrl?: string,
  platform: 'facebook' | 'instagram' | 'email' | 'blog' | 'copy' = 'copy'
): Promise<boolean> {
  try {
    const attribution = generateAttributionText(photographer, photographerUrl, platform);
    await navigator.clipboard.writeText(attribution);
    console.log(`[ATTRIBUTION] Copied to clipboard: ${attribution}`);
    return true;
  } catch (error) {
    console.error('[ATTRIBUTION] Failed to copy to clipboard:', error);
    return false;
  }
}