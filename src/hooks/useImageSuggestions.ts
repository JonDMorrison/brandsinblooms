
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageSuggestion {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  unsplash_id: string;
  query: string;
}

export const useImageSuggestions = (contentTaskId?: string) => {
  const [images, setImages] = useState<ImageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const fetchStoredImages = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('image_suggestions')
        .select('*')
        .eq('content_task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setImages(data);
        setQuery(data[0].query);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error fetching stored images:', error);
      return false;
    }
  };

  const fetchNewImages = async (searchQuery: string, taskId?: string) => {
    setLoading(true);
    try {
      console.log(`Fetching new images for query: ${searchQuery}`);
      
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: searchQuery,
          contentTaskId: taskId 
        }
      });

      if (error) throw error;

      setImages(data.images || []);
      setQuery(searchQuery);
      
      if (data.images && data.images.length > 0) {
        toast.success(`Found ${data.images.length} images for "${searchQuery}"`);
      } else {
        toast.info(`No images found for "${searchQuery}"`);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to fetch images');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      // Try variations of the current query for shuffle
      const variations = [
        `${query} garden`,
        `${query} plants`,
        `${query} horticulture`,
        `${query} nature`,
        query // fallback to original
      ];
      
      const randomVariation = variations[Math.floor(Math.random() * variations.length)];
      await fetchNewImages(randomVariation, contentTaskId);
    }
  };

  useEffect(() => {
    if (contentTaskId) {
      fetchStoredImages(contentTaskId);
    }
  }, [contentTaskId]);

  return {
    images,
    loading,
    query,
    fetchNewImages,
    shuffleImages,
    fetchStoredImages
  };
};
