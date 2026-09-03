import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts';

const TRACKING_CODE_PATTERN = /^[a-f0-9]{32}$/;

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function redirectResponse(originalUrl: string): Response {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return textResponse('Invalid redirect URL', 400);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return textResponse('Invalid redirect URL', 400);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: parsed.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return textResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const trackingCode = url.pathname.split('/').filter(Boolean).at(-1) || '';

    if (!TRACKING_CODE_PATTERN.test(trackingCode)) {
      return textResponse('Invalid link', 400);
    }

    // HEAD requests from link validators resolve the destination without
    // changing customer engagement metrics.
    if (req.method === 'HEAD') {
      const { data, error } = await supabase
        .from('sms_link_clicks')
        .select('original_url')
        .eq('tracking_code', trackingCode)
        .maybeSingle();

      if (error) {
        console.error('[sms-link-redirect] HEAD lookup failed:', error.message);
        return textResponse('Internal error', 500);
      }
      if (!data?.original_url) return textResponse('Link not found', 404);
      return redirectResponse(data.original_url);
    }

    const userAgent = (req.headers.get('user-agent') || '').slice(0, 512) || null;
    const { data, error } = await supabase.rpc('record_sms_link_click', {
      p_tracking_code: trackingCode,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('[sms-link-redirect] Click recording failed:', error.message);
      return textResponse('Internal error', 500);
    }

    const recorded = Array.isArray(data) ? data[0] : data;
    if (!recorded?.original_url) return textResponse('Link not found', 404);

    // Customer-level metrics represent unique engaged recipients, so repeat
    // clicks on the same message do not inflate them.
    if (recorded.first_message_click && recorded.customer_id) {
      const { error: customerMetricsError } = await supabase.rpc('update_customer_sms_metrics', {
        p_customer_id: recorded.customer_id,
        p_event_type: 'clicked',
      });
      if (customerMetricsError) {
        console.error('[sms-link-redirect] Customer SMS metric update failed:', customerMetricsError.message);
      }

      const { error: crossChannelError } = await supabase.rpc('update_cross_channel_metrics', {
        p_customer_id: recorded.customer_id,
        p_channel: 'sms',
        p_event_type: 'clicked',
      });
      if (crossChannelError) {
        console.error('[sms-link-redirect] Cross-channel metric update failed:', crossChannelError.message);
      }
    }

    return redirectResponse(recorded.original_url);
  } catch (error) {
    console.error('[sms-link-redirect] Unhandled error:', error);
    return textResponse('Internal error', 500);
  }
});
