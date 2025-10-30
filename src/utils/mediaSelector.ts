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

    console.warn('[MEDIA SELECTOR] Content-specific image failed, using placeholder (red roses collection disabled)');
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

// Sequential batch image fetching for multiple prompts
export const batchMediaSelector = async (prompts: string[], fallback?: string): Promise<MediaSelectorResult[]> => {
  console.log(`[MEDIA SELECTOR] Sequential batch fetching ${prompts.length} images`);
  
  const results: MediaSelectorResult[] = [];
  
  try {
    // Process images one by one to prevent flashing
    for (let i = 0; i < prompts.length; i++) {
      console.log(`[MEDIA SELECTOR] Processing image ${i + 1}/${prompts.length}: ${prompts[i]}`);
      
      try {
        const result = await mediaSelector({ prompt: prompts[i] });
        results.push(result);
        
        // Small delay between images to prevent overwhelming the UI
        if (i < prompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`[MEDIA SELECTOR] Failed to fetch image for "${prompts[i]}":`, error);
        results.push(createGardenFallbackResult(prompts[i]));
      }
    }
    
    console.log(`[MEDIA SELECTOR] Sequential batch completed: ${results.length} images`);
    return results;
  } catch (error) {
    console.error('[MEDIA SELECTOR] Sequential batch error:', error);
    // Return garden fallback results for all prompts
    return prompts.map(prompt => createGardenFallbackResult(prompt));
  }
};