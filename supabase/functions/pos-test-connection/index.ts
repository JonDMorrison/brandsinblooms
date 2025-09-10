import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dynamic adapter imports
async function getAdapter(platform: string, credentials: any) {
  switch (platform.toLowerCase()) {
    case 'mock':
      const { MockAdapter } = await import('../../../src/components/crm/pos/adapters/MockAdapter.ts');
      return new MockAdapter();
    case 'vmx':
      const { VMXAdapter } = await import('../../../src/components/crm/pos/adapters/VMXAdapter.ts');
      return new VMXAdapter();
    case 'shopify':
      const { ShopifyAdapter } = await import('../../../src/components/crm/pos/adapters/ShopifyAdapter.ts');
      return new ShopifyAdapter(credentials.shop_domain, credentials.access_token);
    case 'square':
      const { SquareAdapter } = await import('../../../src/components/crm/pos/adapters/SquareAdapter.ts');
      return new SquareAdapter(credentials.access_token, credentials.environment || 'production');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const body = await req.json();
    const { connection_id, credentials, platform } = body;

    console.log('Testing POS connection:', { platform, connection_id });

    // Get the adapter for the platform
    const adapter = await getAdapter(platform, credentials);
    
    // Test the connection
    const testResult = await adapter.testConnection(credentials);

    // Update connection status if connection_id is provided
    if (connection_id && testResult.success) {
      const { error: updateError } = await supabase
        .from('pos_connections')
        .update({ 
          status: 'connected',
          updated_at: new Date().toISOString()
        })
        .eq('id', connection_id)
        .eq('tenant_id', userData.tenant_id);

      if (updateError) {
        console.error('Failed to update connection status:', updateError);
      }
    }

    console.log('Connection test result:', testResult);

    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: testResult.success ? 200 : 400,
    });

  } catch (error) {
    console.error('Error testing POS connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});