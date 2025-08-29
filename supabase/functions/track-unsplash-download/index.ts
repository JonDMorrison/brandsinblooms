import * as Sentry from "https://deno.land/x/sentry/index.js";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from track-unsplash-download edge function - Sentry should capture this!');
  }

  try {
    const { downloadLocation } = await req.json();

    if (!downloadLocation) {
      throw new Error('Download location is required');
    }

    console.log(`[UNSPLASH_TRACK] Tracking download for: ${downloadLocation}`);

    if (!ACCESS_KEY) {
      console.log('[UNSPLASH_TRACK] ❌ API key not configured - skipping tracking');
      // Return success to not block downloads when API key is missing
      return new Response(JSON.stringify({ success: true, tracked: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Make request to Unsplash download tracking endpoint
    const response = await fetch(downloadLocation, {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
      },
    });

    console.log(`[UNSPLASH_TRACK] Tracking response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UNSPLASH_TRACK] API error ${response.status}: ${errorText}`);
      // Don't throw error - tracking failure shouldn't block downloads
      return new Response(JSON.stringify({ success: true, tracked: false, error: `Tracking failed: ${response.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[UNSPLASH_TRACK] Successfully tracked download`);

    return new Response(JSON.stringify({ success: true, tracked: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[UNSPLASH_TRACK] Error in track-unsplash-download function:', error);
    Sentry.captureException(error);
    // Return success to not block downloads even if tracking fails
    return new Response(JSON.stringify({ success: true, tracked: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(handler);