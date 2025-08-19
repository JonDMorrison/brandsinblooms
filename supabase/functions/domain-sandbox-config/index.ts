import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    console.log("🔧 Getting sandbox configuration");
    
    const enabled = Deno.env.get('ENABLE_DEV_SANDBOX') === 'true';
    const rootDomain = Deno.env.get('DEV_TEST_ROOT_DOMAIN');
    const provider = Deno.env.get('DEV_TEST_PROVIDER') || 'cloudflare';

    console.log(`📋 Sandbox config - Enabled: ${enabled}, Root: ${rootDomain}, Provider: ${provider}`);

    return corsJsonResponse({
      enabled,
      rootDomain,
      provider,
      message: enabled ? 'Sandbox testing available' : 'Sandbox testing disabled'
    });

  } catch (error) {
    console.error('❌ Sandbox config error:', error);
    return corsJsonResponse({ 
      error: 'Internal server error',
      message: 'Failed to get sandbox configuration'
    }, { status: 500 });
  }
};

serve(handler);