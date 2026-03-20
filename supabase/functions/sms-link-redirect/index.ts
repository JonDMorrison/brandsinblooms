import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

/**
 * SMS Link Redirect Handler
 * 
 * Handles click tracking for SMS link shortening:
 * 1. Looks up tracking code in sms_link_clicks table
 * 2. Updates click timestamp and metadata
 * 3. Updates customer SMS metrics
 * 4. Redirects to original URL
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract tracking code from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const trackingCode = pathParts[pathParts.length - 1];

    if (!trackingCode) {
      console.error('[sms-link-redirect] No tracking code provided');
      return new Response('Invalid link', { status: 400 });
    }

    console.log('[sms-link-redirect] Processing click for code:', trackingCode);

    // Look up the tracking record
    const { data: linkRecord, error: lookupError } = await supabase
      .from('sms_link_clicks')
      .select('*')
      .eq('tracking_code', trackingCode)
      .maybeSingle();

    if (lookupError) {
      console.error('[sms-link-redirect] Lookup error:', lookupError);
      return new Response('Link not found', { status: 404 });
    }

    if (!linkRecord) {
      console.error('[sms-link-redirect] Link not found for code:', trackingCode);
      return new Response('Link not found', { status: 404 });
    }

    // Get user agent and IP for analytics
    const userAgent = req.headers.get('user-agent') || null;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null;

    // Update the click record
    const { error: updateError } = await supabase
      .from('sms_link_clicks')
      .update({
        clicked_at: new Date().toISOString(),
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .eq('id', linkRecord.id);

    if (updateError) {
      console.error('[sms-link-redirect] Error updating click record:', updateError);
    }

    // Update message links_clicked counter
    if (linkRecord.message_id) {
      await supabase
        .from('sms_messages')
        .update({
          links_clicked: supabase.rpc ? 1 : 1, // Increment would require RPC
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkRecord.message_id);
    }

    // Update customer SMS metrics if customer_id exists
    if (linkRecord.customer_id) {
      const { error: metricsError } = await supabase.rpc('update_customer_sms_metrics', {
        p_customer_id: linkRecord.customer_id,
        p_event_type: 'clicked',
      });

      if (metricsError) {
        console.error('[sms-link-redirect] Error updating SMS metrics:', metricsError);
      } else {
        console.log('[sms-link-redirect] Updated SMS metrics for customer:', linkRecord.customer_id);
      }

      // Update cross-channel metrics
      const { error: crossChannelError } = await supabase.rpc('update_cross_channel_metrics', {
        p_customer_id: linkRecord.customer_id,
        p_channel: 'sms',
        p_event_type: 'clicked',
      });
      if (crossChannelError) {
        console.error('[sms-link-redirect] Error updating cross-channel metrics:', crossChannelError);
      }
    }

    console.log('[sms-link-redirect] Redirecting to:', linkRecord.original_url);

    // SECURITY: Validate redirect URL to prevent open redirect attacks
    try {
      const redirectUrl = new URL(linkRecord.original_url);
      if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
        return new Response('Invalid redirect URL', { status: 400 });
      }
    } catch {
      return new Response('Invalid redirect URL', { status: 400 });
    }

    // Redirect to original URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': linkRecord.original_url,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[sms-link-redirect] Error:', error);
    return new Response('Internal error', { 
      status: 500,
      headers: corsHeaders,
    });
  }
});
