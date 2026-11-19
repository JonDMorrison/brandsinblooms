import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // central-login 59 (crm-r2-F54): a signed-in caller, whose own token must see the sending-domain row (RLS on
    // email_domains), before the service-role status read.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { domain_id } = await req.json();

    if (!domain_id) {
      console.error('[get-deliverability-status] Missing domain_id');
      return new Response(
        JSON.stringify({ error: 'domain_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: visibleDomain, error: visibleError } = await callerClient
      .from('email_domains')
      .select('id')
      .eq('id', domain_id)
      .maybeSingle();
    if (visibleError || !visibleDomain) {
      return new Response(
        JSON.stringify({ error: 'You do not have access to this domain' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-deliverability-status] Fetching status for domain: ${domain_id}`);

    // Call the RPC function for deliverability status
    const { data, error } = await supabase.rpc('get_deliverability_status', {
      p_domain_id: domain_id,
    });

    if (error) {
      console.error('[get-deliverability-status] RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-deliverability-status] Status: ${data?.status}, Warnings: ${data?.warnings?.length || 0}`);

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[get-deliverability-status] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
