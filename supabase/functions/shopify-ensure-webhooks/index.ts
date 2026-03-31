import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJsonResponse, handleCorsPrelight } from '../_shared/cors.ts';
import { ensureShopifyWebhooks } from '../_shared/webhooks/ensureShopifyWebhooks.ts';

Deno.serve(async (req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { shop_domain, tenant_id } = await req.json();

    if (!shop_domain || !tenant_id) {
      return corsJsonResponse(
        { success: false, error: 'shop_domain and tenant_id are required' },
        { status: 400 },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data: connection, error: connectionError } = await supabase
      .from('shopify_connections')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('shop_domain', shop_domain)
      .single();

    if (connectionError || !connection) {
      return corsJsonResponse(
        { success: false, error: 'Shopify connection not found' },
        { status: 404 },
      );
    }

    const result = await ensureShopifyWebhooks(supabase, connection.id);
    return corsJsonResponse(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error('[SHOPIFY-ENSURE-WEBHOOKS] Error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});