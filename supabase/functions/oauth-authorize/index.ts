import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();
    
    if (!['mailchimp', 'klaviyo'].includes(provider)) {
      throw new Error('Invalid provider');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: 'Authentication required. Please log in and try again.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!user || authError) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: 'Invalid or expired session. Please log in again.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    // Get OAuth credentials from environment
    const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`);
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: `Please configure ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET as secrets in Supabase` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build callback redirect URI
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/migrations-oauth-callback?provider=${provider}`;

    // Determine app origin (for popup redirect back to SPA)
    const requestOrigin = req.headers.get('origin') || req.headers.get('referer') || '';
    const appOrigin = requestOrigin ? new URL(requestOrigin).origin : (Deno.env.get('APP_ORIGIN') || Deno.env.get('APP_BASE_URL') || 'https://bloomsuite.app');

    // Create signed JWT state (no DB writes)
    const secret = Deno.env.get('OAUTH_STATE_SECRET');
    if (!secret) {
      return new Response(
        JSON.stringify({ 
          error: true,
          message: 'Please configure OAUTH_STATE_SECRET as a Supabase Function secret' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const statePayload = {
      uid: user.id,
      provider,
      nonce: crypto.randomUUID(),
      ts: Date.now(),
      redirectUri,
      appOrigin,
      exp: getNumericDate(60 * 10), // 10 minutes
    };

    const state = await create({ alg: 'HS256', typ: 'JWT' }, statePayload as Record<string, unknown>, key);


    // Build OAuth URL
    let authUrl = '';
    if (provider === 'mailchimp') {
      authUrl = `https://login.mailchimp.com/oauth2/authorize?` +
        `response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    } else if (provider === 'klaviyo') {
      authUrl = `https://www.klaviyo.com/oauth/authorize?` +
        `response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=lists:read accounts:read`;
    }

    console.log(`[oauth-authorize] Generated auth URL for ${provider}`);

    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[oauth-authorize] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
