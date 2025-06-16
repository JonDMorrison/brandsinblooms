
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

// Placeholder images to show before API key is configured
const getPlaceholderImages = (query: string): ImageSuggestion[] => [
  {
    id: 'placeholder-1',
    thumb_url: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&h=300&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=1920&h=1080&fit=crop',
    alt: `${query} - garden workspace`,
    photographer: 'Sample Photographer',
    unsplash_id: 'placeholder-1',
    query: query
  },
  {
    id: 'placeholder-2',
    thumb_url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1920&h=1080&fit=crop',
    alt: `${query} - gardening tools`,
    photographer: 'Sample Photographer',
    unsplash_id: 'placeholder-2',
    query: query
  },
  {
    id: 'placeholder-3',
    thumb_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&h=1080&fit=crop',
    alt: `${query} - garden planning`,
    photographer: 'Sample Photographer',
    unsplash_id: 'placeholder-3',
    query: query
  },
  {
    id: 'placeholder-4',
    thumb_url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&h=1080&fit=crop',
    alt: `${query} - garden design`,
    photographer: 'Sample Photographer',
    unsplash_id: 'placeholder-4',
    query: query
  },
  {
    id: 'placeholder-5',
    thumb_url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1920&h=1080&fit=crop',
    alt: `${query} - digital gardening`,
    photographer: 'Sample Photographer',
    unsplash_id: 'placeholder-5',
    query: query
  }
];

export const useImageSuggestions = (contentTaskId?: string) => {
  const [images, setImages] = useState<ImageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [usingPlaceholders, setUsingPlaceholders] = useState(false);

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
        setUsingPlaceholders(false);
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

      if (error) {
        // If API key not configured, show placeholder images
        if (error.message?.includes('Unsplash API key not configured')) {
          const placeholders = getPlaceholderImages(searchQuery);
          setImages(placeholders);
          setQuery(searchQuery);
          setUsingPlaceholders(true);
          toast.info('Using sample images - add your Unsplash API key for real images');
          return;
        }
        throw error;
      }

      setImages(data.images || []);
      setQuery(searchQuery);
      setUsingPlaceholders(false);
      
      if (data.images && data.images.length > 0) {
        toast.success(`Found ${data.images.length} images for "${searchQuery}"`);
      } else {
        toast.info(`No images found for "${searchQuery}"`);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      
      // Fallback to placeholder images on any error
      const placeholders = getPlaceholderImages(searchQuery);
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      toast.info('Using sample images - add your Unsplash API key for real images');
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      if (usingPlaceholders) {
        // Shuffle placeholder images with different variations
        const variations = [
          `${query} garden`,
          `${query} plants`,
          `${query} horticulture`,
          `${query} nature`,
          query
        ];
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const shuffledPlaceholders = getPlaceholderImages(randomVariation);
        setImages(shuffledPlaceholders);
        setQuery(randomVariation);
        toast.info('Shuffled sample images');
      } else {
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
    fetchStoredImages,
    usingPlaceholders
  };
};
