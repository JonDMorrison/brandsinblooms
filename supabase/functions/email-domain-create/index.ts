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
  existingDomainId?: string;
}

interface CloudflareRecord {
  name: string;
  type: string;
  content: string;
  proxied?: boolean;
  priority?: number;
  ttl?: number;
}

// Normalized DNS record from Resend
interface NormalizedDnsRecord {
  name: string;
  type: 'TXT' | 'CNAME' | 'MX';
  value: string;
  priority?: number;
  purpose: string;
  required: boolean;
  source: 'resend' | 'system';
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

    if (useSandbox) {
      const sandboxRoot = Deno.env.get('DEV_TEST_ROOT_DOMAIN');
      if (!sandboxRoot) {
        return corsJsonResponse({ 
          error: 'Sandbox not configured',
          message: 'Dev sandbox is not available. Please contact support.'
        }, { status: 503 });
      }
      
      const subdomain = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(36))
        .join('').substring(0, 8);
      
      finalDomain = `${subdomain}.${sandboxRoot}`;
      env = 'dev';
      is_sandbox = true;
      finalProvider = 'cloudflare';
      
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

    const otherTenantDomain = existingDomains?.find(d => d.tenant_id !== tenantId);
    if (otherTenantDomain) {
      return corsJsonResponse({ 
        error: 'Domain managed by another workspace',
        message: 'This domain is already configured for another workspace. Please use a different domain.'
      }, { status: 409 });
    }

    const sameTenantDomain = existingDomains?.find(d => d.tenant_id === tenantId);
    let existingDomainRecord: any | null = null;

    if (sameTenantDomain) {
      const { data: existingDomain, error: fetchError } = await supabase
        .from('email_domains')
        .select('*')
        .eq('domain', finalDomain)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingDomain) {
        return corsJsonResponse({ error: 'Failed to fetch existing domain' }, { status: 500 });
      }

      if (existingDomain.resend_domain_id) {
        console.log(`✅ Domain already exists for tenant, returning existing configuration`);
        return corsJsonResponse({
          email_domain_id: existingDomain.id,
          resend_domain_id: existingDomain.resend_domain_id,
          domain: finalDomain,
          env,
          is_sandbox,
          message: 'Domain configuration already exists'
        });
      }

      console.log(`⚠️ Domain exists but is missing Resend provisioning; continuing provisioning...`);
      existingDomainRecord = existingDomain;
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

    console.log(`📧 Checking Resend for existing domain: ${finalDomain}`);
    let resendDomainId: string;
    let resendDomainData: any = null;
    
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
        
        const { data: domainDetails, error: getError } = await resend.domains.get(resendDomainId);
        if (!getError && domainDetails) {
          resendDomainData = domainDetails;
          console.log(`📋 Fetched domain details with ${domainDetails.records?.length || 0} DNS records`);
        }
      } else {
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
        
        // Enable open and click tracking on the domain
        try {
          console.log(`📊 Enabling open and click tracking for domain ${resendDomainId}...`);
          const { data: updateResult, error: updateError } = await resend.domains.update({
            id: resendDomainId,
            openTracking: true,
            clickTracking: true
          });
          
          if (updateError) {
            console.warn(`⚠️ Failed to enable tracking (non-fatal):`, updateError);
          } else {
            console.log(`✅ Open and click tracking enabled for domain`);
          }
        } catch (trackingError) {
          console.warn(`⚠️ Failed to enable tracking (non-fatal):`, trackingError);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: domainDetails, error: getError } = await resend.domains.get(resendDomainId);
        if (!getError && domainDetails) {
          resendDomainData = domainDetails;
          console.log(`📋 Fetched new domain details with ${domainDetails.records?.length || 0} DNS records`);
        }
      }
    } catch (resendError) {
      console.error('❌ Resend API error:', resendError);
      return corsJsonResponse({ 
        error: 'Email service error',
        message: 'Failed to communicate with email service. Please try again.',
        details: resendError.message
      }, { status: 500 });
    }

    // Create or update email domain record
    let emailDomain: any | null = null;

    if (existingDomainRecord) {
      const { data: updatedDomain, error: updateError } = await supabase
        .from('email_domains')
        .update({
          env,
          is_sandbox,
          resend_domain_id: resendDomainId,
          status: 'verifying',
          report_email: reportEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDomainRecord.id)
        .select()
        .single();

      if (updateError || !updatedDomain) {
        console.error('❌ Failed to update existing email domain:', updateError);
        return corsJsonResponse({ error: 'Failed to update domain record' }, { status: 500 });
      }

      emailDomain = updatedDomain;
      console.log(`✅ Updated email domain record: ${emailDomain.id}`);

      await supabase
        .from('email_dns_records')
        .delete()
        .eq('email_domain_id', emailDomain.id);
    } else {
      const { data: createdDomain, error: createDomainError } = await supabase
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

      if (createDomainError || !createdDomain) {
        console.error('❌ Failed to create email domain:', createDomainError);
        return corsJsonResponse({ error: 'Failed to create domain record' }, { status: 500 });
      }

      emailDomain = createdDomain;
      console.log(`✅ Created email domain record: ${emailDomain.id}`);
    }

    // =========================================================
    // CRITICAL: Build DNS records from Resend API response EXACTLY
    // - Preserve MX priority
    // - DO NOT add synthetic CNAME for return-path
    // - Only use records Resend actually requires
    // =========================================================
    const dnsRecords: NormalizedDnsRecord[] = [];
    
    if (resendDomainData?.records && Array.isArray(resendDomainData.records)) {
      console.log(`📋 Processing ${resendDomainData.records.length} DNS records from Resend API`);
      console.log(`📋 Raw Resend records:`, JSON.stringify(resendDomainData.records, null, 2));
      
      for (const record of resendDomainData.records) {
        let purpose = 'verification';
        const recordType = record.record_type || record.type || 'TXT';
        const recordName = record.name || record.host || '';
        const recordValue = record.value || record.data || record.record || '';
        const recordPriority = record.priority; // Preserve MX priority from Resend
        
        // Determine purpose based on record characteristics
        if (recordType === 'MX') {
          purpose = 'mx';
        } else if (recordName?.includes('_domainkey') || recordName?.includes('dkim')) {
          purpose = 'dkim';
        } else if (recordValue?.includes('spf') || recordValue?.includes('v=spf1')) {
          purpose = 'spf';
        } else if (recordName?.includes('_dmarc')) {
          purpose = 'dmarc';
        } else if (recordType === 'CNAME' && !recordName?.includes('_domainkey')) {
          // CNAME that's not DKIM - could be return-path
          purpose = 'return_path';
        } else if (recordName?.includes('_resend')) {
          purpose = 'verification';
        }
        
        if (recordName && recordValue) {
          const normalized: NormalizedDnsRecord = {
            name: recordName,
            type: recordType as 'TXT' | 'CNAME' | 'MX',
            value: recordValue,
            purpose,
            required: purpose !== 'dmarc',
            source: 'resend'
          };
          
          // Preserve MX priority
          if (recordType === 'MX' && recordPriority !== undefined) {
            normalized.priority = recordPriority;
            console.log(`  ✓ MX ${recordName} (priority: ${recordPriority})`);
          } else {
            console.log(`  ✓ ${recordType} ${recordName} (${purpose})`);
          }
          
          dnsRecords.push(normalized);
        }
      }
    }
    
    // SAFETY: If Resend didn't return records, we ABORT - never use fallback
    // Fallback records could disrupt existing email configurations
    if (dnsRecords.length === 0) {
      console.error(`❌ No DNS records returned from Resend API. Aborting for safety.`);
      return corsJsonResponse({ 
        error: 'DNS configuration unavailable',
        message: 'Unable to retrieve DNS records from email provider. Please try again or use manual setup.',
        requiresManualSetup: true
      }, { status: 503 });
    }
    
    // SAFETY: Strip any DMARC records - we NEVER auto-configure root email policy
    // DMARC is informational only and must be set up manually by the client
    const originalCount = dnsRecords.length;
    const safeDnsRecords = dnsRecords.filter(r => {
      if (r.purpose === 'dmarc' || r.name.includes('_dmarc')) {
        console.log(`🛡️ Stripped DMARC record from response: ${r.name}`);
        return false;
      }
      return true;
    });
    
    if (safeDnsRecords.length < originalCount) {
      console.log(`🛡️ Removed ${originalCount - safeDnsRecords.length} DMARC record(s) for safety`);
    }
    
    // Replace the array with the safe version
    dnsRecords.length = 0;
    dnsRecords.push(...safeDnsRecords);
    
    // === CRITICAL: Do NOT add synthetic return-path CNAME ===
    // Resend's model uses MX + SPF TXT on the 'send' subdomain, not a CNAME
    // Adding a CNAME conflicts with MX/TXT records on the same hostname
    
    // Validate that we have required records
    const hasMx = dnsRecords.some(r => r.type === 'MX');
    const hasDkim = dnsRecords.some(r => r.purpose === 'dkim');
    const hasSpf = dnsRecords.some(r => r.purpose === 'spf' || (r.type === 'TXT' && r.value.includes('spf')));
    
    console.log(`📋 Final DNS record check: DKIM=${hasDkim}, SPF=${hasSpf}, MX=${hasMx}, DMARC=${hasDmarc || true}`);
    console.log(`📋 Total records to save: ${dnsRecords.length}`);

    // Insert DNS records (including priority)
    const recordInserts = dnsRecords.map(record => ({
      email_domain_id: emailDomain.id,
      name: record.name,
      type: record.type,
      value: record.value,
      priority: record.priority || null,
      purpose: record.purpose,
      required: record.required,
      source: record.source
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
            
            for (const record of dnsRecords) {
              try {
                const cfRecord: CloudflareRecord = {
                  name: record.name,
                  type: record.type,
                  content: record.value,
                  ttl: 3600
                };
                
                // Add priority for MX records
                if (record.type === 'MX' && record.priority !== undefined) {
                  cfRecord.priority = record.priority;
                }
                
                // CNAME records should not be proxied for email
                if (record.type === 'CNAME') {
                  cfRecord.proxied = false;
                }

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
                  
                  console.log(`✅ Applied Cloudflare DNS: ${record.name} (${record.type}${record.priority ? ` priority:${record.priority}` : ''})`);
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

    // Return records with priority for frontend
    const responseRecords = dnsRecords.map(r => ({
      name: r.name,
      type: r.type,
      value: r.value,
      priority: r.priority,
      purpose: r.purpose,
      required: r.required
    }));

    return corsJsonResponse({
      email_domain_id: emailDomain.id,
      resend_domain_id: resendDomainId,
      domain: finalDomain,
      env,
      is_sandbox,
      records: responseRecords,
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
