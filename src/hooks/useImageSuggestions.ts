
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getRelevantFallbacks, formatFallbackImages } from '@/services/gardenCenterFallbacks';

interface ImageSuggestion {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  unsplash_id: string;
  query: string;
}

// Generate exactly 4 curated garden center placeholder images
const getGardenCenterPlaceholderImages = (query: string, postType: string): ImageSuggestion[] => {
  console.log('[PLACEHOLDER] Getting garden center fallbacks for:', query, 'type:', postType);
  
  // Get curated garden center fallback images
  const fallbackImages = getRelevantFallbacks(query, 4);
  const formattedImages = formatFallbackImages(fallbackImages, query);
  
  console.log('[PLACEHOLDER] Using curated garden center images instead of Lorem Picsum');
  return formattedImages;
};

// Smart content analysis to extract meaningful keywords
const extractKeywordsFromContent = (content: string, campaignTitle?: string): string[] => {
  console.log('[IMAGE_HOOK] Raw content analysis:', content?.substring(0, 200));
  
  if (!content || content.trim().length < 10) {
    console.log('[IMAGE_HOOK] Content too short, using campaign title fallback');
    return campaignTitle ? [campaignTitle] : ['garden center'];
  }

  // Clean HTML tags and decode entities
  let cleanContent = content
    .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
    .replace(/&[^;]+;/g, ' ')          // Remove HTML entities
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim();

  console.log('[IMAGE_HOOK] Cleaned content:', cleanContent.substring(0, 200));

  // Look for specific themes first - prioritize specific plant/flower terms
  const themes = {
    specificFlowers: /\b(zinnia|marigold|petunia|impatiens|sunflower|dahlia|cosmos|salvia|begonia|geranium|pansy|violet)\b/gi,
    summerPlants: /\b(summer|bloom|flowering|heat.?tolerant|drought.?resistant|full.?sun|vibrant|colorful)\b/gi,
    plants: /\b(plant|flower|garden|bloom|seed|soil|grow|botanical|herb|vegetable|tree|shrub)\b/gi,
    outdoor: /\b(outdoor|patio|deck|yard|landscape|backyard|sunshine|fresh air)\b/gi,
    tools: /\b(tool|shovel|rake|hose|fertilizer|mulch|compost|pruning|watering)\b/gi,
    seasonal: /\b(spring|summer|fall|autumn|winter|seasonal|planting|harvest)\b/gi,
    holiday: /\b(holiday|celebration|month|day|national|festival|special)\b/gi
  };

  const foundThemes = [];
  for (const [theme, regex] of Object.entries(themes)) {
    const matches = cleanContent.match(regex);
    if (matches && matches.length > 0) {
      foundThemes.push({ theme, count: matches.length, terms: matches.slice(0, 3) });
    }
  }

  console.log('[IMAGE_HOOK] Found themes:', foundThemes);

  // If we found specific themes, use those
  if (foundThemes.length > 0) {
    const topTheme = foundThemes.sort((a, b) => b.count - a.count)[0];
    const keywords = topTheme.terms.map(term => term.toLowerCase());
    console.log('[IMAGE_HOOK] Using theme keywords:', keywords);
    return keywords;
  }

  // Extract meaningful words as fallback
  const words = cleanContent
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 'been', 'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'throughout', 'alongside', 'within'].includes(word)
    )
    .slice(0, 5);

  console.log('[IMAGE_HOOK] Fallback keywords:', words);
  return words.length > 0 ? words : ['garden center'];
};

// Build smart search query based on content analysis
const buildSmartQuery = (keywords: string[], postType: string, campaignTitle?: string): string => {
  console.log('[IMAGE_HOOK] Building query with keywords:', keywords, 'type:', postType);

  if (!keywords || keywords.length === 0) {
    const fallback = campaignTitle || 'garden center plants';
    console.log('[IMAGE_HOOK] No keywords, using fallback:', fallback);
    return fallback;
  }

  // Build primary query from top keywords
  let query = keywords.slice(0, 2).join(' ');

  // Add context based on primary keyword themes
  const primaryKeyword = keywords[0].toLowerCase();
  
  if (/ice.?cream|frozen|dessert|sweet/.test(primaryKeyword)) {
    query += ' photography fresh';
  } else if (/plant|flower|garden|bloom/.test(primaryKeyword)) {
    // Don't add redundant "garden" terms if keywords already contain garden-related words
    if (!query.toLowerCase().includes('garden')) {
      query += ' garden';
    }
  } else if (/outdoor|patio|landscape/.test(primaryKeyword)) {
    query += ' outdoor space';
  } else if (/tool|equipment/.test(primaryKeyword)) {
    query += ' tools equipment';
  } else {
    // Generic garden center context only if not already garden-related
    if (!query.toLowerCase().includes('garden') && !query.toLowerCase().includes('plant')) {
      query += ' garden center';
    }
  }

  console.log('[IMAGE_HOOK] Final smart query:', query);
  return query;
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
        .order('created_at', { ascending: false })
        .limit(4); // Only get 4 images

      if (error) {
        console.error('[IMAGE_HOOK] Error fetching stored images:', error);
        return false;
      }

      if (data && data.length > 0) {
        console.log('[IMAGE_HOOK] Found', data.length, 'stored images - using cached images');
        setImages(data.slice(0, 4)); // Ensure max 4 images
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

  const fetchNewImages = async (searchQuery: string, taskId?: string, contentType?: string, content?: string, campaignTitle?: string) => {
    setLoading(true);
    console.log('[IMAGE_HOOK] Fetching NEW images with params:', { searchQuery, contentType, campaignTitle });
    
    try {
      let finalQuery = searchQuery;

      // If we have content, do smart analysis
      if (content && content.trim().length > 10) {
        console.log('[IMAGE_HOOK] Analyzing content for smart keywords');
        const smartKeywords = extractKeywordsFromContent(content, campaignTitle);
        finalQuery = buildSmartQuery(smartKeywords, contentType || 'instagram', campaignTitle);
      } else if (campaignTitle) {
        // Use campaign title as fallback
        const titleKeywords = extractKeywordsFromContent(campaignTitle);
        finalQuery = buildSmartQuery(titleKeywords, contentType || 'instagram');
      }

      console.log('[IMAGE_HOOK] Final search query:', finalQuery);
      
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: finalQuery,
          contentTaskId: taskId,
          maxImages: 4 // Request exactly 4 images
        }
      });

      if (error) {
        console.log('[IMAGE_HOOK] Unsplash API error, using garden center fallbacks:', error.message);
        const placeholders = getGardenCenterPlaceholderImages(finalQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(finalQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`Using garden center sample images - Unsplash API unavailable`);
        return;
      }

      if (data?.images && data.images.length > 0) {
        console.log('[IMAGE_HOOK] Successfully fetched', data.images.length, 'real images');
        const limitedImages = data.images.slice(0, 4); // Ensure max 4 images
        setImages(limitedImages);
        setQuery(finalQuery);
        setUsingPlaceholders(false);
        setHasStoredImages(true);
        toast.success(`Found ${limitedImages.length} relevant images for "${finalQuery}"`);
      } else {
        console.log('[IMAGE_HOOK] No images returned, using garden center fallbacks');
        const placeholders = getGardenCenterPlaceholderImages(finalQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(finalQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`No images found, using garden center sample images`);
      }
    } catch (error) {
      console.error('[IMAGE_HOOK] Error fetching images:', error);
      
      const placeholders = getGardenCenterPlaceholderImages(searchQuery, postType || 'instagram');
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      setHasStoredImages(false);
      toast.info(`Using garden center sample images - connection error`);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      console.log('[IMAGE_HOOK] User requested to shuffle/refresh images for query:', query);
      await fetchNewImages(query, contentTaskId, postType);
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
