
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
};

const ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      throw new Error('Query parameter is required');
    }

    console.log(`[UNSPLASH] Single image fetch for query: ${query}`);
    console.log(`[UNSPLASH] API Key configured: ${!!ACCESS_KEY}`);

    if (!ACCESS_KEY) {
      console.log('[UNSPLASH] ❌ API key not configured - falling back to garden center images');
      console.log('[UNSPLASH] This is expected behavior when API key is not set');
      throw new Error('Unsplash API key not configured - using garden center fallbacks');
    }

    // Enhanced URL building with better parameters
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'squarish'); // Better for cards and content
    url.searchParams.set('content_filter', 'high'); // Brand-safe content only
    url.searchParams.set('order_by', 'relevant'); // Most relevant first

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
      },
    });

    console.log(`[UNSPLASH] API Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UNSPLASH] API error ${response.status}: ${errorText}`);
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    const image = data.results?.[0];

    if (!image) {
      console.log(`[UNSPLASH] No images found for query: ${query}`);
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[UNSPLASH] Found image: ${image.id} by ${image.user.name}`);

    // Return the single best image
    const result = {
      id: image.id,
      urls: {
        regular: image.urls.regular,
        small: image.urls.small,
        thumb: image.urls.thumb,
      },
      alt_description: image.alt_description,
      user: {
        name: image.user.name,
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[UNSPLASH] Error in get-unsplash-image function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
