
import { supabase } from "@/integrations/supabase/client";
import { extractSmartImageKeywords, searchWithFallbacks } from "@/utils/smartImageKeywords";

export interface UnsplashImage {
  url: string;
  thumb: string;
  alt: string;
  photographer?: string;
  unsplash_id?: string;
}

/**
 * Fetch image using smart keyword extraction
 */
export async function fetchSmartImageFromContent(content: string, postType?: string): Promise<UnsplashImage | null> {
  try {
    console.log(`[UNSPLASH] Smart fetching image for content (${content.length} chars)`);
    
    // Extract smart keywords from content
    const keywords = extractSmartImageKeywords(content, postType);
    
    // Search with fallbacks
    const result = await searchWithFallbacks(keywords, async (query: string) => {
      console.log(`[UNSPLASH] Trying query: "${query}"`);
      
      const { data, error } = await supabase.functions.invoke('get-unsplash-image', {
        body: { query }
      });
      
      if (error) {
        console.warn('[UNSPLASH] Query failed:', query, error);
        return null;
      }
      
      if (!data?.urls?.regular) {
        console.warn('[UNSPLASH] No results for:', query);
        return null;
      }
      
      return {
        url: data.urls.regular,
        thumb: data.urls.thumb || data.urls.small,
        alt: data.alt_description || query,
        photographer: data.user?.name,
        unsplash_id: data.id
      };
    });
    
    return result;
  } catch (error) {
    console.error('[UNSPLASH] Exception in fetchSmartImageFromContent:', error);
    return null;
  }
}

/**
 * Legacy function for backward compatibility - now uses smart extraction
 */
export async function fetchSmartImage(keyword: string, context = '', useRawKeyword = false): Promise<UnsplashImage | null> {
  try {
    // If it's a long text (content), use smart extraction
    if (keyword.length > 100 && !useRawKeyword) {
      console.log('[UNSPLASH] Long keyword detected, using smart extraction');
      return fetchSmartImageFromContent(keyword, context);
    }
    
    // Use keyword as-is if useRawKeyword is true, otherwise enhance with garden context
    const query = useRawKeyword ? keyword.trim() : 
      `${keyword} ${context}`.trim() || 'garden center nursery plants';
    
    console.log(`[UNSPLASH] Fetching image for keyword: "${query}"`);
    
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
      alt: data.alt_description || keyword,
      photographer: data.user?.name,
      unsplash_id: data.id
    };
  } catch (error) {
    console.error('[UNSPLASH] Exception in fetchSmartImage:', error);
    return null;
  }
}

export async function fetchMultipleSmartImages(keywords: string[], context = '', count = 3): Promise<UnsplashImage[]> {
  const images: UnsplashImage[] = [];
  
  for (const keyword of keywords.slice(0, count)) {
    const image = await fetchSmartImage(keyword, context);
    if (image) {
      images.push(image);
    }
  }
  
  return images;
}
