import { supabase } from "@/integrations/supabase/client";
import { extractImageSummary } from "@/utils/imageContentSummary";

export interface UnsplashImageResult {
  url: string;
  thumb: string;
  alt: string;
  photographer?: string;
  unsplash_id?: string;
  author_name?: string;
  source: 'unsplash';
}

/**
 * Fetches a royalty-free Unsplash image based on a query keyword
 * @param query - Search keyword/phrase for the image
 * @returns Promise resolving to image data or null if no results
 */
export async function getUnsplashImage(query: string): Promise<UnsplashImageResult | null> {
  try {
    console.log(`[UNSPLASH] Fetching image for query: "${query}"`);
    
    const { data, error } = await supabase.functions.invoke('get-unsplash-image', {
      body: { query }
    });
    
    if (error) {
      console.error('[UNSPLASH] Service error:', error);
      return null;
    }
    
    if (!data?.urls?.regular) {
      console.warn('[UNSPLASH] No image found for query:', query);
      return null;
    }
    
    return {
      url: data.urls.regular,
      thumb: data.urls.thumb || data.urls.small,
      alt: data.alt_description || query,
      photographer: data.user?.name,
      unsplash_id: data.id,
      author_name: data.user?.name,
      source: 'unsplash'
    };
  } catch (error) {
    console.error('[UNSPLASH] Exception in getUnsplashImage:', error);
    return null;
  }
}

/**
 * Generates a search keyword from post content
 * @param content - The post content text
 * @returns Extracted keyword for image search
 */
export function extractImageKeyword(content: string): string {
  return extractImageSummary(content);
}