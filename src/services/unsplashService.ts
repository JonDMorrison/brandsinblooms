
import { supabase } from "@/integrations/supabase/client";

export interface UnsplashImage {
  url: string;
  thumb: string;
  alt: string;
  photographer?: string;
  unsplash_id?: string;
}

export async function fetchSmartImage(keyword: string, context = '', useRawKeyword = false): Promise<UnsplashImage | null> {
  try {
    // Use keyword as-is if useRawKeyword is true, otherwise enhance with garden context
    const query = useRawKeyword ? keyword.trim() : 
      `${keyword} ${context}`.trim() || 'garden center nursery plants';
    
    console.log(`[UNSPLASH] Fetching smart image for: "${query}"`);
    
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
