
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImageAttachment } from '@/lib/contentTypes';
import { extractImageSummary } from '@/utils/imageContentSummary';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  photographer_url?: string;
  download_location?: string;
}

export const useUnsplash = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCuratedCollectionImages = useCallback(async (page = 1): Promise<ImageAttachment[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          collection: 'cfl9BkhJD2o',
          page: page,
          maxImages: 12
        }
      });

      if (error) throw error;

      const mappedImages = (data?.images || []).map((img: UnsplashImage): ImageAttachment => ({
        id: img.id,
        url: img.download_url,
        thumb: img.thumb_url,
        thumb_url: img.thumb_url, // Add for MediaSelectorSidebar compatibility
        download_url: img.download_url, // Add for MediaSelectorSidebar compatibility
        alt: img.alt || 'Garden image from curated collection',
        photographer: img.photographer,
        photographer_url: img.photographer_url || `https://unsplash.com/@${img.photographer?.toLowerCase().replace(/\s+/g, '')}`,
        download_location: img.download_location
      }));
      
      console.log('[useUnsplash] Mapped curated collection images:', mappedImages);
      return mappedImages;
    } catch (err) {
      console.error('Error fetching curated collection images:', err);
      setError('Failed to fetch curated images');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getSmartImages = useCallback(async (query: string, count = 12, useRawQuery = false): Promise<ImageAttachment[]> => {
    if (!query.trim()) return [];
    
    setLoading(true);
    setError(null);
    
    // Use raw query or create concise image summary
    const imageQuery = useRawQuery ? query : extractImageSummary(query);
    console.log('[useUnsplash] Query transformation:', { original: query, processed: imageQuery, useRawQuery });
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: imageQuery,
          rawQuery: useRawQuery,
          maxImages: count,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });

      if (error) throw error;

      const mappedImages = (data?.images || []).map((img: UnsplashImage): ImageAttachment => ({
        id: img.id,
        url: img.download_url,
        thumb: img.thumb_url,
        thumb_url: img.thumb_url,
        download_url: img.download_url,
        alt: img.alt || query,
        photographer: img.photographer,
        photographer_url: img.photographer_url || `https://unsplash.com/@${img.photographer?.toLowerCase().replace(/\s+/g, '')}`,
        download_location: img.download_location
      }));
      
      console.log('[useUnsplash] Mapped images for MediaSelectorSidebar:', mappedImages);
      return mappedImages;
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to fetch images');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchImages = useCallback(async (query: string, useRawQuery = false): Promise<ImageAttachment[]> => {
    console.log('[useUnsplash] Searching images with query:', query, 'rawQuery:', useRawQuery);
    return getSmartImages(query, 12, useRawQuery);
  }, [getSmartImages]);

  const refreshImages = useCallback(async (prevQuery: string): Promise<ImageAttachment[]> => {
    console.log('[useUnsplash] Refreshing images with query:', prevQuery);
    return getSmartImages(prevQuery, 12);
  }, [getSmartImages]);

  return {
    getCuratedCollectionImages,
    getSmartImages,
    searchImages,
    refreshImages,
    loading,
    error
  };
};
