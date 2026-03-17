import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

interface EntriCallbackRequest {
  accountId: string;
  domain: string;
  entriConnectionId: string;
  entriProvider: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: EntriCallbackRequest = await req.json();
    const { accountId, domain, entriConnectionId, entriProvider } = body;

    const normalizedDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^(https?:\/\/)?(www\.)?/, '');

    console.log('Entri callback received:', { accountId, domain: normalizedDomain, entriProvider });

    // Validate required fields
    if (!accountId || !normalizedDomain || !entriConnectionId || !entriProvider) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: accountId, domain, entriConnectionId, entriProvider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this tenant (users table is the source of truth)
    const { data: tenantUser, error: tenantUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .eq('tenant_id', accountId)
      .maybeSingle();

    if (tenantUserError || !tenantUser) {
      console.error('Tenant access check failed:', tenantUserError);
      return new Response(
        JSON.stringify({ error: 'Access denied to this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if domain already exists
    const { data: existingDomain, error: fetchError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('tenant_id', accountId)
      .eq('domain', normalizedDomain)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing domain:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let domainRecord;

    if (existingDomain) {
      // Update existing domain with Entri info
      const { data: updated, error: updateError } = await supabase
        .from('email_domains')
        .update({
          entri_connection_id: entriConnectionId,
          entri_provider: entriProvider,
          is_entri_managed: true,
          status: 'verifying',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDomain.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating domain:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update domain' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      domainRecord = updated;
      console.log('Updated existing domain with Entri info:', domainRecord.id);
    } else {
      // Create new domain record
      const { data: newDomain, error: insertError } = await supabase
        .from('email_domains')
        .insert({
          tenant_id: accountId,
          domain: normalizedDomain,
          entri_connection_id: entriConnectionId,
          entri_provider: entriProvider,
          is_entri_managed: true,
          status: 'verifying',
          total_sent_30d: 0,
          total_bounces_30d: 0,
          total_complaints_30d: 0,
          bounce_rate_30d: 0,
          complaint_rate_30d: 0,
          manual_pause: false
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating domain:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create domain record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      domainRecord = newDomain;
      console.log('Created new domain with Entri info:', domainRecord.id);
    }

    // If no Resend domain ID, provision one via the email-domain-create function
    if (!domainRecord.resend_domain_id) {
      console.log('Provisioning Resend domain for:', normalizedDomain);

      // Call the existing email-domain-create function internally
      // This will create the domain in Resend and update dns_records
      try {
        const { data: provisionData, error: provisionError } = await supabase.functions.invoke('email-domain-create', {
          body: {
            tenantId: accountId,
            domain: normalizedDomain,
            provider: 'entri',
            existingDomainId: domainRecord.id
          },
          // email-domain-create validates a *user* JWT; pass through the caller's auth
          headers: {
            Authorization: authHeader,
          },
        });

        if (provisionError) {
          console.warn('Resend provisioning warning (non-blocking):', provisionError);

          // Surface the error on the domain record so the UI can show it
          await supabase
            .from('email_domains')
            .update({
              status: 'error',
              error: provisionError.message || 'Resend provisioning failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', domainRecord.id);
        } else {
          console.log('Resend domain provisioned successfully');
        }
      } catch (provisionErr: any) {
        console.warn('Resend provisioning error (non-blocking):', provisionErr);

        await supabase
          .from('email_domains')
          .update({
            status: 'error',
            error: provisionErr?.message || 'Resend provisioning failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', domainRecord.id);
      }
    }

    // Fetch final state
    const { data: finalDomain, error: finalError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', domainRecord.id)
      .single();

    if (finalError) {
      console.error('Error fetching final domain state:', finalError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain: finalDomain || domainRecord,
        message: `Domain ${domain} configured via ${entriProvider}. Verification in progress.`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Entri callback error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
