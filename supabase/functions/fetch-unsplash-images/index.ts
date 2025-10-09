
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
      collection,
      page = 1,
      contentTaskId, 
      maxImages = 4,
      orientation = 'squarish',
      orderBy = 'relevant',
      contentFilter = 'high',
      rawQuery = false
    } = await req.json();

    if (!query && !collection) {
      throw new Error('Either query or collection parameter is required');
    }

    console.log(`[UNSPLASH] ===== ENHANCED FETCH DEBUG =====`);
    console.log(`[UNSPLASH] Received query: "${query}", collection: "${collection}", page: ${page}`);
    console.log(`[UNSPLASH] Parameters: maxImages=${maxImages}, orientation=${orientation}, orderBy=${orderBy}, contentFilter=${contentFilter}, rawQuery=${rawQuery}`);
    console.log(`[UNSPLASH] API Key configured: ${!!unsplashAccessKey} (${unsplashAccessKey ? 'Available' : 'Missing - will use garden center fallbacks'})`);
    console.log(`[UNSPLASH] Supabase URL: ${!!supabaseUrl}`);
    console.log(`[UNSPLASH] Service Key: ${!!supabaseServiceKey}`);

    if (!unsplashAccessKey) {
      console.log('[UNSPLASH] ❌ API key not configured - falling back to garden center images');
      console.log('[UNSPLASH] This is expected behavior when API key is not set');
      throw new Error('Unsplash API key not configured - using garden center fallbacks');
    }

    let unsplashUrl: string;
    let images: any[] = [];

    if (collection) {
      // Fetch from curated collection
      const collectionParams = new URLSearchParams({
        page: page.toString(),
        per_page: maxImages.toString(),
      });
      
      unsplashUrl = `https://api.unsplash.com/collections/${collection}/photos?${collectionParams.toString()}`;
      console.log(`[UNSPLASH] Fetching from collection: ${unsplashUrl}`);

      const unsplashResponse = await fetch(unsplashUrl, {
        headers: {
          'Authorization': `Client-ID ${unsplashAccessKey}`,
        },
      });

      console.log(`[UNSPLASH] Collection API Response status: ${unsplashResponse.status}`);

      if (!unsplashResponse.ok) {
        const errorText = await unsplashResponse.text();
        console.error(`[UNSPLASH] Collection API error ${unsplashResponse.status}: ${errorText}`);
        throw new Error(`Unsplash Collection API error: ${unsplashResponse.status}`);
      }

      const collectionData = await unsplashResponse.json();
      images = collectionData || []; // Collection endpoint returns array directly
      console.log(`[UNSPLASH] Found ${images.length} images from collection ${collection}`);
    } else {
      // Search photos with query
      if (query) {
        let searchQuery = query;
        
        // Simplified: Only sanitize truly problematic queries
        if (!rawQuery) {
          const problematicTerms = /\b(ice.?cream|dessert|sweet|food|restaurant|cafe)\b/i;
          if (problematicTerms.test(query)) {
            console.warn(`[UNSPLASH] Query contains food terms, adding plant context: "${query}"`);
            searchQuery = `${query.replace(problematicTerms, '').trim()} garden plants`;
          } else {
            searchQuery = query;  // Trust the input query
          }
          console.log(`[UNSPLASH] Search query: "${searchQuery}"`);
        } else {
          console.log(`[UNSPLASH] Using raw query: "${searchQuery}"`);
        }

        // Enhanced Unsplash API call with quality parameters
        const searchParams = new URLSearchParams({
          query: encodeURIComponent(searchQuery),
          per_page: maxImages.toString(),
          orientation: orientation,
          order_by: orderBy,
          content_filter: contentFilter
        });

        unsplashUrl = `https://api.unsplash.com/search/photos?${searchParams.toString()}`;
        console.log(`[UNSPLASH] Search Request URL: ${unsplashUrl}`);

        const unsplashResponse = await fetch(unsplashUrl, {
          headers: {
            'Authorization': `Client-ID ${unsplashAccessKey}`,
          },
        });

        console.log(`[UNSPLASH] Search API Response status: ${unsplashResponse.status}`);

        if (!unsplashResponse.ok) {
          const errorText = await unsplashResponse.text();
          console.error(`[UNSPLASH] Search API error ${unsplashResponse.status}: ${errorText}`);
          throw new Error(`Unsplash Search API error: ${unsplashResponse.status}`);
        }

        const unsplashData = await unsplashResponse.json();
        images = unsplashData.results || [];
        console.log(`[UNSPLASH] Found ${images.length} images from search`);
      }
    }

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

    // Minimal filtering - only remove obviously inappropriate content
    const validImages = limitedImages.filter(image => {
      const alt = (image.alt_description || '').toLowerCase();
      const desc = (image.description || '').toLowerCase();
      const content = `${alt} ${desc}`;
      
      // Only filter out NSFW/inappropriate content
      const inappropriateTerms = /\b(inappropriate|nsfw|adult|explicit)\b/i;
      if (inappropriateTerms.test(content)) {
        console.warn(`[UNSPLASH] Filtering inappropriate image: ${image.id}`);
        return false;
      }
      
      // Trust Unsplash's relevance algorithm - if it matched the query, it's likely relevant
      console.log(`[UNSPLASH] ✓ Including image: ${image.id} - ${alt || 'no alt'}`);
      return true;
    });

    console.log(`[UNSPLASH] After filtering: ${validImages.length}/${limitedImages.length} images are relevant`);

    // If contentTaskId is provided, store the images in the database
    if (contentTaskId && validImages.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const imageSuggestions = validImages.map((image: any) => ({
        content_task_id: contentTaskId,
        query: collection ? `collection:${collection}` : query,
        thumb_url: image.urls.thumb,
        download_url: image.urls.full,
        alt: image.alt_description || `${collection ? 'Curated garden' : query} image`,
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
      alt: image.alt_description || `${collection ? 'Curated garden' : query} image`,
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
