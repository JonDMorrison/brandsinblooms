
import { useState, useEffect, useRef, useMemo } from 'react';
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
  
  // Use ref to track fetch status and prevent multiple fetches
  const fetchStatusRef = useRef<{ isInProgress: boolean; lastFetchKey: string }>({
    isInProgress: false,
    lastFetchKey: ''
  });

  // Memoize the blocks key to prevent unnecessary re-renders
  const blocksKey = useMemo(() => {
    return blocks.map(b => b.image_prompt || '').join('|');
  }, [blocks]);

  useEffect(() => {
    console.log('[NEWSLETTER] useNewsletterImages effect triggered:', {
      isPlaceholderContent,
      blocksLength: blocks.length,
      contentTaskId,
      blocksKey
    });
    
    if (isPlaceholderContent) {
      console.log('[NEWSLETTER] Skipping image fetch - placeholder content detected');
      return;
    }
    
    if (!blocks.length) {
      console.log('[NEWSLETTER] Skipping image fetch - no valid blocks');
      return;
    }
    
    // Check if we're already fetching or have already fetched these blocks
    if (fetchStatusRef.current.isInProgress) {
      console.log('[NEWSLETTER] Fetch already in progress, skipping');
      return;
    }
    
    if (fetchStatusRef.current.lastFetchKey === blocksKey) {
      console.log('[NEWSLETTER] Already fetched images for these blocks, skipping');
      return;
    }
    
    const blocksWithPrompts = blocks.filter(b => b.image_prompt);
    if (blocksWithPrompts.length === 0) {
      console.log('[NEWSLETTER] No blocks with image prompts');
      return;
    }
    
    // Mark fetch as in progress and update the last fetch key
    fetchStatusRef.current.isInProgress = true;
    fetchStatusRef.current.lastFetchKey = blocksKey;
    
    setLoadingImages(true);
    setImageErrors({});
    console.log('[NEWSLETTER] Starting optimized image fetch for', blocksWithPrompts.length, 'blocks with prompts');
    
    const fetchImages = async () => {
      try {
        const imagePromises = blocksWithPrompts.map(async (block, arrayIndex) => {
          // Find the original index in the blocks array
          const originalIndex = blocks.findIndex(b => b.image_prompt === block.image_prompt);
          
          try {
            console.log('[NEWSLETTER] Fetching image for block', originalIndex, 'with prompt:', block.image_prompt);
            
            const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
              body: { 
                query: block.image_prompt,
                contentType: 'newsletter',
                maxImages: 1,
                orientation: 'landscape'
              }
            });
            
            if (error) {
              console.error('[NEWSLETTER] Supabase function error for block', originalIndex, ':', error);
              setImageErrors(prev => ({ ...prev, [originalIndex]: error.message || 'Function call failed' }));
              return null;
            }
            
            if (data?.images?.[0]) {
              console.log('[NEWSLETTER] Successfully fetched image for block', originalIndex);
              return {
                index: originalIndex,
                image: {
                  url: data.images[0].thumb_url,
                  alt: data.images[0].alt || block.alt_text || block.title,
                  photographer: data.images[0].photographer
                }
              };
            } else {
              console.warn('[NEWSLETTER] No images in response for block', originalIndex);
              setImageErrors(prev => ({ ...prev, [originalIndex]: 'No images found for query' }));
              return null;
            }
          } catch (error) {
            console.error('[NEWSLETTER] Exception fetching image for block', originalIndex, ':', error);
            setImageErrors(prev => ({ ...prev, [originalIndex]: error.message || 'Network error' }));
            return null;
          }
        });

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
        fetchStatusRef.current.isInProgress = false;
      }
    };

    fetchImages();
  }, [blocksKey, isPlaceholderContent, contentTaskId]);

  return {
    images,
    loadingImages,
    imageErrors
  };
};
