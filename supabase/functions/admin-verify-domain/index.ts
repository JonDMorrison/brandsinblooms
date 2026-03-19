import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { domain, domain_id, action, default_from_name, default_from_email, tenant_id } = await req.json();

    console.log(`🔧 Admin domain action: ${action} for ${domain || domain_id}`);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Handle 'register' action separately — domain may not exist yet
    if (action === 'register') {
      if (!domain || !tenant_id) {
        return new Response(JSON.stringify({ error: 'domain and tenant_id required for register' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!resendApiKey) {
        return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const resend = new Resend(resendApiKey);
      const domainName = domain.toLowerCase().trim();

      // Check if already exists in our DB
      const { data: existing } = await supabase
        .from('email_domains')
        .select('*')
        .eq('domain', domainName)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (existing?.resend_domain_id) {
        // Already registered — just return status
        const { data: resendData } = await resend.domains.get(existing.resend_domain_id);
        return new Response(JSON.stringify({
          success: true,
          message: 'Domain already registered',
          domain: existing,
          resend_status: resendData
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check Resend for existing domain
      let resendDomainId: string;
      let resendDomainData: any = null;

      const { data: resendDomains } = await resend.domains.list();
      const existingResend = resendDomains?.data?.find((d: any) => d.name === domainName);

      if (existingResend) {
        resendDomainId = existingResend.id;
        console.log(`✅ Found existing Resend domain: ${resendDomainId}`);
      } else {
        console.log(`📧 Creating new domain in Resend: ${domainName}`);
        const { data: createResult, error: createError } = await resend.domains.create({
          name: domainName,
          region: 'us-east-1'
        });
        if (createError || !createResult) {
          return new Response(JSON.stringify({ error: 'Failed to create domain in Resend', details: createError }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        resendDomainId = createResult.id;
        console.log(`✅ Created Resend domain: ${resendDomainId}`);

        // Enable tracking
        try {
          await resend.domains.update({ id: resendDomainId, openTracking: true, clickTracking: true });
        } catch (_e) { /* non-fatal */ }
      }

      // Fetch domain details
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: domainDetails } = await resend.domains.get(resendDomainId);
      resendDomainData = domainDetails;

      // Upsert into our DB
      if (existing) {
        await supabase.from('email_domains').update({
          resend_domain_id: resendDomainId,
          status: 'verifying',
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await supabase.from('email_domains').insert({
          tenant_id,
          domain: domainName,
          env: 'prod',
          is_sandbox: false,
          resend_domain_id: resendDomainId,
          status: 'verifying',
          default_from_name: default_from_name || null,
          default_from_email: default_from_email || null
        });
      }

      // Fetch the final record
      const { data: finalDomain } = await supabase
        .from('email_domains')
        .select('*')
        .eq('domain', domainName)
        .eq('tenant_id', tenant_id)
        .single();

      // Save DNS records
      if (resendDomainData?.records && finalDomain) {
        await supabase.from('email_dns_records').delete().eq('email_domain_id', finalDomain.id);
        const inserts = resendDomainData.records
          .filter((r: any) => !r.name?.includes('_dmarc'))
          .map((r: any) => ({
            email_domain_id: finalDomain.id,
            name: r.name || '',
            type: r.record_type || r.type || 'TXT',
            value: r.value || r.data || '',
            priority: r.priority || null,
            purpose: r.name?.includes('_domainkey') ? 'dkim' : r.type === 'MX' ? 'mx' : r.value?.includes('spf') ? 'spf' : 'verification',
            required: true,
            source: 'resend'
          }));
        if (inserts.length > 0) {
          await supabase.from('email_dns_records').insert(inserts);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Domain ${domainName} registered in Resend`,
        domain: finalDomain,
        resend_status: resendDomainData,
        dns_records: resendDomainData?.records || []
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find the domain for other actions
    let emailDomain;
    if (domain_id) {
      const { data, error } = await supabase
        .from('email_domains')
        .select('*')
        .eq('id', domain_id)
        .single();
      if (error) throw new Error(`Domain not found: ${error.message}`);
      emailDomain = data;
    } else if (domain) {
      const { data, error } = await supabase
        .from('email_domains')
        .select('*')
        .eq('domain', domain)
        .single();
      if (error) throw new Error(`Domain not found: ${error.message}`);
      emailDomain = data;
    } else {
      return new Response(JSON.stringify({ error: 'domain or domain_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found domain: ${emailDomain.domain} (${emailDomain.id})`);

    // Verify with Resend if domain has a Resend ID
    const resendApiKey2 = Deno.env.get('RESEND_API_KEY');
    let resendStatus = null;

    if (emailDomain.resend_domain_id && resendApiKey2) {
      const resend = new Resend(resendApiKey2);

      // Trigger Resend verification
      console.log(`📧 Triggering Resend verification for ${emailDomain.resend_domain_id}`);
      try {
        await resend.domains.verify(emailDomain.resend_domain_id);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: domainStatus } = await resend.domains.get(emailDomain.resend_domain_id);
        resendStatus = domainStatus;
        console.log(`✅ Resend status: ${domainStatus?.status}`);
      } catch (err: any) {
        console.log(`⚠️ Resend verification error: ${err.message}`);
      }
    }

    if (action === 'verify-and-activate') {
      // Update domain to active status
      const updateData: any = {
        status: 'active',
        verified_at: new Date().toISOString(),
        error: null,
        last_verify_error: null,
        updated_at: new Date().toISOString()
      };

      if (default_from_name) {
        updateData.default_from_name = default_from_name;
      }
      if (default_from_email) {
        updateData.default_from_email = default_from_email;
      }

      const { data: updatedDomain, error: updateError } = await supabase
        .from('email_domains')
        .update(updateData)
        .eq('id', emailDomain.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update domain: ${updateError.message}`);
      }

      console.log(`✅ Domain ${emailDomain.domain} activated successfully`);

      return new Response(JSON.stringify({
        success: true,
        message: `Domain ${emailDomain.domain} is now active`,
        domain: updatedDomain,
        resend_status: resendStatus
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-status') {
      return new Response(JSON.stringify({
        success: true,
        domain: emailDomain,
        resend_status: resendStatus
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Admin domain error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
