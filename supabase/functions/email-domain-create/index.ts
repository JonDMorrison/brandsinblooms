
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface CreateDomainRequest {
  tenantId: string;
  domain: string;
  reportEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`📋 Incoming request: ${req.method} ${req.url}`);
    console.log(`📋 Headers:`, Object.fromEntries(req.headers.entries()));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    let requestBody;
    try {
      requestBody = await req.json();
      console.log(`📝 Raw request body:`, requestBody);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId, domain, reportEmail }: CreateDomainRequest = requestBody;
    
    console.log(`📝 Parsed request:`, { tenantId, domain, reportEmail });

    if (!tenantId || !domain) {
      return new Response(
        JSON.stringify({ error: 'TenantId and domain are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format if provided
    const isValidEmail = (email?: string) => {
      if (!email) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const validatedReportEmail = isValidEmail(reportEmail) ? reportEmail : undefined;

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

    console.log(`🚀 Creating email domain: ${domain} for tenant: ${tenantId}`);

    const resend = new Resend(resendApiKey);

    try {
      console.log(`🔍 Attempting to create domain in Resend: ${domain}`);
      
      // Create the domain in Resend (Resend will handle duplicates gracefully)
      const domainResult = await resend.domains.create({ 
        name: domain,
        region: 'us-east-1'
      });
      
      console.log(`📝 Resend API response:`, JSON.stringify(domainResult, null, 2));
      
      if (domainResult.error) {
        console.error('❌ Failed to create domain in Resend:', domainResult.error);
        
        // Handle specific Resend error cases
        if (domainResult.error.message?.includes('already exists')) {
          console.log('⚠️ Domain already exists, attempting to retrieve existing domain info');
          // Try to get the existing domain
          try {
            const existingDomain = await resend.domains.get(domain);
            if (existingDomain.data) {
              console.log('✅ Using existing domain:', existingDomain.data);
              // Use the existing domain data instead
              domainResult.data = existingDomain.data;
              domainResult.error = null;
            }
          } catch (getError) {
            console.error('❌ Could not retrieve existing domain:', getError);
          }
        }
        
        // If we still have an error after trying to handle it
        if (domainResult.error) {
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create domain',
              message: `Unable to set up domain in email service: ${domainResult.error.message || 'Unknown error'}`,
              details: domainResult.error
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`✅ Domain created successfully in Resend:`, domainResult.data);

      // Insert the email domain record
      const { data: emailDomain, error: domainError } = await supabase
        .from('email_domains')
        .upsert({
          tenant_id: tenantId,
          domain: domain,
          resend_domain_id: domainResult.data?.id,
          status: 'verifying',
          report_email: validatedReportEmail,
          error: null
        }, {
          onConflict: 'tenant_id,domain'
        })
        .select()
        .single();

      console.log(`📝 Database upsert result:`, { emailDomain, domainError });

      if (domainError) {
        console.error('❌ Failed to insert email domain:', domainError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to save domain configuration',
            message: 'Domain was created but failed to save configuration. Please contact support.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clear existing DNS records for this domain
      await supabase
        .from('email_dns_records')
        .delete()
        .eq('email_domain_id', emailDomain.id);

      // Insert DNS records from Resend response
      const dnsRecords = [];
      
      if (domainResult.data?.records) {
        for (const record of domainResult.data.records) {
          let purpose = 'verification';
          if (record.name?.includes('_domainkey')) {
            purpose = 'dkim';
          } else if (record.name === domain || record.name === '@') {
            if (record.value?.includes('v=spf1')) {
              purpose = 'spf';
            }
          } else if (record.name?.includes('mail')) {
            purpose = 'return-path';
          }

          dnsRecords.push({
            email_domain_id: emailDomain.id,
            name: record.name || '@',
            type: record.type || 'TXT',
            value: record.value || '',
            required: true,
            purpose: purpose
          });
        }
      }

      // Add DMARC record with dual delivery
      const defaultRua = Deno.env.get('DMARC_REPORT_EMAIL') ?? 'dmarc@bloomsuite.app';
      const ruaParts = [`mailto:${defaultRua}`];
      
      if (validatedReportEmail) {
        ruaParts.push(`mailto:${validatedReportEmail}`);
      }

      const rua = ruaParts.join(',');
      const dmarcValue = `v=DMARC1; p=none; rua=${rua}; fo=1`;

      dnsRecords.push({
        email_domain_id: emailDomain.id,
        name: '_dmarc',
        type: 'TXT',
        value: dmarcValue,
        required: true,
        purpose: 'dmarc'
      });

      // Insert all DNS records
      const { error: recordsError } = await supabase
        .from('email_dns_records')
        .insert(dnsRecords);

      if (recordsError) {
        console.error('❌ Failed to insert DNS records:', recordsError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to save DNS configuration',
            message: 'Domain was created but DNS records could not be saved. Please contact support.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the complete records for response
      const { data: savedRecords } = await supabase
        .from('email_dns_records')
        .select('*')
        .eq('email_domain_id', emailDomain.id);

      console.log(`✅ Email domain ${domain} created successfully for tenant ${tenantId}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          domain: emailDomain,
          records: savedRecords || [],
          status: 'verifying',
          message: 'Domain created successfully! Please add the DNS records to verify ownership.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (resendError) {
      console.error('❌ Resend API error:', resendError);
      return new Response(
        JSON.stringify({ 
          error: 'Domain creation failed',
          message: 'Unable to set up domain automatically. Please try again or contact support.',
          details: resendError.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Create email domain error:', error);
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
