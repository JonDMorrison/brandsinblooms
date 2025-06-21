
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

// Reliable placeholder images using Lorem Picsum (no API key required)
const getPlatformPlaceholderImages = (query: string, postType: string): ImageSuggestion[] => {
  const basePhotographer = 'Lorem Picsum';
  
  // Generate consistent seed based on query for reproducible images
  const seed = query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const platformImages = {
    instagram: [
      {
        id: `instagram-1-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 1}/400/400`,
        download_url: `https://picsum.photos/seed/${seed + 1}/1080/1080`,
        alt: `${query} - aesthetic square image`,
      },
      {
        id: `instagram-2-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 2}/400/400`,
        download_url: `https://picsum.photos/seed/${seed + 2}/1080/1080`,
        alt: `${query} - vibrant square composition`,
      },
      {
        id: `instagram-3-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 3}/400/400`,
        download_url: `https://picsum.photos/seed/${seed + 3}/1080/1080`,
        alt: `${query} - lifestyle square shot`,
      }
    ],
    facebook: [
      {
        id: `facebook-1-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 4}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 4}/1200/630`,
        alt: `${query} - landscape format`,
      },
      {
        id: `facebook-2-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 5}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 5}/1200/630`,
        alt: `${query} - wide composition`,
      },
      {
        id: `facebook-3-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 6}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 6}/1200/630`,
        alt: `${query} - community style`,
      }
    ],
    newsletter: [
      {
        id: `newsletter-1-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 7}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 7}/1000/600`,
        alt: `${query} - newsletter header`,
      },
      {
        id: `newsletter-2-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 8}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 8}/1000/600`,
        alt: `${query} - professional layout`,
      },
      {
        id: `newsletter-3-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 9}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 9}/1000/600`,
        alt: `${query} - informative design`,
      }
    ],
    email: [
      {
        id: `email-1-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 10}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 10}/800/500`,
        alt: `${query} - email friendly`,
      },
      {
        id: `email-2-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 11}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 11}/800/500`,
        alt: `${query} - clean design`,
      },
      {
        id: `email-3-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 12}/400/250`,
        download_url: `https://picsum.photos/seed/${seed + 12}/800/500`,
        alt: `${query} - simple layout`,
      }
    ],
    video: [
      {
        id: `video-1-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 13}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 13}/1280/720`,
        alt: `${query} - video thumbnail`,
      },
      {
        id: `video-2-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 14}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 14}/1280/720`,
        alt: `${query} - cinematic style`,
      },
      {
        id: `video-3-${seed}`,
        thumb_url: `https://picsum.photos/seed/${seed + 15}/400/300`,
        download_url: `https://picsum.photos/seed/${seed + 15}/1280/720`,
        alt: `${query} - video format`,
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

// Improved platform-specific image search queries that prioritize content relevance
const generatePlatformQuery = (baseQuery: string, postType: string): string => {
  console.log('[IMAGE_HOOK] Generating platform query for:', baseQuery, 'type:', postType);
  
  // Don't modify content-rich queries - preserve the content meaning
  if (!baseQuery || baseQuery.length < 3) {
    const fallbackQueries = {
      instagram: 'aesthetic lifestyle beautiful',
      facebook: 'community social people',
      newsletter: 'professional business',
      email: 'simple clean modern',
      video: 'cinematic lifestyle'
    };
    const fallback = fallbackQueries[postType] || fallbackQueries.instagram;
    console.log('[IMAGE_HOOK] Using fallback query:', fallback);
    return fallback;
  }

  const contentKeywords = baseQuery.toLowerCase();
  
  // Detect specific content types for better matching
  const isFoodRelated = /\b(ice cream|cream|food|dessert|treat|sweet|flavor|taste|eat|drink|recipe|cooking|baking|chocolate|vanilla|strawberry|frozen|dairy|milkshake|sundae|cone|scoop|gelato|sorbet)\b/i.test(contentKeywords);
  const isProductRelated = /\b(product|brand|business|service|sale|shop|store|buy|purchase)\b/i.test(contentKeywords);
  const isEventRelated = /\b(event|party|celebration|holiday|festival|gathering|month|day|national)\b/i.test(contentKeywords);
  const isGardenRelated = /\b(plant|garden|flower|tree|seed|soil|grow|bloom|harvest|outdoor|nature|herb|vegetable|farming|agriculture)\b/i.test(contentKeywords);
  
  console.log('[IMAGE_HOOK] Content analysis - Food:', isFoodRelated, 'Product:', isProductRelated, 'Event:', isEventRelated, 'Garden:', isGardenRelated);
  
  let enhancedQuery = baseQuery;
  
  // Only add platform-specific enhancements if they won't dilute the content meaning
  if (postType === 'instagram' && !isFoodRelated) {
    // For Instagram, only add aesthetic terms for non-food content
    if (isGardenRelated) {
      enhancedQuery += ' aesthetic garden';
    } else if (!isProductRelated && !isEventRelated) {
      enhancedQuery += ' beautiful photography';
    }
  } else if (postType === 'facebook' && !isFoodRelated) {
    // For Facebook, only add community terms for non-food content
    if (isEventRelated) {
      enhancedQuery += ' community celebration';
    } else if (isGardenRelated) {
      enhancedQuery += ' garden community';
    }
  }
  
  const finalQuery = enhancedQuery.trim();
  console.log('[IMAGE_HOOK] Final enhanced query:', finalQuery);
  return finalQuery;
};

export const useImageSuggestions = (contentTaskId?: string, postType?: string) => {
  const [images, setImages] = useState<ImageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [usingPlaceholders, setUsingPlaceholders] = useState(false);
  const [hasStoredImages, setHasStoredImages] = useState(false);

  const fetchStoredImages = async (taskId: string) => {
    try {
      console.log('[IMAGE_HOOK] Checking for stored images for task:', taskId);
      const { data, error } = await supabase
        .from('image_suggestions')
        .select('*')
        .eq('content_task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[IMAGE_HOOK] Error fetching stored images:', error);
        return false;
      }

      if (data && data.length > 0) {
        console.log('[IMAGE_HOOK] Found', data.length, 'stored images - using cached images');
        setImages(data);
        setQuery(data[0].query);
        setUsingPlaceholders(false);
        setHasStoredImages(true);
        return true;
      }
      
      console.log('[IMAGE_HOOK] No stored images found');
      setHasStoredImages(false);
      return false;
    } catch (error) {
      console.error('[IMAGE_HOOK] Exception fetching stored images:', error);
      return false;
    }
  };

  const fetchNewImages = async (searchQuery: string, taskId?: string, contentType?: string) => {
    setLoading(true);
    console.log('[IMAGE_HOOK] Fetching NEW images for query:', searchQuery, 'type:', contentType);
    
    try {
      // Generate platform-specific query with improved logic
      const platformQuery = contentType ? generatePlatformQuery(searchQuery, contentType) : searchQuery;
      console.log('[IMAGE_HOOK] Enhanced platform query:', platformQuery);
      
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: platformQuery,
          contentTaskId: taskId 
        }
      });

      if (error) {
        console.log('[IMAGE_HOOK] Unsplash API error, using placeholders:', error.message);
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`Using sample images - Unsplash API unavailable`);
        return;
      }

      if (data?.images && data.images.length > 0) {
        console.log('[IMAGE_HOOK] Successfully fetched', data.images.length, 'real images');
        setImages(data.images);
        setQuery(searchQuery);
        setUsingPlaceholders(false);
        setHasStoredImages(true);
        toast.success(`Found ${data.images.length} new images for "${searchQuery}"`);
      } else {
        console.log('[IMAGE_HOOK] No images returned, using placeholders');
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`No images found for "${searchQuery}", using sample images`);
      }
    } catch (error) {
      console.error('[IMAGE_HOOK] Error fetching images:', error);
      
      const placeholders = getPlatformPlaceholderImages(searchQuery, postType || 'instagram');
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      setHasStoredImages(false);
      toast.info(`Using sample images - connection error`);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      console.log('[IMAGE_HOOK] User requested to shuffle/refresh images for query:', query);
      const variations = postType ? [
        `${query} ${postType}`,
        `${query} beautiful`,
        `${query} aesthetic`,
        `${query} professional`,
        query
      ] : [
        `${query} beautiful`,
        `${query} aesthetic`,
        `${query} professional`,
        `${query} lifestyle`,
        query
      ];
      
      const randomVariation = variations[Math.floor(Math.random() * variations.length)];
      await fetchNewImages(randomVariation, contentTaskId, postType);
    }
  };

  // Only load stored images on mount - don't auto-generate
  useEffect(() => {
    if (contentTaskId) {
      console.log('[IMAGE_HOOK] Component mounted with task ID:', contentTaskId, '- checking for stored images only');
      fetchStoredImages(contentTaskId);
    }
  }, [contentTaskId]);

  return {
    images,
    loading,
    query,
    hasStoredImages,
    fetchNewImages,
    shuffleImages,
    fetchStoredImages,
    usingPlaceholders
  };
};
