
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

    // === ENHANCED DEBUG LOGGING ===
    console.log(`[UNSPLASH-DEBUG] ===== REQUEST START =====`);
    console.log(`[UNSPLASH-DEBUG] Raw input query: "${query}"`);
    console.log(`[UNSPLASH-DEBUG] rawQuery flag: ${rawQuery}`);
    console.log(`[UNSPLASH-DEBUG] contentTaskId: ${contentTaskId}`);
    
    // Query quality analysis
    if (query) {
      const queryWords = query.trim().split(/\s+/);
      const isSpecific = queryWords.length >= 3 && !query.toLowerCase().includes('garden center');
      console.log(`[UNSPLASH-DEBUG] Query specificity: ${isSpecific ? '✅ SPECIFIC' : '⚠️ GENERIC'} (${queryWords.length} words)`);
      
      // Check for problematic patterns
      if (query.includes('garden garden')) {
        console.warn(`[UNSPLASH-DEBUG] ⚠️ DUPLICATE "garden" detected in query!`);
      }
      if (query === 'garden') {
        console.warn(`[UNSPLASH-DEBUG] ⚠️ Query is just "garden" - too generic!`);
      }
    }
    console.log(`[UNSPLASH-DEBUG] ===== END DEBUG =====`);

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

    // VALIDATION STEP 1: Validate query BEFORE calling Unsplash
    const validateQuery = (q: string): { valid: boolean; enhancedQuery: string; reason?: string } => {
      if (!q || q.trim().length === 0) {
        return { valid: false, enhancedQuery: '', reason: 'Empty query' };
      }

      const trimmed = q.trim().toLowerCase();
      const words = trimmed.split(/\s+/).filter(w => w.length > 2);
      
      // Reject generic queries
      if (words.length < 2) {
        console.warn(`[UNSPLASH-VALIDATION] ❌ Query too generic: "${q}" (${words.length} meaningful words)`);
        return { 
          valid: false, 
          enhancedQuery: `${q} garden plants nursery flowers`,
          reason: 'Query too short - needs at least 2 meaningful words'
        };
      }

      // Check for garden-related terms
      const gardenTerms = ['garden', 'plant', 'flower', 'bloom', 'nursery', 'botanical', 'leaf', 'tree', 'shrub', 'herb', 'vegetable', 'succulent', 'cactus', 'rose', 'tulip', 'orchid', 'fern', 'seed', 'soil', 'pot', 'greenhouse'];
      const hasGardenTerm = gardenTerms.some(term => trimmed.includes(term));
      
      if (!hasGardenTerm) {
        console.warn(`[UNSPLASH-VALIDATION] ⚠️ No garden terms found in: "${q}"`);
        return {
          valid: true,
          enhancedQuery: `${q} garden plants nursery`,
          reason: 'Enhanced with garden context'
        };
      }

      console.log(`[UNSPLASH-VALIDATION] ✅ Query validated: "${q}"`);
      return { valid: true, enhancedQuery: q };
    };

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
      images = collectionData || [];
      console.log(`[UNSPLASH] Found ${images.length} images from collection ${collection}`);
    } else {
      // Search photos with query
      if (query) {
        // STEP 1: Validate and enhance query
        const validation = validateQuery(query);
        let searchQuery = rawQuery ? query : validation.enhancedQuery;
        
        if (!validation.valid && !rawQuery) {
          console.warn(`[UNSPLASH] Invalid query "${query}", using enhanced: "${searchQuery}"`);
        }

        // Enhanced Unsplash API call with quality parameters
        const searchParams = new URLSearchParams({
          query: encodeURIComponent(searchQuery),
          per_page: (maxImages * 2).toString(), // Fetch more to allow for filtering
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

    // VALIDATION STEP 2: Score and filter images by garden relevance
    const scoreImageRelevance = (image: any): { score: number; reason: string } => {
      const alt = (image.alt_description || '').toLowerCase();
      const desc = (image.description || '').toLowerCase();
      const tags = image.tags?.map((t: any) => t.title.toLowerCase()).join(' ') || '';
      const content = `${alt} ${desc} ${tags}`;
      
      let score = 0;
      let reason = '';

      // BLOCK: Non-garden categories (architecture, fashion, food, people, abstract)
      const blockedTerms = /\b(building|architecture|pillar|column|louis vuitton|fashion|store|mall|shop|interior|furniture|person|people|human|face|portrait|selfie|abstract|geometric|pattern|food|restaurant|cafe|dessert|ice cream)\b/i;
      if (blockedTerms.test(content)) {
        console.warn(`[UNSPLASH-FILTER] ❌ Blocked non-garden image ${image.id}: contains "${content.match(blockedTerms)?.[0]}"`);
        return { score: -100, reason: 'Non-garden category detected' };
      }

      // REQUIRE: Garden-related terms
      const gardenTerms = ['garden', 'plant', 'flower', 'bloom', 'nursery', 'botanical', 'leaf', 'tree', 'shrub', 'herb', 'vegetable', 'succulent', 'cactus', 'rose', 'tulip', 'orchid', 'fern', 'seed', 'soil', 'pot', 'greenhouse', 'petal', 'stem', 'blossom', 'foliage'];
      const gardenMatches = gardenTerms.filter(term => content.includes(term));
      
      if (gardenMatches.length === 0) {
        console.warn(`[UNSPLASH-FILTER] ❌ No garden terms found in ${image.id}: "${alt || desc}"`);
        return { score: 0, reason: 'No garden-related terms' };
      }

      // Score based on garden term matches
      score = gardenMatches.length * 20;
      reason = `Garden terms: ${gardenMatches.slice(0, 3).join(', ')}`;

      // Bonus for plant-specific terms
      const plantTerms = ['rose', 'tulip', 'orchid', 'fern', 'succulent', 'cactus', 'lily', 'daisy', 'sunflower', 'lavender', 'hydrangea', 'peony', 'iris', 'marigold', 'petunia', 'begonia', 'geranium', 'pansy'];
      const plantMatches = plantTerms.filter(term => content.includes(term));
      if (plantMatches.length > 0) {
        score += plantMatches.length * 15;
        reason += ` + specific plants: ${plantMatches.slice(0, 2).join(', ')}`;
      }

      console.log(`[UNSPLASH-FILTER] ✅ Image ${image.id} scored ${score}: ${reason}`);
      return { score, reason };
    };

    // Score all images
    const scoredImages = images.map(image => {
      const { score, reason } = scoreImageRelevance(image);
      return { image, score, reason };
    });

    // Filter: Only keep images with positive scores (garden-relevant)
    const validImages = scoredImages
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxImages)
      .map(item => item.image);

    console.log(`[UNSPLASH] After garden validation: ${validImages.length}/${images.length} images are garden-relevant`);

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
