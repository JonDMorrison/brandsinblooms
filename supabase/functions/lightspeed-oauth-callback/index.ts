import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple base64 encoding - for production use proper encryption
async function simpleEncrypt(token: string): Promise<string> {
  return btoa(token);
}

async function simpleDecrypt(encrypted: string): Promise<string> {
  return atob(encrypted);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[LS-CALLBACK] ==========================================');
    console.log('[LS-CALLBACK] OAuth callback request received');
    
    // Get code and state from request body (called from frontend)
    const { code, state } = await req.json();
    
    console.log('[LS-CALLBACK] Params:', {
      code: code ? code.substring(0, 20) + '...' : 'missing',
      state: state ? state.substring(0, 12) + '...' : 'missing'
    });

    // Validate required parameters
    if (!code || !state) {
      console.error('[LS-CALLBACK] Missing required params');
      throw new Error('Missing code or state parameter');
    }

    // Parse and validate state (simple format: UUID-timestamp)
    const stateParts = state.split('-');
    if (stateParts.length !== 6) { // UUID has 5 parts + timestamp
      console.error('[LS-CALLBACK] Invalid state format');
      throw new Error('Invalid state format');
    }

    const timestamp = parseInt(stateParts[5]);
    const stateAge = Date.now() - timestamp;
    
    // State should be recent (within 10 minutes)
    if (stateAge > 600000) {
      console.error('[LS-CALLBACK] State expired:', { age: stateAge });
      throw new Error('Authorization expired - please try again');
    }

    console.log('[LS-CALLBACK] State validated (age:', Math.floor(stateAge / 1000), 'seconds)');

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get credentials
    const clientId = Deno.env.get('LIGHTSPEED_CLIENT_ID');
    const clientSecret = Deno.env.get('LIGHTSPEED_CLIENT_SECRET');
    const callbackUrl = `https://bloomsuite.app/integrations/lightspeed/callback`;

    if (!clientId || !clientSecret) {
      console.error('[LS-CALLBACK] Missing Lightspeed credentials in environment');
      throw new Error('Lightspeed credentials not configured');
    }

    console.log('[LS-CALLBACK] Credentials loaded, client_id:', clientId.substring(0, 8) + '...');

    // Find the pending connection to get domain prefix
    console.log('[LS-CALLBACK] Looking up pending connection...');
    const { data: connections, error: lookupError } = await supabaseAdmin
      .from('lightspeed_connections')
      .select('*')
      .eq('encrypted_access_token', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (lookupError || !connections || connections.length === 0) {
      console.error('[LS-CALLBACK] No pending connection found:', lookupError?.message);
      throw new Error('No pending connection found - please try reconnecting');
    }

    const connection = connections[0];
    const domainPrefix = connection.domain_prefix;
    const tenantId = connection.tenant_id;
    const userId = connection.user_id;

    console.log('[LS-CALLBACK] Found pending connection:', {
      tenant_id: tenantId,
      domain_prefix: domainPrefix,
      user_id: userId
    });

    // Exchange authorization code for tokens
    console.log('[LS-CALLBACK] Exchanging authorization code for tokens...');
    const tokenUrl = `https://${domainPrefix}.retail.lightspeed.app/api/1.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      code: code,
    });

    console.log('[LS-CALLBACK] Token endpoint:', tokenUrl);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[LS-CALLBACK] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText
      });
      throw new Error(`Failed to exchange code: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[LS-CALLBACK] Token exchange successful');

    if (!tokenData.access_token) {
      console.error('[LS-CALLBACK] No access token in response:', tokenData);
      throw new Error('No access token received from Lightspeed');
    }

    // Fetch retailer information
    console.log('[LS-CALLBACK] Fetching retailer information...');
    const retailerUrl = `https://${domainPrefix}.retail.lightspeed.app/api/1.0/retailer`;
    const retailerResponse = await fetch(retailerUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!retailerResponse.ok) {
      console.error('[LS-CALLBACK] Retailer fetch failed:', retailerResponse.status);
      throw new Error(`Failed to fetch retailer info: ${retailerResponse.status}`);
    }

    const retailerData = await retailerResponse.json();
    console.log('[LS-CALLBACK] Retailer info retrieved:', retailerData.data?.name || 'Unknown');

    // Encrypt tokens
    console.log('[LS-CALLBACK] Encrypting tokens...');
    const encryptedAccess = await simpleEncrypt(tokenData.access_token);
    const encryptedRefresh = tokenData.refresh_token 
      ? await simpleEncrypt(tokenData.refresh_token)
      : null;

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Update connection with real tokens
    console.log('[LS-CALLBACK] Saving connection to database...');
    const { error: updateError } = await supabaseAdmin
      .from('lightspeed_connections')
      .update({
        encrypted_access_token: encryptedAccess,
        encrypted_refresh_token: encryptedRefresh,
        expires_at: expiresAt.toISOString(),
        retailer_id: retailerData.data?.id?.toString() || null,
        retailer_name: retailerData.data?.name || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('[LS-CALLBACK] Database update error:', updateError.message);
      throw new Error('Failed to save connection: ' + updateError.message);
    }

    console.log('[LS-CALLBACK] ✅ Connection saved successfully!');
    console.log('[LS-CALLBACK] ==========================================');

    return new Response(
      JSON.stringify({ 
        success: true,
        retailer: {
          id: retailerData.data?.id,
          name: retailerData.data?.name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LS-CALLBACK] ❌ Error:', error.message);
    console.error('[LS-CALLBACK] Stack:', error.stack);
    console.log('[LS-CALLBACK] ==========================================');
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'OAuth callback failed',
        details: error.stack
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
