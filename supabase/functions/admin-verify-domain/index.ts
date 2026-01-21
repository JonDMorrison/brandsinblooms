import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";

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
    const { domain, domain_id, action, default_from_name, default_from_email } = await req.json();
    
    console.log(`🔧 Admin domain action: ${action} for ${domain || domain_id}`);

    // Find the domain
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    let resendStatus = null;

    if (emailDomain.resend_domain_id && resendApiKey) {
      const resend = new Resend(resendApiKey);
      
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
        warmup_stage: 4,
        warmup_started_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        daily_limit: 2000,
        hourly_limit: 500,
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
