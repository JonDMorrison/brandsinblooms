
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

// Platform-specific placeholder images with appropriate styles
const getPlatformPlaceholderImages = (query: string, postType: string): ImageSuggestion[] => {
  const basePhotographer = 'Sample Photographer';
  
  const platformImages = {
    instagram: [
      {
        id: 'instagram-1',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1080&h=1080&fit=crop',
        alt: `${query} - aesthetic lifestyle shot`,
      },
      {
        id: 'instagram-2',
        thumb_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=400&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=1080&h=1080&fit=crop',
        alt: `${query} - vibrant garden close-up`,
      },
      {
        id: 'instagram-3',
        thumb_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&h=1080&fit=crop',
        alt: `${query} - lifestyle gardening`,
      }
    ],
    facebook: [
      {
        id: 'facebook-1',
        thumb_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=1200&h=630&fit=crop',
        alt: `${query} - community gardening`,
      },
      {
        id: 'facebook-2',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&h=630&fit=crop',
        alt: `${query} - garden landscape`,
      },
      {
        id: 'facebook-3',
        thumb_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1200&h=630&fit=crop',
        alt: `${query} - gardening education`,
      }
    ],
    newsletter: [
      {
        id: 'newsletter-1',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1000&h=600&fit=crop',
        alt: `${query} - professional garden setup`,
      },
      {
        id: 'newsletter-2',
        thumb_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1000&h=600&fit=crop',
        alt: `${query} - seasonal gardening tips`,
      },
      {
        id: 'newsletter-3',
        thumb_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=1000&h=600&fit=crop',
        alt: `${query} - informative garden guide`,
      }
    ],
    email: [
      {
        id: 'email-1',
        thumb_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=500&fit=crop',
        alt: `${query} - clean garden product shot`,
      },
      {
        id: 'email-2',
        thumb_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop',
        alt: `${query} - simple garden tools`,
      },
      {
        id: 'email-3',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=250&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop',
        alt: `${query} - before and after garden`,
      }
    ],
    video: [
      {
        id: 'video-1',
        thumb_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1574263867128-b83ee8c8b7c0?w=1280&h=720&fit=crop',
        alt: `${query} - gardening in action`,
      },
      {
        id: 'video-2',
        thumb_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1280&h=720&fit=crop',
        alt: `${query} - tutorial process`,
      },
      {
        id: 'video-3',
        thumb_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=1280&h=720&fit=crop',
        alt: `${query} - behind the scenes gardening`,
      }
    ]
  };

  const images = platformImages[postType] || platformImages.instagram;
  
  return images.map(img => ({
    ...img,
    photographer: basePhotographer,
    unsplash_id: img.id,
    query: query
  }));
};

// Generate platform-specific image search queries
const generatePlatformQuery = (baseQuery: string, postType: string): string => {
  const platformModifiers = {
    instagram: 'aesthetic lifestyle beautiful vibrant colorful trendy',
    facebook: 'community educational informative people landscape wide',
    newsletter: 'professional seasonal informative clean organized',
    email: 'simple clean product focused before after',
    video: 'action process tutorial hands-on behind scenes'
  };

  const orientationModifiers = {
    instagram: 'square portrait',
    facebook: 'landscape wide',
    newsletter: 'landscape header',
    email: 'landscape clean',
    video: 'landscape cinematic'
  };

  const modifier = platformModifiers[postType] || platformModifiers.instagram;
  const orientation = orientationModifiers[postType] || orientationModifiers.instagram;
  
  return `${baseQuery} ${modifier} ${orientation} garden`.trim();
};

export const useImageSuggestions = (contentTaskId?: string, postType?: string) => {
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

  const fetchNewImages = async (searchQuery: string, taskId?: string, contentType?: string) => {
    setLoading(true);
    try {
      console.log(`Fetching new images for query: ${searchQuery}, type: ${contentType}`);
      
      // Generate platform-specific query
      const platformQuery = contentType ? generatePlatformQuery(searchQuery, contentType) : searchQuery;
      
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: platformQuery,
          contentTaskId: taskId 
        }
      });

      if (error) {
        console.log('Unsplash API error, using placeholders:', error.message);
        // Always use placeholders when API fails
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        toast.info(`Using sample images for ${contentType || 'content'} - add your Unsplash API key for real images`);
        return;
      }

      if (data?.images && data.images.length > 0) {
        setImages(data.images);
        setQuery(searchQuery);
        setUsingPlaceholders(false);
        toast.success(`Found ${data.images.length} ${contentType ? contentType + ' ' : ''}images for "${searchQuery}"`);
      } else {
        // Fallback to placeholders if no images returned
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        toast.info(`No images found for "${searchQuery}", using sample images`);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      
      // Fallback to platform-specific placeholder images on any error
      const placeholders = getPlatformPlaceholderImages(searchQuery, postType || 'instagram');
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      toast.info(`Using sample images for ${postType || 'content'} - connection error`);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      if (usingPlaceholders) {
        // Shuffle placeholder images with platform-specific variations
        const variations = postType ? [
          `${query} ${postType}`,
          `${query} garden ${postType}`,
          `${query} plants ${postType}`,
          `${query} horticulture ${postType}`,
          query
        ] : [
          `${query} garden`,
          `${query} plants`,
          `${query} horticulture`,
          `${query} nature`,
          query
        ];
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const shuffledPlaceholders = getPlatformPlaceholderImages(randomVariation, postType || 'instagram');
        setImages(shuffledPlaceholders);
        setQuery(randomVariation);
        toast.info('Shuffled sample images');
      } else {
        // Try variations of the current query for shuffle with platform context
        const variations = postType ? [
          `${query} ${postType}`,
          `${query} garden ${postType}`,
          `${query} plants ${postType}`,
          `${query} horticulture ${postType}`,
          query
        ] : [
          `${query} garden`,
          `${query} plants`,
          `${query} horticulture`,
          `${query} nature`,
          query
        ];
        
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        await fetchNewImages(randomVariation, contentTaskId, postType);
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
