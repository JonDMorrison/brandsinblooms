import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Public endpoint to fetch form configuration by embed_key
 * No authentication required - forms are publicly embeddable
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const embedKey = url.searchParams.get('embed_key');

    if (!embedKey) {
      return new Response(
        JSON.stringify({ error: 'embed_key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate embed_key format (should be 32-char hex)
    if (!/^[a-f0-9]{32}$/i.test(embedKey)) {
      return new Response(
        JSON.stringify({ error: 'Invalid embed_key format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find form by embed_key and ensure it's published
    const { data: form, error } = await supabase
      .from('forms')
      .select('tenant_id, fields_json, settings_json, compliance_json, name')
      .eq('embed_key', embedKey)
      .eq('status', 'published')
      .single();

    if (error || !form) {
      console.log(`[get-form-config] Form not found for embed_key: ${embedKey}`);
      return new Response(
        JSON.stringify({ error: 'Form not found or not published' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return form config (no secrets exposed)
    return new Response(
      JSON.stringify({
        success: true,
        form: {
          name: form.name,
          tenant_id: form.tenant_id,
          fields: form.fields_json,
          settings: form.settings_json,
          compliance: form.compliance_json,
        },
      }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        } 
      }
    );

  } catch (error) {
    console.error('[get-form-config] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
