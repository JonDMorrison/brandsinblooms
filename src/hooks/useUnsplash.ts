
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
}

export const useUnsplash = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSmartImages = useCallback(async (query: string, count = 4): Promise<ImageAttachment[]> => {
    if (!query.trim()) return [];
    
    setLoading(true);
    setError(null);
    
    // Create concise image summary from the query
    const imageQuery = extractImageSummary(query);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: imageQuery,
          maxImages: count,
          orientation: 'squarish',
          orderBy: 'relevant', // Use relevant instead of popular for better quality
          contentFilter: 'high'
        }
      });

      if (error) throw error;

      return (data?.images || []).map((img: UnsplashImage): ImageAttachment => ({
        id: img.id,
        url: img.download_url,
        thumb: img.thumb_url,
        alt: img.alt || query,
        photographer: img.photographer
      }));
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to fetch images');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchImages = useCallback(async (query: string): Promise<ImageAttachment[]> => {
    return getSmartImages(query, 4);
  }, [getSmartImages]);

  const refreshImages = useCallback(async (prevQuery: string): Promise<ImageAttachment[]> => {
    return getSmartImages(prevQuery, 4);
  }, [getSmartImages]);

  return {
    getSmartImages,
    searchImages,
    refreshImages,
    loading,
    error
  };
};
