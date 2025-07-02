/**
 * Curated garden center fallback images and improved placeholder system
 * Replaces random Lorem Picsum with relevant, high-quality garden center images
 */

interface FallbackImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  category: string;
}

// Curated garden center fallback images from Unsplash (using photo IDs for consistency)
const GARDEN_CENTER_FALLBACKS: FallbackImage[] = [
  {
    id: 'plants-colorful-display',
    thumb_url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=400&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1200&h=800&fit=crop',
    alt: 'Beautiful colorful flowers in garden center display',
    photographer: 'Unsplash',
    category: 'plants'
  },
  {
    id: 'greenhouse-plants',
    thumb_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&h=400&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1200&h=800&fit=crop',
    alt: 'Greenhouse interior with rows of potted plants',
    photographer: 'Unsplash',
    category: 'greenhouse'
  },
  {
    id: 'garden-tools',
    thumb_url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&h=400&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1200&h=800&fit=crop',
    alt: 'Professional gardening tools and equipment',
    photographer: 'Unsplash',
    category: 'tools'
  },
  {
    id: 'herb-garden',
    thumb_url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=400&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop',
    alt: 'Fresh herbs and vegetables in garden center',
    photographer: 'Unsplash',
    category: 'herbs'
  },
  {
    id: 'landscape-garden',
    thumb_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=400&fit=crop',
    download_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=800&fit=crop',
    alt: 'Beautiful landscape garden with trees and plants',
    photographer: 'Unsplash',
    category: 'landscape'
  }
];

/**
 * Get relevant fallback images based on query content
 */
export const getRelevantFallbacks = (query: string, count = 4): FallbackImage[] => {
  console.log('[FALLBACKS] Getting relevant fallbacks for query:', query);
  
  const lowerQuery = query.toLowerCase();
  
  // Categorize query to get most relevant images first
  const queryCategories = {
    plants: /\b(plant|flower|bloom|seed|colorful|display|nursery)\b/i,
    greenhouse: /\b(greenhouse|indoor|interior|potted|container)\b/i,
    tools: /\b(tool|equipment|shovel|rake|gardening|supplies)\b/i,
    herbs: /\b(herb|vegetable|organic|fresh|edible|food)\b/i,
    landscape: /\b(landscape|garden|outdoor|tree|design|nature)\b/i
  };
  
  // Find best matching categories
  const matches = Object.entries(queryCategories)
    .filter(([_, regex]) => regex.test(lowerQuery))
    .map(([category]) => category);
  
  console.log('[FALLBACKS] Matching categories:', matches);
  
  // Get images starting with most relevant categories
  let selectedImages: FallbackImage[] = [];
  
  // First, add images from matching categories
  for (const category of matches) {
    const categoryImages = GARDEN_CENTER_FALLBACKS.filter(img => img.category === category);
    selectedImages.push(...categoryImages);
  }
  
  // Fill remaining slots with other garden center images
  const remainingImages = GARDEN_CENTER_FALLBACKS.filter(
    img => !selectedImages.find(selected => selected.id === img.id)
  );
  selectedImages.push(...remainingImages);
  
  // Return exactly the requested count, shuffled for variety
  const result = selectedImages.slice(0, count);
  console.log('[FALLBACKS] Selected fallback images:', result.map(img => ({ id: img.id, category: img.category })));
  
  return result;
};

/**
 * Convert fallback images to the expected format
 */
export const formatFallbackImages = (fallbacks: FallbackImage[], query: string) => {
  return fallbacks.map(img => ({
    id: `fallback-${img.id}`,
    thumb_url: img.thumb_url,
    download_url: img.download_url,
    alt: `${img.alt} - ${query}`,
    photographer: img.photographer,
    unsplash_id: img.id,
    query: query
  }));
};

/**
 * Check if Unsplash API is available by testing a simple request
 */
export const checkUnsplashAvailability = async (): Promise<boolean> => {
  try {
    // Test with a minimal request to the single image endpoint
    const response = await fetch('/api/unsplash-test', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    return response.ok;
  } catch (error) {
    console.log('[FALLBACKS] Unsplash API test failed:', error);
    return false;
  }
};