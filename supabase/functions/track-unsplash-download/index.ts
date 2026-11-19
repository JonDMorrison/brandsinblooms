import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternalApiKey } from "../_shared/requireInternalApiKey.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');

// crm-r2-F113: the platform's Unsplash key is sent only to Unsplash's own download-tracking endpoint,
// https://api.unsplash.com/photos/<id>/download (its query, such as ixid, is kept). Any other scheme,
// host, port, userinfo or path is never fetched.
function unsplashDownloadUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'api.unsplash.com' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    !/^\/photos\/[A-Za-z0-9_-]+\/download$/.test(url.pathname)
  ) {
    return null;
  }
  return url.href;
}

// The caller is the internal fetch-and-assign-images job (server key) or a signed-in user.
async function callerAllowed(req: Request): Promise<boolean> {
  if (requireInternalApiKey(req) === null) return true;
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return false;
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data?.user);
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await callerAllowed(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Test error endpoint for debugging
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    console.error('Test error from track-unsplash-download edge function');
    throw new Error('Test error from track-unsplash-download edge function');
  }

  try {
    const { downloadLocation } = await req.json();

    if (!downloadLocation) {
      throw new Error('Download location is required');
    }

    const trackingUrl = unsplashDownloadUrl(downloadLocation);
    if (!trackingUrl) {
      console.warn('[UNSPLASH_TRACK] Refused a download location outside https://api.unsplash.com/photos/<id>/download');
      return new Response(JSON.stringify({ success: true, tracked: false, error: 'Unsupported download location' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[UNSPLASH_TRACK] Tracking download for: ${trackingUrl}`);

    if (!ACCESS_KEY) {
      console.log('[UNSPLASH_TRACK] ❌ API key not configured - skipping tracking');
      // Return success to not block downloads when API key is missing
      return new Response(JSON.stringify({ success: true, tracked: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Make request to Unsplash download tracking endpoint (never follows a redirect; bounded wait)
    const response = await fetch(trackingUrl, {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
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
    // Return success to not block downloads even if tracking fails
    return new Response(JSON.stringify({ success: true, tracked: false, error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(handler);