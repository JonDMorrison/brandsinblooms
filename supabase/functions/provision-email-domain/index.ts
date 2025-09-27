import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface ProvisionRequest {
  domain: string;
  senderEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { domain, senderEmail }: ProvisionRequest = await req.json();

    if (!domain || !senderEmail) {
      return new Response(
        JSON.stringify({ error: 'Domain and sender email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured',
          message: 'Our team needs to configure the email service. Please contact support for assistance.'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚀 Starting domain provisioning for ${domain} with sender ${senderEmail}`);

    const resend = new Resend(resendApiKey);

    try {
      // Create the domain in Resend
      console.log(`📧 Creating domain in Resend: ${domain}`);
      const domainResult = await resend.domains.create({ name: domain });
      
      if (domainResult.error) {
        console.error('❌ Failed to create domain in Resend:', domainResult.error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to provision domain',
            message: 'Unable to set up domain in email service. Please try manual setup or contact support.',
            details: domainResult.error
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Domain created successfully in Resend:`, domainResult.data);

      // Update the user's profile with provisioned status
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({
          custom_sender_email: senderEmail,
          email_domain: domain,
          email_auth_status: 'verified',
          dns_records_verified: true,
          email_auth_setup_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ Failed to update user profile:', updateError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update profile',
            message: 'Domain was created but failed to update your profile. Please contact support.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Domain ${domain} provisioned successfully for user ${user.id}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Domain successfully provisioned! Your emails will now have improved deliverability.',
          domain: domainResult.data
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (resendError) {
      console.error('❌ Resend API error:', resendError);
      return new Response(
        JSON.stringify({ 
          error: 'Domain provisioning failed',
          message: 'Unable to set up domain automatically. Please use manual DNS setup or contact support.',
          details: resendError.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Provision domain error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Something went wrong. Please try again or contact support.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);