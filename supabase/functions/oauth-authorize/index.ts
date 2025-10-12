import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

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

    // Generate state token for CSRF protection
    const state = crypto.randomUUID();
    
    // Store state in database for verification
    await supabase.from('provider_connections').upsert({
      tenant_id: userData.tenant_id,
      user_id: user.id,
      provider,
      status: 'pending',
      metadata: { state, initiated_at: new Date().toISOString() }
    }, {
      onConflict: 'tenant_id,provider'
    });

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/migrations-oauth-callback`;

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
