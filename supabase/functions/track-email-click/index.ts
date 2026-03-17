/**
 * Email Click Tracking Redirect
 * 
 * This endpoint:
 * 1. Receives a tracking token via query param
 * 2. Logs the click event
 * 3. Redirects to the original URL
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback URL if something goes wrong
const FALLBACK_URL = 'https://bloomsuite.app';

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('t') || url.searchParams.get('token');
    
    console.log(`[track-email-click] Token: ${token?.substring(0, 8)}...`);
    
    if (!token) {
      console.error('[track-email-click] Missing token');
      return new Response(null, {
        status: 302,
        headers: { Location: FALLBACK_URL, ...corsHeaders }
      });
    }
    
    // Use service role to bypass RLS for tracking
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Look up the tracked link
    const { data: trackedLink, error: linkError } = await supabase
      .from('email_tracked_links')
      .select('id, tenant_id, customer_id, original_url')
      .eq('token', token)
      .single();
    
    if (linkError || !trackedLink) {
      console.error('[track-email-click] Link not found:', linkError?.message || 'no data');
      return new Response(null, {
        status: 302,
        headers: { Location: FALLBACK_URL, ...corsHeaders }
      });
    }
    
    console.log(`[track-email-click] Found link: ${trackedLink.original_url.substring(0, 50)}...`);
    
    // Extract user agent and IP
    const userAgent = req.headers.get('user-agent') || null;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || null;
    const referer = req.headers.get('referer') || null;
    
    // Log the click event (fire and forget for faster redirect)
    supabase
      .from('email_click_events')
      .insert({
        tenant_id: trackedLink.tenant_id,
        tracked_link_id: trackedLink.id,
        customer_id: trackedLink.customer_id,
        user_agent: userAgent,
        ip_address: ipAddress,
        referer: referer
      })
      .then(({ error }) => {
        if (error) {
          console.error('[track-email-click] Failed to log click:', error.message);
        } else {
          console.log('[track-email-click] Click logged successfully');
        }
      });
    
    // Redirect to original URL
    return new Response(null, {
      status: 302,
      headers: {
        Location: trackedLink.original_url,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders
      }
    });
    
  } catch (error: any) {
    console.error('[track-email-click] Error:', error.message);
    
    // On error, redirect to fallback
    return new Response(null, {
      status: 302,
      headers: { Location: FALLBACK_URL, ...corsHeaders }
    });
  }
};

serve(handler);
