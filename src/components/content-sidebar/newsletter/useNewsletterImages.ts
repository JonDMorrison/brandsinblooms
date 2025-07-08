
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

export const useNewsletterImages = (
  blocks: NewsletterBlock[],
  isPlaceholderContent: boolean,
  contentTaskId?: string
) => {
  const [images, setImages] = useState<Record<number, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isPlaceholderContent) {
      console.log('[NEWSLETTER] Skipping image fetch - placeholder content detected');
      return;
    }
    
    if (!blocks.length) {
      console.log('[NEWSLETTER] Skipping image fetch - no valid blocks');
      return;
    }
    
    // Check if we already have all the images we need
    const existingImageCount = Object.keys(images).length;
    if (existingImageCount >= blocks.length) {
      console.log('[NEWSLETTER] Already have sufficient images, skipping fetch');
      return;
    }
    
    setLoadingImages(true);
    setImageErrors({});
    console.log('[NEWSLETTER] Starting optimized image fetch for', blocks.length, 'blocks with', existingImageCount, 'existing images');
    
    const fetchImages = async () => {
      const imagePromises = blocks.map(async (block, index) => {
        if (!block.image_prompt) {
          console.log('[NEWSLETTER] Block', index, 'has no image prompt, skipping');
          return null;
        }
        
        try {
          console.log('[NEWSLETTER] Fetching image for block', index, 'with prompt:', block.image_prompt);
          
          const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              query: block.image_prompt,
              contentType: 'newsletter',
              maxImages: 1, // Only fetch 1 image per block for efficiency
              orientation: 'landscape'
            }
          });
          
          if (error) {
            console.error('[NEWSLETTER] Supabase function error for block', index, ':', error);
            setImageErrors(prev => ({ ...prev, [index]: error.message || 'Function call failed' }));
            return null;
          }
          
          if (data?.images?.[0]) {
            console.log('[NEWSLETTER] Successfully fetched image for block', index);
            return {
              index,
              image: {
                url: data.images[0].thumb_url,
                alt: data.images[0].alt || block.alt_text || block.title,
                photographer: data.images[0].photographer
              }
            };
          } else {
            console.warn('[NEWSLETTER] No images in response for block', index);
            setImageErrors(prev => ({ ...prev, [index]: 'No images found for query' }));
            return null;
          }
        } catch (error) {
          console.error('[NEWSLETTER] Exception fetching image for block', index, ':', error);
          setImageErrors(prev => ({ ...prev, [index]: error.message || 'Network error' }));
          return null;
        }
      });

      try {
        const results = await Promise.all(imagePromises);
        const imageMap: Record<number, ImageData> = {};
        
        results.forEach(result => {
          if (result) {
            imageMap[result.index] = result.image;
          }
        });
        
        console.log('[NEWSLETTER] Final image map:', imageMap);
        setImages(imageMap);
      } catch (error) {
        console.error('[NEWSLETTER] Error in Promise.all:', error);
      } finally {
        setLoadingImages(false);
      }
    };

    fetchImages();
  }, [blocks, isPlaceholderContent, contentTaskId, images]); // Added images dependency for optimization

  return {
    images,
    loadingImages,
    imageErrors
  };
};
