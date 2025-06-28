
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
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
      orderBy = 'popular',
      contentFilter = 'high'
    } = await req.json();

    if (!query) {
      throw new Error('Query parameter is required');
    }

    console.log(`[UNSPLASH] Enhanced fetch: ${maxImages} ${orientation} images for query: ${query}`);
    console.log(`[UNSPLASH] Parameters: orderBy=${orderBy}, contentFilter=${contentFilter}`);
    console.log(`[UNSPLASH] API Key configured: ${!!unsplashAccessKey}`);

    if (!unsplashAccessKey) {
      console.log('[UNSPLASH] API key not configured, returning error for fallback handling');
      throw new Error('Unsplash API key not configured');
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

    console.log(`[UNSPLASH] Found ${images.length} high-quality images from Unsplash`);

    // Limit to exactly maxImages
    const limitedImages = images.slice(0, maxImages);

    // If contentTaskId is provided, store the images in the database
    if (contentTaskId && limitedImages.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const imageSuggestions = limitedImages.map((image: any) => ({
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

      console.log(`[UNSPLASH] Stored ${imageSuggestions.length} enhanced image suggestions for task ${contentTaskId}`);
    }

    // Return enhanced, high-quality images
    const formattedImages = limitedImages.map((image: any) => ({
      id: image.id,
      thumb_url: image.urls.thumb,
      download_url: image.urls.full,
      alt: image.alt_description || `${query} image`,
      photographer: image.user.name,
      unsplash_id: image.id,
    }));

    return new Response(JSON.stringify({ 
      images: formattedImages,
      query: query,
      parameters: { orientation, orderBy, contentFilter }
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
