
import { useState, useEffect } from 'react';
import { useUnsplash } from '@/hooks/useUnsplash';
import { ImageAttachment } from '@/lib/contentTypes';
import { extractKeywords } from '@/utils/imageKeywords';

export const useComposerImages = (selectedDraft: any) => {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [postWithoutImage, setPostWithoutImage] = useState(false);
  const [imagesFetching, setImagesFetching] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  const { getSmartImages, searchImages, refreshImages, loading: imagesLoading } = useUnsplash();

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      console.log('[COMPOSER] Selected draft changed:', selectedDraft.id, selectedDraft.post_type);
      setImageError(null);
      
      if (selectedDraft.attachments?.image) {
        console.log('[COMPOSER] Found existing image attachment');
        const existingImage = selectedDraft.attachments.image;
        setImages([existingImage]);
        setSelectedImageId(existingImage.id);
      } else {
        console.log('[COMPOSER] No existing image, fetching new ones');
        fetchImagesForDraft();
      }
    } else {
      console.log('[COMPOSER] No draft or content, clearing images');
      setImages([]);
      setSelectedImageId(null);
      setImageError(null);
      setCurrentQuery('');
    }
  }, [selectedDraft]);

  const buildSmartQuery = (content: string, postType?: string): string[] => {
    // Get the main keywords from content
    const mainQuery = extractKeywords(content, 'garden center plants');
    
    // Build fallback queries based on content analysis
    const fallbackQueries = [];
    
    // If the main query contains specific plants, create targeted fallbacks
    if (/tomato|tomatoes/i.test(mainQuery)) {
      fallbackQueries.push('tomato plants vegetable garden summer');
      fallbackQueries.push('tomato growing garden care');
    } else if (/pepper|peppers/i.test(mainQuery)) {
      fallbackQueries.push('pepper plants vegetable garden');
      fallbackQueries.push('bell pepper garden growing');
    } else if (/cucumber|zucchini/i.test(mainQuery)) {
      fallbackQueries.push('cucumber zucchini vegetable garden');
      fallbackQueries.push('summer vegetables garden');
    }
    
    // Add seasonal fallbacks if context suggests it
    if (/summer|heat|hot/i.test(content)) {
      fallbackQueries.push('summer vegetable garden heat');
      fallbackQueries.push('garden plants summer care');
    }
    
    // Add general post-type specific fallbacks
    if (postType) {
      const postTypeFallbacks = {
        instagram: 'beautiful vegetable garden social media',
        facebook: 'home garden community vegetables',
        newsletter: 'professional garden center vegetables',
        email: 'garden tips vegetables growing'
      };
      
      if (postTypeFallbacks[postType]) {
        fallbackQueries.push(postTypeFallbacks[postType]);
      }
    }
    
    // Add final fallback
    fallbackQueries.push('garden center vegetable plants');
    fallbackQueries.push('garden center plants nursery');
    
    return [mainQuery, ...fallbackQueries];
  };

  const fetchImagesForDraft = async () => {
    if (!selectedDraft?.ai_output) {
      console.log('[COMPOSER] No content to extract keywords from');
      return;
    }
    
    setImagesFetching(true);
    setImageError(null);
    
    try {
      const queries = buildSmartQuery(selectedDraft.ai_output, selectedDraft.post_type);
      console.log('[COMPOSER] Built smart queries:', queries);
      
      let fetchedImages: ImageAttachment[] = [];
      let usedQuery = '';
      
      // Try each query until we get good results
      for (const query of queries) {
        console.log(`[COMPOSER] Trying query: "${query}"`);
        setCurrentQuery(query);
        
        try {
          const images = await getSmartImages(query);
          console.log(`[COMPOSER] Query "${query}" returned ${images.length} images`);
          
          if (images.length > 0) {
            fetchedImages = images;
            usedQuery = query;
            break;
          }
        } catch (error) {
          console.warn(`[COMPOSER] Query "${query}" failed:`, error);
          continue;
        }
      }
      
      if (fetchedImages.length > 0) {
        console.log(`[COMPOSER] Successfully fetched ${fetchedImages.length} images using query: "${usedQuery}"`);
        setImages(fetchedImages);
        setSelectedImageId(fetchedImages[0].id);
        setCurrentQuery(usedQuery);
      } else {
        console.warn('[COMPOSER] No images returned from any query');
        setImageError('No relevant images found for this content');
        setImages([]);
      }
      
    } catch (error) {
      console.error('[COMPOSER] Error fetching images:', error);
      setImageError('Failed to load images');
      setImages([]);
    } finally {
      setImagesFetching(false);
    }
  };

  const handleImageSelect = (imageId: string) => {
    console.log('[COMPOSER] Image selected:', imageId);
    setSelectedImageId(imageId);
    setPostWithoutImage(false);
  };

  const handleImageRefresh = async () => {
    if (!selectedDraft?.ai_output) return;
    
    console.log('[COMPOSER] Refreshing images');
    setImagesFetching(true);
    setImageError(null);
    
    try {
      const queries = buildSmartQuery(selectedDraft.ai_output, selectedDraft.post_type);
      
      // Try the first query for refresh
      const query = queries[0];
      setCurrentQuery(query);
      
      const newImages = await refreshImages(query);
      console.log('[COMPOSER] Refreshed images:', newImages.length);
      setImages(newImages);
      setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
    } catch (error) {
      console.error('[COMPOSER] Error refreshing images:', error);
      setImageError('Failed to refresh images');
    } finally {
      setImagesFetching(false);
    }
  };

  const handleImageSearch = async (query: string) => {
    console.log('[COMPOSER] Searching images for:', query);
    setImagesFetching(true);
    setImageError(null);
    
    try {
      // Enhance user query with context if needed
      let enhancedQuery = query;
      if (!query.toLowerCase().includes('garden') && 
          !query.toLowerCase().includes('plant') && 
          !query.toLowerCase().includes('vegetable') &&
          !query.toLowerCase().includes('flower')) {
        enhancedQuery = `${query} garden plants`;
      }
      
      setCurrentQuery(enhancedQuery);
      const searchResults = await searchImages(enhancedQuery);
      console.log('[COMPOSER] Search results:', searchResults.length);
      setImages(searchResults);
      setSelectedImageId(searchResults.length > 0 ? searchResults[0].id : null);
    } catch (error) {
      console.error('[COMPOSER] Error searching images:', error);
      setImageError('Failed to search images');
    } finally {
      setImagesFetching(false);
    }
  };

  const getSelectedImage = (): ImageAttachment | null => {
    return images.find(img => img.id === selectedImageId) || null;
  };

  return {
    images,
    selectedImageId,
    postWithoutImage,
    setPostWithoutImage,
    imagesFetching,
    imageError,
    imagesLoading,
    currentQuery,
    handleImageSelect,
    handleImageRefresh,
    handleImageSearch,
    getSelectedImage
  };
};
