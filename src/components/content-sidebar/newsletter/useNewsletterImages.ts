
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { extractImageSummary } from '@/utils/imageContentSummary';

interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface UnstructuredSection {
  title: string;
  content: string;
  image_prompt: string;
  alt_text: string;
  id: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

// Generate smart search query for a newsletter block or section
const generateSmartSearchQuery = (
  item: NewsletterBlock | UnstructuredSection, 
  campaignTheme?: string
): string => {
  let content = '';
  
  if ('body' in item) {
    // NewsletterBlock
    content = `${item.title} ${item.body}`;
  } else {
    // UnstructuredSection
    content = `${item.title} ${item.content}`;
  }
  
  // Use extractImageSummary to get smart keywords
  const smartKeywords = extractImageSummary(content);
  
  // Add campaign context if available
  const searchQuery = campaignTheme 
    ? `${smartKeywords} ${campaignTheme} garden center`
    : `${smartKeywords} garden center`;
    
  console.log('[NEWSLETTER] Generated smart search query:', {
    title: item.title.slice(0, 50),
    smartKeywords,
    finalQuery: searchQuery
  });
  
  return searchQuery;
};

export const useNewsletterImages = (
  blocks: NewsletterBlock[],
  isPlaceholderContent: boolean,
  contentTaskId?: string,
  campaignTheme?: string,
  unstructuredSections?: UnstructuredSection[],
  featuredImagePrompt?: string
) => {
  const [images, setImages] = useState<Record<string, ImageData>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [featuredImage, setFeaturedImage] = useState<ImageData | null>(null);
  
  // Use ref to track fetch status and prevent multiple fetches
  const fetchStatusRef = useRef<{ isInProgress: boolean; lastFetchKey: string }>({
    isInProgress: false,
    lastFetchKey: ''
  });

  // Memoize the content key to prevent unnecessary re-renders
  const contentKey = useMemo(() => {
    const blocksKey = blocks.map(b => `${b.title}-${b.body}`.slice(0, 100)).join('|');
    const sectionsKey = unstructuredSections?.map(s => `${s.title}-${s.content}`.slice(0, 100)).join('|') || '';
    return `${blocksKey}${sectionsKey}`;
  }, [blocks, unstructuredSections]);

  useEffect(() => {
    console.log('[NEWSLETTER] useNewsletterImages effect triggered:', {
      isPlaceholderContent,
      blocksLength: blocks.length,
      sectionsLength: unstructuredSections?.length || 0,
      contentTaskId,
      contentKey
    });
    
    if (isPlaceholderContent) {
      console.log('[NEWSLETTER] Skipping image fetch - placeholder content detected');
      return;
    }
    
    // Check if we have content to process
    const hasStructuredContent = blocks.length > 0;
    const hasUnstructuredContent = unstructuredSections && unstructuredSections.length > 0;
    
    if (!hasStructuredContent && !hasUnstructuredContent) {
      console.log('[NEWSLETTER] Skipping image fetch - no valid content');
      return;
    }
    
    // Check if we're already fetching or have already fetched this content
    if (fetchStatusRef.current.isInProgress) {
      console.log('[NEWSLETTER] Fetch already in progress, skipping');
      return;
    }
    
    if (fetchStatusRef.current.lastFetchKey === contentKey) {
      console.log('[NEWSLETTER] Already fetched images for this content, skipping');
      return;
    }
    
    // Mark fetch as in progress and update the last fetch key
    fetchStatusRef.current.isInProgress = true;
    fetchStatusRef.current.lastFetchKey = contentKey;
    
    setLoadingImages(true);
    setImageErrors({});
    
    console.log('[NEWSLETTER] Starting image fetch for:', {
      structuredBlocks: hasStructuredContent ? blocks.length : 0,
      unstructuredSections: hasUnstructuredContent ? unstructuredSections.length : 0
    });
    
    const fetchImages = async () => {
      try {
        const imagePromises: Promise<any>[] = [];
        
        // Fetch featured image if we have a prompt
        if (featuredImagePrompt) {
          imagePromises.push(
            fetchSingleImage('featured', featuredImagePrompt, campaignTheme).then(result => ({
              ...result,
              isFeatured: true
            }))
          );
        }
        
        // Process structured blocks
        if (hasStructuredContent) {
          const blocksWithContent = blocks.filter(b => b.title || b.body);
          blocksWithContent.forEach((block, arrayIndex) => {
            const originalIndex = blocks.findIndex(b => b.title === block.title && b.body === block.body);
            const smartQuery = generateSmartSearchQuery(block, campaignTheme);
            
            imagePromises.push(
              fetchSingleImage(`block-${originalIndex}`, smartQuery, campaignTheme).then(result => ({
                ...result,
                index: originalIndex
              }))
            );
          });
        }
        
        // Process unstructured sections
        if (hasUnstructuredContent) {
          unstructuredSections.forEach((section) => {
            const smartQuery = generateSmartSearchQuery(section, campaignTheme);
            
            imagePromises.push(
              fetchSingleImage(section.id, smartQuery, campaignTheme).then(result => ({
                ...result,
                sectionId: section.id
              }))
            );
          });
        }

        const results = await Promise.all(imagePromises);
        const imageMap: Record<string, ImageData> = {};
        let newFeaturedImage: ImageData | null = null;
        
        results.forEach(result => {
          if (result && result.image) {
            if (result.isFeatured) {
              newFeaturedImage = result.image;
            } else if (result.index !== undefined) {
              // Structured block image
              imageMap[result.index] = result.image;
            } else if (result.sectionId) {
              // Unstructured section image
              imageMap[result.sectionId] = result.image;
            }
          }
        });
        
        console.log('[NEWSLETTER] Final image map:', imageMap);
        setImages(imageMap);
        
        if (newFeaturedImage) {
          setFeaturedImage(newFeaturedImage);
        }
      } catch (error) {
        console.error('[NEWSLETTER] Error in Promise.all:', error);
      } finally {
        setLoadingImages(false);
        fetchStatusRef.current.isInProgress = false;
      }
    };

    fetchImages();
  }, [contentKey, isPlaceholderContent, contentTaskId, campaignTheme, featuredImagePrompt]);

  const fetchSingleImage = async (key: string, query: string, campaignTheme?: string) => {
    try {
      console.log('[NEWSLETTER] Fetching image for', key, 'with query:', query);
      
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query,
          contentType: 'newsletter',
          maxImages: 1,
          orientation: 'landscape'
        }
      });
      
      if (error) {
        console.error('[NEWSLETTER] Supabase function error for', key, ':', error);
        setImageErrors(prev => ({ ...prev, [key]: error.message || 'Function call failed' }));
        return null;
      }
      
      if (data?.images?.[0]) {
        console.log('[NEWSLETTER] Successfully fetched image for', key);
        return {
          key,
          image: {
            url: data.images[0].thumb_url,
            alt: data.images[0].alt || query,
            photographer: data.images[0].photographer
          }
        };
      } else {
        console.warn('[NEWSLETTER] No images in response for', key);
        setImageErrors(prev => ({ ...prev, [key]: 'No images found for query' }));
        return null;
      }
    } catch (error) {
      console.error('[NEWSLETTER] Exception fetching image for', key, ':', error);
      setImageErrors(prev => ({ ...prev, [key]: error.message || 'Network error' }));
      return null;
    }
  };

  return {
    images,
    featuredImage,
    loadingImages,
    imageErrors
  };
};
