
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const unsplashAccessKey = Deno.env.get('UNSPLASH_ACCESS_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      query, 
      contentTaskId, 
      maxImages = 4,
      orientation = 'squarish',
      orderBy = 'relevant', // Changed from 'popular' to 'relevant' for better quality
      contentFilter = 'high'
    } = await req.json();

    if (!query) {
      throw new Error('Query parameter is required');
    }

    console.log(`[UNSPLASH] ===== ENHANCED FETCH DEBUG =====`);
    console.log(`[UNSPLASH] Received query: "${query}"`);
    console.log(`[UNSPLASH] Parameters: maxImages=${maxImages}, orientation=${orientation}, orderBy=${orderBy}, contentFilter=${contentFilter}`);
    console.log(`[UNSPLASH] API Key configured: ${!!unsplashAccessKey} (${unsplashAccessKey ? 'Available' : 'Missing - will use garden center fallbacks'})`);
    console.log(`[UNSPLASH] Supabase URL: ${!!supabaseUrl}`);
    console.log(`[UNSPLASH] Service Key: ${!!supabaseServiceKey}`);

    if (!unsplashAccessKey) {
      console.log('[UNSPLASH] ❌ API key not configured - falling back to garden center images');
      console.log('[UNSPLASH] This is expected behavior when API key is not set');
      throw new Error('Unsplash API key not configured - using garden center fallbacks');
    }

    // Validate query doesn't contain problematic terms
    const problematicTerms = /\b(ice.?cream|dessert|sweet|food|restaurant|cafe|%|percent|symbol|sign|math|number)\b/i;
    if (problematicTerms.test(query)) {
      console.warn(`[UNSPLASH] Query contains problematic terms: "${query}"`);
      // Force garden center context
      const sanitizedQuery = `garden center plants nursery ${query.replace(problematicTerms, '').trim()}`;
      console.log(`[UNSPLASH] Using sanitized query: "${sanitizedQuery}"`);
    }

    // Enhanced Unsplash API call with quality parameters
    const searchParams = new URLSearchParams({
      query: encodeURIComponent(query),
      per_page: maxImages.toString(),
      orientation: orientation,
      order_by: orderBy,
      content_filter: contentFilter
    });

    const unsplashUrl = `https://api.unsplash.com/search/photos?${searchParams.toString()}`;
    console.log(`[UNSPLASH] Request URL: ${unsplashUrl}`);

    const unsplashResponse = await fetch(unsplashUrl, {
      headers: {
        'Authorization': `Client-ID ${unsplashAccessKey}`,
      },
    });

    console.log(`[UNSPLASH] API Response status: ${unsplashResponse.status}`);

    if (!unsplashResponse.ok) {
      const errorText = await unsplashResponse.text();
      console.error(`[UNSPLASH] API error ${unsplashResponse.status}: ${errorText}`);
      throw new Error(`Unsplash API error: ${unsplashResponse.status}`);
    }

    const unsplashData = await unsplashResponse.json();
    const images = unsplashData.results || [];

    console.log(`[UNSPLASH] Found ${images.length} images from Unsplash`);
    
    // Log image details for debugging
    if (images.length > 0) {
      console.log(`[UNSPLASH] First image details:`, {
        id: images[0].id,
        description: images[0].description,
        alt_description: images[0].alt_description,
        tags: images[0].tags?.map(t => t.title).slice(0, 5)
      });
    }

    // Limit to exactly maxImages
    const limitedImages = images.slice(0, maxImages);

    // Enhanced image validation and filtering
    const validImages = limitedImages.filter(image => {
      const alt = (image.alt_description || '').toLowerCase();
      const desc = (image.description || '').toLowerCase();
      const tags = image.tags?.map(t => t.title.toLowerCase()).join(' ') || '';
      
      const content = `${alt} ${desc} ${tags}`;
      const queryWords = query.toLowerCase().split(' ');
      
      // Check for problematic content (expanded list)
      const problematicTerms = /\b(ice.?cream|dessert|sweet|food|restaurant|cafe|%|percent|symbol|sign|math|number|people|person|human|face|portrait|indoor|office|computer|technology)\b/i;
      if (problematicTerms.test(content)) {
        console.warn(`[UNSPLASH] Filtering out irrelevant image: ${image.id} - ${alt}`);
        return false;
      }
      
      // Positive validation - ensure garden/plant relevance
      const gardenTerms = ['garden', 'plant', 'flower', 'bloom', 'nursery', 'botanical', 'leaf', 'green', 'nature', 'outdoor'];
      const hasGardenContext = gardenTerms.some(term => content.includes(term));
      
      // Check for query word matches
      const hasQueryMatch = queryWords.some(word => word.length > 2 && content.includes(word));
      
      if (!hasGardenContext && !hasQueryMatch) {
        console.warn(`[UNSPLASH] Filtering out non-relevant image: ${image.id} - no garden context or query match`);
        return false;
      }
      
      return true;
    });

    console.log(`[UNSPLASH] After filtering: ${validImages.length}/${limitedImages.length} images are relevant`);

    // If contentTaskId is provided, store the images in the database
    if (contentTaskId && validImages.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const imageSuggestions = validImages.map((image: any) => ({
        content_task_id: contentTaskId,
        query: query,
        thumb_url: image.urls.thumb,
        download_url: image.urls.full,
        alt: image.alt_description || `${query} image`,
        photographer: image.user.name,
        unsplash_id: image.id,
      }));

      const { error } = await supabase
        .from('image_suggestions')
        .insert(imageSuggestions);

      if (error) {
        console.error('[UNSPLASH] Error storing image suggestions:', error);
        throw new Error('Failed to store image suggestions');
      }

      console.log(`[UNSPLASH] Stored ${imageSuggestions.length} validated image suggestions for task ${contentTaskId}`);
    }

    // Return enhanced, validated images with comprehensive attribution
    const formattedImages = validImages.map((image: any) => ({
      id: image.id,
      urls: {
        raw: image.urls.raw,
        full: image.urls.full,
        regular: image.urls.regular,
        small: image.urls.small,
        thumb: image.urls.thumb,
      },
      thumb_url: image.urls.thumb,
      download_url: image.urls.full,
      alt: image.alt_description || `${query} image`,
      photographer: image.user.name,
      photographer_username: image.user.username,
      photographer_url: image.user.links.html,
      unsplash_id: image.id,
      download_location: image.links.download_location,
    }));

    console.log(`[UNSPLASH] ===== END ENHANCED FETCH DEBUG =====`);

    return new Response(JSON.stringify({ 
      images: formattedImages,
      query: query,
      parameters: { orientation, orderBy, contentFilter },
      filtered: limitedImages.length - validImages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[UNSPLASH] Error in enhanced fetch-unsplash-images function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
