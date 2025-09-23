import { supabase } from '@/integrations/supabase/client';
import { ImageAttachment } from '@/lib/contentTypes';

interface MediaSelectorOptions {
  prompt: string;
  fallback?: string;
  count?: number;
}

interface MediaSelectorResult {
  url: string;
  thumb?: string;
  alt: string;
  photographer?: string;
}

export const mediaSelector = async (options: MediaSelectorOptions): Promise<MediaSelectorResult> => {
  const { prompt, count = 1 } = options;
  
  console.log(`[MEDIA SELECTOR] Fetching image for prompt: "${prompt}"`);
  
  try {
    // First try to get content-specific image from Unsplash
    const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
      body: { 
        query: prompt,
        maxImages: count,
        orientation: 'squarish',
        orderBy: 'relevant',
        contentFilter: 'high'
      }
    });

    if (!error && data?.images && data.images.length > 0) {
      const selectedImage = data.images[0];
      console.log(`[MEDIA SELECTOR] Selected content-specific image:`, selectedImage.id);
      
      return {
        url: selectedImage.download_url,
        thumb: selectedImage.thumb_url,
        alt: selectedImage.alt || prompt,
        photographer: selectedImage.photographer
      };
    }

    console.warn('[MEDIA SELECTOR] Content-specific image failed, trying curated collection');
    
    // Fallback to curated garden collection
    const { data: curatedData, error: curatedError } = await supabase.functions.invoke('fetch-unsplash-images', {
      body: { 
        collection: 'cfl9BkhJD2o', // Garden center curated collection
        maxImages: count,
        page: 1
      }
    });

    if (!curatedError && curatedData?.images && curatedData.images.length > 0) {
      const selectedImage = curatedData.images[0];
      console.log(`[MEDIA SELECTOR] Selected curated fallback image:`, selectedImage.id);
      
      return {
        url: selectedImage.download_url,
        thumb: selectedImage.thumb_url,
        alt: selectedImage.alt || `Garden center image - ${prompt}`,
        photographer: selectedImage.photographer
      };
    }

    console.error('[MEDIA SELECTOR] Both content and curated image fetch failed');
    return createGardenFallbackResult(prompt);
    
  } catch (error) {
    console.error('[MEDIA SELECTOR] Error fetching image:', error);
    return createGardenFallbackResult(prompt);
  }
};

const createGardenFallbackResult = (prompt: string): MediaSelectorResult => {
  // Use a curated garden center image as ultimate fallback
  return {
    url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1200&h=800&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=400&fit=crop',
    alt: `Beautiful garden plants - ${prompt}`,
    photographer: 'Unsplash'
  };
};

// Batch image fetching for multiple prompts
export const batchMediaSelector = async (prompts: string[], fallback?: string): Promise<MediaSelectorResult[]> => {
  console.log(`[MEDIA SELECTOR] Batch fetching ${prompts.length} images`);
  
  const promises = prompts.map(prompt => 
    mediaSelector({ prompt })
  );
  
  try {
    const results = await Promise.all(promises);
    console.log(`[MEDIA SELECTOR] Batch fetch completed: ${results.length} images`);
    return results;
  } catch (error) {
    console.error('[MEDIA SELECTOR] Batch fetch error:', error);
    // Return garden fallback results for all prompts
    return prompts.map(prompt => createGardenFallbackResult(prompt));
  }
};