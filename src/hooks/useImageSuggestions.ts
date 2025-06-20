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

// Enhanced platform-specific placeholder images with Wikipedia Commons and diverse garden themes
const getPlatformPlaceholderImages = (query: string, postType: string): ImageSuggestion[] => {
  const basePhotographer = 'Public Domain / Wikimedia Commons';
  
  // Expanded garden-themed image collection with Wikipedia Commons URLs
  const gardenImageSets = {
    spring: [
      {
        id: 'spring-1',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Daffodils_in_spring.jpg/400px-Daffodils_in_spring.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Daffodils_in_spring.jpg',
        alt: 'Spring daffodils blooming in garden',
      },
      {
        id: 'spring-2',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Tulip_garden_spring.jpg/400px-Tulip_garden_spring.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Tulip_garden_spring.jpg',
        alt: 'Colorful tulip garden in spring',
      },
      {
        id: 'spring-3',
        thumb_url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1000&h=750&fit=crop',
        alt: 'Fresh spring seedlings and plantings',
      }
    ],
    summer: [
      {
        id: 'summer-1',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Sunflower_field_summer.jpg/400px-Sunflower_field_summer.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Sunflower_field_summer.jpg',
        alt: 'Bright sunflower field in summer',
      },
      {
        id: 'summer-2',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1000&h=750&fit=crop',
        alt: 'Lush summer garden landscape',
      },
      {
        id: 'summer-3',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Vegetable_garden_summer.jpg/400px-Vegetable_garden_summer.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Vegetable_garden_summer.jpg',
        alt: 'Productive summer vegetable garden',
      }
    ],
    autumn: [
      {
        id: 'autumn-1',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Autumn_harvest_vegetables.jpg/400px-Autumn_harvest_vegetables.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Autumn_harvest_vegetables.jpg',
        alt: 'Autumn harvest of fresh vegetables',
      },
      {
        id: 'autumn-2',
        thumb_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&h=750&fit=crop',
        alt: 'Beautiful autumn garden with fall colors',
      },
      {
        id: 'autumn-3',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Pumpkin_patch_autumn.jpg/400px-Pumpkin_patch_autumn.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Pumpkin_patch_autumn.jpg',
        alt: 'Autumn pumpkin patch ready for harvest',
      }
    ],
    winter: [
      {
        id: 'winter-1',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Winter_garden_greenhouse.jpg/400px-Winter_garden_greenhouse.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Winter_garden_greenhouse.jpg',
        alt: 'Winter garden greenhouse with plants',
      },
      {
        id: 'winter-2',
        thumb_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1000&h=750&fit=crop',
        alt: 'Indoor winter garden with houseplants',
      },
      {
        id: 'winter-3',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Winter_garden_planning.jpg/400px-Winter_garden_planning.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Winter_garden_planning.jpg',
        alt: 'Winter garden planning and preparation',
      }
    ],
    tools: [
      {
        id: 'tools-1',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Garden_tools_collection.jpg/400px-Garden_tools_collection.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Garden_tools_collection.jpg',
        alt: 'Collection of essential garden tools',
      },
      {
        id: 'tools-2',
        thumb_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
        download_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1000&h=750&fit=crop',
        alt: 'Professional gardening tools in use',
      },
      {
        id: 'tools-3',
        thumb_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Watering_can_garden.jpg/400px-Watering_can_garden.jpg',
        download_url: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Watering_can_garden.jpg',
        alt: 'Classic watering can for garden care',
      }
    ]
  };

  // Determine current season
  const currentMonth = new Date().getMonth() + 1;
  let currentSeason: keyof typeof gardenImageSets;
  
  if (currentMonth >= 3 && currentMonth <= 5) {
    currentSeason = 'spring';
  } else if (currentMonth >= 6 && currentMonth <= 8) {
    currentSeason = 'summer';
  } else if (currentMonth >= 9 && currentMonth <= 11) {
    currentSeason = 'autumn';
  } else {
    currentSeason = 'winter';
  }

  // Select appropriate image set based on query and season
  let selectedImageSet;
  if (query.toLowerCase().includes('tool') || query.toLowerCase().includes('equipment')) {
    selectedImageSet = gardenImageSets.tools;
  } else if (query.toLowerCase().includes('spring') || query.toLowerCase().includes('plant')) {
    selectedImageSet = gardenImageSets.spring;
  } else if (query.toLowerCase().includes('summer') || query.toLowerCase().includes('sun')) {
    selectedImageSet = gardenImageSets.summer;
  } else if (query.toLowerCase().includes('autumn') || query.toLowerCase().includes('fall') || query.toLowerCase().includes('harvest')) {
    selectedImageSet = gardenImageSets.autumn;
  } else if (query.toLowerCase().includes('winter') || query.toLowerCase().includes('indoor')) {
    selectedImageSet = gardenImageSets.winter;
  } else {
    // Default to current season
    selectedImageSet = gardenImageSets[currentSeason];
  }

  // Adjust image dimensions based on platform
  const platformImages = selectedImageSet.map(img => {
    let adjustedImg = { ...img };
    
    switch (postType) {
      case 'instagram':
        adjustedImg.thumb_url = adjustedImg.thumb_url.replace(/w=400&h=300/, 'w=400&h=400');
        adjustedImg.download_url = adjustedImg.download_url.replace(/w=1000&h=750/, 'w=1080&h=1080');
        break;
      case 'facebook':
        adjustedImg.thumb_url = adjustedImg.thumb_url.replace(/w=400&h=300/, 'w=400&h=210');
        adjustedImg.download_url = adjustedImg.download_url.replace(/w=1000&h=750/, 'w=1200&h=630');
        break;
      case 'newsletter':
        adjustedImg.thumb_url = adjustedImg.thumb_url.replace(/w=400&h=300/, 'w=400&h=250');
        adjustedImg.download_url = adjustedImg.download_url.replace(/w=1000&h=750/, 'w=1000&h=600');
        break;
      default:
        // Keep original dimensions
        break;
    }
    
    return {
      ...adjustedImg,
      photographer: basePhotographer,
      unsplash_id: adjustedImg.id,
      query: query,
      alt: `${adjustedImg.alt} - ${query}`
    };
  });

  return platformImages;
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
        console.log('Unsplash API error, using enhanced placeholders:', error.message);
        // Use enhanced placeholders when API fails
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        toast.info(`Using sample garden images - add your Unsplash API key for more variety`, {
          description: 'Currently showing curated garden images from public sources'
        });
        return;
      }

      if (data?.images && data.images.length > 0) {
        setImages(data.images);
        setQuery(searchQuery);
        setUsingPlaceholders(false);
        toast.success(`Found ${data.images.length} ${contentType ? contentType + ' ' : ''}images for "${searchQuery}"`);
      } else {
        // Fallback to enhanced placeholders if no images returned
        const placeholders = getPlatformPlaceholderImages(searchQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(searchQuery);
        setUsingPlaceholders(true);
        toast.info(`No images found for "${searchQuery}", using curated garden images`);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      
      // Fallback to platform-specific placeholder images on any error
      const placeholders = getPlatformPlaceholderImages(searchQuery, postType || 'instagram');
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      toast.info(`Using sample garden images - connection issue resolved with placeholders`);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      if (usingPlaceholders) {
        // Shuffle with seasonal and topic-based variations
        const variations = [
          `${query} spring garden`,
          `${query} summer plants`,
          `${query} autumn harvest`,
          `${query} winter planning`,
          `${query} garden tools`,
          `${query} seasonal care`,
          query
        ];
        const randomVariation = variations[Math.floor(Math.random() * variations.length)];
        const shuffledPlaceholders = getPlatformPlaceholderImages(randomVariation, postType || 'instagram');
        setImages(shuffledPlaceholders);
        setQuery(randomVariation);
        toast.info('Refreshed with new garden images');
      } else {
        // Try variations of the current query for shuffle with platform context
        const variations = postType ? [
          `${query} ${postType}`,
          `${query} garden ${postType}`,
          `${query} plants ${postType}`,
          `${query} seasonal ${postType}`,
          query
        ] : [
          `${query} garden`,
          `${query} plants`,
          `${query} seasonal`,
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
