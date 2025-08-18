import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthRequest {
  action: 'authorize' | 'callback';
  code?: string;
  state?: string;
  tenantId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'authorize') {
      // Step 1: Generate authorization URL
      const { tenantId } = await req.json();
      
      const clientId = Deno.env.get('CLOUDFLARE_CLIENT_ID');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cloudflare-oauth?action=callback`;
      
      if (!clientId) {
        throw new Error('Cloudflare OAuth not configured');
      }

      const state = crypto.randomUUID();
      
      // Store state temporarily for security
      await supabase
        .from('oauth_states')
        .insert({
          state,
          tenant_id: tenantId,
          provider: 'cloudflare',
          expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

      const authUrl = new URL('https://dash.cloudflare.com/oauth2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('scope', 'zone:read zone:edit');

      return new Response(JSON.stringify({
        success: true,
        authUrl: authUrl.toString()
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (action === 'callback') {
      // Step 2: Handle OAuth callback
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        throw new Error('Missing authorization code or state');
      }

      // Verify state
      const { data: stateData, error: stateError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .eq('provider', 'cloudflare')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (stateError || !stateData) {
        throw new Error('Invalid or expired state');
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://dash.cloudflare.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cloudflare-oauth?action=callback`,
          client_id: Deno.env.get('CLOUDFLARE_CLIENT_ID') || '',
          client_secret: Deno.env.get('CLOUDFLARE_CLIENT_SECRET') || '',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(`OAuth token exchange failed: ${tokenData.error_description || tokenData.error}`);
      }

      // Get user info to verify token
      const userResponse = await fetch('https://api.cloudflare.com/client/v4/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const userData = await userResponse.json();

      if (!userResponse.ok) {
        throw new Error('Failed to verify Cloudflare token');
      }

      // Store integration
      const { data: integration, error: integrationError } = await supabase
        .from('domain_provider_integrations')
        .insert({
          tenant_id: stateData.tenant_id,
          provider_type: 'cloudflare',
          provider_config: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
            user_email: userData.result.email,
            user_id: userData.result.id,
          },
          is_active: true,
          oauth_connected: true,
        })
        .select()
        .single();

      if (integrationError) {
        throw new Error(`Failed to save integration: ${integrationError.message}`);
      }

      // Clean up state
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);

      // Redirect back to app with success
      const redirectUrl = new URL(`${Deno.env.get('SUPABASE_URL').replace('.supabase.co', '.lovable.app')}/crm/settings/domains`);
      redirectUrl.searchParams.set('oauth_success', 'cloudflare');
      redirectUrl.searchParams.set('integration_id', integration.id);

      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl.toString(),
          ...corsHeaders,
        },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Cloudflare OAuth error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

serve(handler);