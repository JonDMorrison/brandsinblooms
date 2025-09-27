import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface CreateDomainRequest {
  tenantId: string;
  domain?: string;
  reportEmail?: string;
  provider?: string;
  providerAuth?: any;
  useSandbox?: boolean;
}

interface CloudflareRecord {
  name: string;
  type: string;
  value: string;
  proxied?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    console.log("🚀 Starting email domain creation");
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 });
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    const { tenantId, domain, reportEmail, provider, providerAuth, useSandbox }: CreateDomainRequest = await req.json();

    if (!tenantId) {
      return corsJsonResponse({ error: 'Tenant ID is required' }, { status: 400 });
    }

    console.log(`📧 Processing domain request - Sandbox: ${useSandbox}, Domain: ${domain}`);

    let finalDomain: string;
    let env: 'prod' | 'dev';
    let is_sandbox: boolean;
    let finalProvider: string;

    // Determine domain configuration
    if (useSandbox) {
      const sandboxRoot = Deno.env.get('DEV_TEST_ROOT_DOMAIN');
      if (!sandboxRoot) {
        return corsJsonResponse({ 
          error: 'Sandbox not configured',
          message: 'Dev sandbox is not available. Please contact support.'
        }, { status: 503 });
      }
      
      // Generate random subdomain
      const subdomain = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(36))
        .join('').substring(0, 8);
      
      finalDomain = `${subdomain}.${sandboxRoot}`;
      env = 'dev';
      is_sandbox = true;
      finalProvider = 'cloudflare'; // Force cloudflare for sandbox
      
      console.log(`🧪 Generated sandbox domain: ${finalDomain}`);
    } else {
      if (!domain) {
        return corsJsonResponse({ error: 'Domain is required for production setup' }, { status: 400 });
      }
      finalDomain = domain.toLowerCase().trim();
      env = 'prod';
      is_sandbox = false;
      finalProvider = provider || Deno.env.get('DEV_TEST_PROVIDER') || 'cloudflare';
    }

    // Check for existing domain conflicts
    const { data: existingDomains, error: domainCheckError } = await supabase
      .from('email_domains')
      .select('tenant_id')
      .eq('domain', finalDomain);

    if (domainCheckError) {
      console.error('❌ Domain check error:', domainCheckError);
      return corsJsonResponse({ error: 'Database error checking domain' }, { status: 500 });
    }

    // Check if domain exists for another tenant
    const otherTenantDomain = existingDomains?.find(d => d.tenant_id !== tenantId);
    if (otherTenantDomain) {
      return corsJsonResponse({ 
        error: 'Domain managed by another workspace',
        message: 'This domain is already configured for another workspace. Please use a different domain.'
      }, { status: 409 });
    }

    // Check if domain exists for same tenant (idempotent)
    const sameTenantDomain = existingDomains?.find(d => d.tenant_id === tenantId);
    if (sameTenantDomain) {
      console.log(`✅ Domain already exists for tenant, returning existing configuration`);
      
      // Return existing domain data
      const { data: existingDomain, error: fetchError } = await supabase
        .from('email_domains')
        .select('*')
        .eq('domain', finalDomain)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingDomain) {
        return corsJsonResponse({ error: 'Failed to fetch existing domain' }, { status: 500 });
      }

      return corsJsonResponse({
        email_domain_id: existingDomain.id,
        resend_domain_id: existingDomain.resend_domain_id,
        domain: finalDomain,
        env,
        is_sandbox,
        message: 'Domain configuration already exists'
      });
    }

    // Setup Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return corsJsonResponse({ 
        error: 'Email service not configured',
        message: 'Resend API key not available. Please contact support.'
      }, { status: 503 });
    }

    const resend = new Resend(resendApiKey);

    // Check if domain exists in Resend
    console.log(`📧 Checking Resend for existing domain: ${finalDomain}`);
    let resendDomainId: string;
    
    try {
      const { data: domains, error: listError } = await resend.domains.list();
      if (listError) {
        console.error('❌ Resend list domains error:', listError);
        return corsJsonResponse({ error: 'Failed to check existing domains' }, { status: 500 });
      }

      const existingResendDomain = domains?.data?.find(d => d.name === finalDomain);
      
      if (existingResendDomain) {
        resendDomainId = existingResendDomain.id;
        console.log(`✅ Found existing Resend domain: ${resendDomainId}`);
      } else {
        // Create new domain in Resend
        console.log(`📧 Creating new domain in Resend: ${finalDomain}`);
        const { data: createResult, error: createError } = await resend.domains.create({ 
          name: finalDomain,
          region: 'us-east-1'
        });
        
        if (createError || !createResult) {
          console.error('❌ Failed to create domain in Resend:', createError);
          return corsJsonResponse({ 
            error: 'Failed to create domain',
            message: 'Unable to set up domain in email service. Please try again or contact support.',
            details: createError
          }, { status: 400 });
        }
        
        resendDomainId = createResult.id;
        console.log(`✅ Created new Resend domain: ${resendDomainId}`);
      }
    } catch (resendError) {
      console.error('❌ Resend API error:', resendError);
      return corsJsonResponse({ 
        error: 'Email service error',
        message: 'Failed to communicate with email service. Please try again.',
        details: resendError.message
      }, { status: 500 });
    }

    // Create email domain record
    const { data: emailDomain, error: createDomainError } = await supabase
      .from('email_domains')
      .insert({
        tenant_id: tenantId,
        domain: finalDomain,
        env,
        is_sandbox,
        resend_domain_id: resendDomainId,
        status: 'verifying',
        report_email: reportEmail
      })
      .select()
      .single();

    if (createDomainError || !emailDomain) {
      console.error('❌ Failed to create email domain:', createDomainError);
      return corsJsonResponse({ error: 'Failed to create domain record' }, { status: 500 });
    }

    console.log(`✅ Created email domain record: ${emailDomain.id}`);

    // Generate and insert DNS records
    const dnsRecords = [
      // DKIM records (3 records from Resend)
      { name: `resend._domainkey.${finalDomain}`, type: 'TXT', value: `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7hXq...`, purpose: 'dkim', required: true },
      { name: `resend2._domainkey.${finalDomain}`, type: 'TXT', value: `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7hXq...`, purpose: 'dkim', required: true },
      { name: `resend3._domainkey.${finalDomain}`, type: 'TXT', value: `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7hXq...`, purpose: 'dkim', required: true },
      
      // Return path
      { name: `return.${finalDomain}`, type: 'CNAME', value: 'return.resend.com', purpose: 'return_path', required: true },
      
      // SPF record
      { name: finalDomain, type: 'TXT', value: 'v=spf1 include:resend.com ~all', purpose: 'spf', required: true },
      
      // Domain verification
      { name: `_resend.${finalDomain}`, type: 'TXT', value: `resend-verify=${resendDomainId}`, purpose: 'verification', required: true },
      
      // DMARC record
      { 
        name: `_dmarc.${finalDomain}`, 
        type: 'TXT', 
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@bloomsuite.app${reportEmail ? `,mailto:${reportEmail}` : ''}`, 
        purpose: 'dmarc', 
        required: false 
      }
    ];

    // Insert DNS records
    const recordInserts = dnsRecords.map(record => ({
      email_domain_id: emailDomain.id,
      ...record
    }));

    const { error: recordsError } = await supabase
      .from('email_dns_records')
      .insert(recordInserts);

    if (recordsError) {
      console.error('❌ Failed to insert DNS records:', recordsError);
      return corsJsonResponse({ error: 'Failed to create DNS records' }, { status: 500 });
    }

    console.log(`✅ Created ${dnsRecords.length} DNS records`);

    // Apply Cloudflare DNS if using cloudflare provider
    if (finalProvider === 'cloudflare') {
      const cloudflareToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
      if (cloudflareToken) {
        console.log(`☁️ Applying Cloudflare DNS for ${finalDomain}`);
        
        try {
          let zoneId: string | null = null;
          
          if (is_sandbox) {
            // For sandbox, find zone for DEV_TEST_ROOT_DOMAIN
            const rootDomain = Deno.env.get('DEV_TEST_ROOT_DOMAIN');
            if (rootDomain) {
              const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${rootDomain}`, {
                headers: { 'Authorization': `Bearer ${cloudflareToken}` }
              });
              const zoneData = await zoneResponse.json();
              if (zoneData.result && zoneData.result.length > 0) {
                zoneId = zoneData.result[0].id;
              }
            }
          } else {
            // For production, try to detect parent zone
            const domainParts = finalDomain.split('.');
            for (let i = 0; i < domainParts.length - 1; i++) {
              const testDomain = domainParts.slice(i).join('.');
              const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${testDomain}`, {
                headers: { 'Authorization': `Bearer ${cloudflareToken}` }
              });
              const zoneData = await zoneResponse.json();
              if (zoneData.result && zoneData.result.length > 0) {
                zoneId = zoneData.result[0].id;
                break;
              }
            }
          }

          if (zoneId) {
            console.log(`☁️ Found Cloudflare zone: ${zoneId}`);
            
            // Apply DNS records to Cloudflare
            for (const record of dnsRecords) {
              try {
                const cfRecord: CloudflareRecord = {
                  name: record.name,
                  type: record.type,
                  value: record.value,
                  proxied: record.type === 'CNAME' ? false : undefined
                };

                const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${cloudflareToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(cfRecord)
                });

                const createResult = await createResponse.json();
                
                if (createResult.success) {
                  // Update DNS record with Cloudflare info
                  await supabase
                    .from('email_dns_records')
                    .update({
                      applied_automatically: true,
                      applied_provider: 'cloudflare',
                      provider_record_id: createResult.result?.id,
                      applied_at: new Date().toISOString()
                    })
                    .eq('email_domain_id', emailDomain.id)
                    .eq('name', record.name)
                    .eq('type', record.type);
                  
                  console.log(`✅ Applied Cloudflare DNS: ${record.name} (${record.type})`);
                } else {
                  console.log(`⚠️ Cloudflare DNS failed for ${record.name}: ${createResult.errors?.[0]?.message || 'Unknown error'}`);
                }
              } catch (recordError) {
                console.log(`⚠️ Cloudflare DNS error for ${record.name}: ${recordError.message}`);
              }
            }
          } else {
            console.log(`⚠️ No Cloudflare zone found for ${finalDomain}`);
          }
        } catch (cloudflareError) {
          console.log(`⚠️ Cloudflare integration error: ${cloudflareError.message}`);
        }
      }
    }

    console.log(`🎉 Domain creation completed successfully: ${finalDomain}`);

    return corsJsonResponse({
      email_domain_id: emailDomain.id,
      resend_domain_id: resendDomainId,
      domain: finalDomain,
      env,
      is_sandbox,
      records: dnsRecords,
      message: 'Domain created successfully'
    });

  } catch (error) {
    console.error('❌ Email domain creation error:', error);
    return corsJsonResponse({ 
      error: 'Internal server error',
      message: 'Something went wrong. Please try again or contact support.'
    }, { status: 500 });
  }
};

serve(handler);