import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJsonResponse, handleCorsPrelight } from '../_shared/cors.ts';
import { requireImportTenant } from '../_shared/customer-intelligence/import-access.ts';

const SHOPIFY_SCOPES = [
  'read_customers',
  'read_orders',
  'read_products',
  'read_inventory',
  'read_fulfillments',
].join(',');

function normalizeShopDomain(shopDomain: string) {
  const trimmed = shopDomain.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (withoutProtocol.endsWith('.myshopify.com')) {
    return withoutProtocol;
  }

  return `${withoutProtocol}.myshopify.com`;
}

function isValidShopifyDomain(shopDomain: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain);
}

Deno.serve(async (req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'No authorization header' }, { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!serviceRoleKey) {
      return corsJsonResponse({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return corsJsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connecting Shopify replaces the tenant's connection: integrations.manage only (crm-r2-F96).
    let tenantId: string;
    try {
      tenantId = await requireImportTenant(supabase);
    } catch {
      return corsJsonResponse({ error: 'Integration management permission required' }, { status: 403 });
    }

    const { shop_domain } = await req.json();
    const normalizedDomain = normalizeShopDomain(shop_domain ?? '');

    if (!isValidShopifyDomain(normalizedDomain)) {
      return corsJsonResponse(
        {
          error:
            'Please enter a valid Shopify store domain (for example, mystore.myshopify.com).',
        },
        { status: 400 },
      );
    }

    // A shop connected to another tenant stays with that tenant (crm-r2-F99): webhooks are routed by shop alone.
    const { data: heldElsewhere, error: heldError } = await supabaseAdmin
      .from('shopify_connections')
      .select('id')
      .eq('shop_domain', normalizedDomain)
      .eq('status', 'connected')
      .neq('tenant_id', tenantId)
      .limit(1);

    if (heldError) {
      return corsJsonResponse({ error: 'Failed to check the Shopify store' }, { status: 500 });
    }

    if (heldElsewhere && heldElsewhere.length > 0) {
      return corsJsonResponse(
        { error: 'This Shopify store is already connected to another BloomSuite account.' },
        { status: 409 },
      );
    }

    const shopifyClientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    if (!shopifyClientId) {
      return corsJsonResponse(
        { error: 'SHOPIFY_CLIENT_ID is not configured' },
        { status: 500 },
      );
    }

    const stateToken = crypto.randomUUID();

    const { error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .insert({
        state_token: stateToken,
        tenant_id: tenantId,
        user_id: user.id,
        provider: 'shopify',
        domain_prefix: normalizedDomain,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) {
      return corsJsonResponse(
        { error: 'Failed to initialize Shopify OAuth state' },
        { status: 500 },
      );
    }

    const { error: connectionError } = await supabaseAdmin
      .from('shopify_connections')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: user.id,
          shop_domain: normalizedDomain,
          status: 'pending',
          encrypted_access_token: 'pending',
        },
        { onConflict: 'tenant_id,shop_domain' },
      );

    if (connectionError) {
      await supabaseAdmin.from('oauth_states').delete().eq('state_token', stateToken);
      return corsJsonResponse(
        { error: `Failed to create pending Shopify connection: ${connectionError.message}` },
        { status: 500 },
      );
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-oauth-callback`;
    const authUrl = new URL(`https://${normalizedDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', shopifyClientId);
    authUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateToken);

    return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    return corsJsonResponse({ error: error.message }, { status: 400 });
  }
});