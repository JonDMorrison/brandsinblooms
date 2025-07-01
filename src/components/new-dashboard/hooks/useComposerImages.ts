
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
    }
  }, [selectedDraft]);

  const fetchImagesForDraft = async () => {
    if (!selectedDraft?.ai_output) {
      console.log('[COMPOSER] No content to extract keywords from');
      return;
    }
    
    setImagesFetching(true);
    setImageError(null);
    
    try {
      const keywords = extractKeywords(selectedDraft.ai_output, 'garden center plants');
      console.log('[COMPOSER] Extracted keywords for images:', keywords);
      
      let query = keywords;
      
      if (!query.toLowerCase().includes('garden') && !query.toLowerCase().includes('plant') && !query.toLowerCase().includes('nursery')) {
        query = `${keywords} garden center`;
      }
      
      console.log('[COMPOSER] Final garden center query:', query);
      
      const fetchedImages = await getSmartImages(query);
      console.log('[COMPOSER] Fetched images:', fetchedImages.length);
      setImages(fetchedImages);
      
      if (fetchedImages.length > 0) {
        setSelectedImageId(fetchedImages[0].id);
        console.log('[COMPOSER] Auto-selected first image:', fetchedImages[0].id);
      } else {
        console.warn('[COMPOSER] No images returned, trying fallback');
        const fallbackQuery = `${selectedDraft.post_type || 'gardening'} garden center plants`;
        const fallbackImages = await getSmartImages(fallbackQuery);
        
        if (fallbackImages.length > 0) {
          setImages(fallbackImages);
          setSelectedImageId(fallbackImages[0].id);
        } else {
          setImageError('No relevant garden center images found');
        }
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
      const keywords = extractKeywords(selectedDraft.ai_output, 'garden center plants');
      let query = keywords;
      
      if (!query.toLowerCase().includes('garden') && !query.toLowerCase().includes('plant') && !query.toLowerCase().includes('nursery')) {
        query = `${keywords} garden center`;
      }
      
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
      let enhancedQuery = query;
      if (!query.toLowerCase().includes('garden') && !query.toLowerCase().includes('plant') && !query.toLowerCase().includes('nursery')) {
        enhancedQuery = `${query} garden center`;
      }
      
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
    handleImageSelect,
    handleImageRefresh,
    handleImageSearch,
    getSelectedImage
  };
};
