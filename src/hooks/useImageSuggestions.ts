
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

  // Look for specific themes first
  const themes = {
    iceCream: /\b(ice cream|gelato|frozen|dessert|sweet|cone|scoop|sundae|milkshake|dairy|treat)\b/gi,
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
    query += ' food photography delicious';
  } else if (/plant|flower|garden|bloom/.test(primaryKeyword)) {
    query += ' gardening nature';
  } else if (/outdoor|patio|landscape/.test(primaryKeyword)) {
    query += ' outdoor lifestyle';
  } else if (/tool|equipment/.test(primaryKeyword)) {
    query += ' gardening tools';
  } else {
    // Generic garden center context
    query += ' garden center';
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
          contentTaskId: taskId 
        }
      });

      if (error) {
        console.log('[IMAGE_HOOK] Unsplash API error, using placeholders:', error.message);
        const placeholders = getPlatformPlaceholderImages(finalQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(finalQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`Using sample images - Unsplash API unavailable`);
        return;
      }

      if (data?.images && data.images.length > 0) {
        console.log('[IMAGE_HOOK] Successfully fetched', data.images.length, 'real images');
        setImages(data.images);
        setQuery(finalQuery);
        setUsingPlaceholders(false);
        setHasStoredImages(true);
        toast.success(`Found ${data.images.length} relevant images for "${finalQuery}"`);
      } else {
        console.log('[IMAGE_HOOK] No images returned, using placeholders');
        const placeholders = getPlatformPlaceholderImages(finalQuery, contentType || 'instagram');
        setImages(placeholders);
        setQuery(finalQuery);
        setUsingPlaceholders(true);
        setHasStoredImages(false);
        toast.info(`No images found, using sample images`);
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
