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
  const { prompt, fallback = '/images/newsletter-fallback.jpg', count = 1 } = options;
  
  console.log(`[MEDIA SELECTOR] Fetching image for prompt: "${prompt}"`);
  
  try {
    // Use the existing Unsplash integration via Supabase edge function
    const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
      body: { 
        query: prompt,
        maxImages: count,
        orientation: 'squarish',
        orderBy: 'relevant',
        contentFilter: 'high'
      }
    });

    if (error) {
      console.warn('[MEDIA SELECTOR] Unsplash fetch error:', error);
      return createFallbackResult(fallback, prompt);
    }

    const images = data?.images || [];
    if (images.length > 0) {
      const selectedImage = images[0];
      console.log(`[MEDIA SELECTOR] Selected image:`, selectedImage.id);
      
      return {
        url: selectedImage.download_url,
        thumb: selectedImage.thumb_url,
        alt: selectedImage.alt || prompt,
        photographer: selectedImage.photographer
      };
    }

    console.warn('[MEDIA SELECTOR] No images returned from Unsplash');
    return createFallbackResult(fallback, prompt);
    
  } catch (error) {
    console.error('[MEDIA SELECTOR] Error fetching image:', error);
    return createFallbackResult(fallback, prompt);
  }
};

const createFallbackResult = (fallback: string, prompt: string): MediaSelectorResult => {
  return {
    url: fallback,
    alt: `Fallback image for ${prompt}`,
    photographer: 'Placeholder'
  };
};

// Batch image fetching for multiple prompts
export const batchMediaSelector = async (prompts: string[], fallback?: string): Promise<MediaSelectorResult[]> => {
  console.log(`[MEDIA SELECTOR] Batch fetching ${prompts.length} images`);
  
  const promises = prompts.map(prompt => 
    mediaSelector({ prompt, fallback })
  );
  
  try {
    const results = await Promise.all(promises);
    console.log(`[MEDIA SELECTOR] Batch fetch completed: ${results.length} images`);
    return results;
  } catch (error) {
    console.error('[MEDIA SELECTOR] Batch fetch error:', error);
    // Return fallback results for all prompts
    return prompts.map(prompt => createFallbackResult(fallback || '/images/newsletter-fallback.jpg', prompt));
  }
};