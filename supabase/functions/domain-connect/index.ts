import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DomainConnectRequest {
  domain: string;
  registrar?: string;
  templateId: string;
  params: Record<string, string>;
}

interface DomainConnectResponse {
  success: boolean;
  sessionToken?: string;
  redirectUrl?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create an authed client using the caller's JWT to identify the user
    const supabaseAuthed = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    if (req.method === 'POST') {
      const body = await req.json();
      const { domain, registrar, templateId, params }: DomainConnectRequest = body;

      // Allow status polling via POST override to support functions.invoke
      if (body?.method === 'GET') {
        const headerToken = req.headers.get('X-Session-Token') ?? '';
        const sessionToken = body.sessionToken ?? headerToken;
        if (!sessionToken) throw new Error('Session token required');

        const { data: session, error: pollError } = await supabaseAdmin
          .from('domain_connect_sessions')
          .select('*')
          .eq('session_token', sessionToken)
          .single();

        if (pollError) throw new Error(`Session not found: ${pollError.message}`);

        return new Response(
          JSON.stringify({ success: true, status: session.status, completedAt: session.completed_at }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Identify user to resolve tenant_id
      const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: user not found' }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
        );
      }

      // First try to get tenant from users table (authoritative)
      const { data: userRow, error: userRowError } = await supabaseAdmin
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      let tenantId = userRow?.tenant_id as string | null | undefined;

      // Fallback: derive tenant from latest campaign for this user
      if (!tenantId) {
        const { data: latestCampaign, error: tenantLookupError } = await supabaseAdmin
          .from('crm_campaigns')
          .select('tenant_id')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tenantLookupError) {
          console.warn('Tenant lookup fallback error:', tenantLookupError.message);
        }
        tenantId = latestCampaign?.tenant_id as string | null | undefined;
      }

      if (!tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: 'No tenant found for user; please complete onboarding.' }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
        );
      }

      // Get or create domain record
      let { data: domainRecord, error: domainError } = await supabaseAdmin
        .from('domains')
        .select('*')
        .eq('domain', domain)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (domainError) {
        throw new Error(`Error fetching domain: ${domainError.message}`);
      }

      // If domain doesn't exist, create it with tenant_id
      if (!domainRecord) {
        const domainType = 'custom'; // Use 'custom' type for user-configured domains
        const { data: newDomain, error: createError } = await supabaseAdmin
          .from('domains')
          .insert({
            tenant_id: tenantId,
            domain: domain,
            type: domainType,
            status: 'pending',
            dns_status: 'pending',
            tls_status: 'pending',
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create domain: ${createError.message}`);
        }

        domainRecord = newDomain;
      }

      // Generate session token
      const sessionToken = crypto.randomUUID();

      // Create Domain Connect session
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('domain_connect_sessions')
        .insert({
          domain_id: domainRecord.id,
          session_token: sessionToken,
          registrar_name: registrar,
          template_id: templateId,
          params: params,
          status: 'pending',
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create session: ${sessionError.message}`);
      }

      // Check if registrar supports Domain Connect
      const supportedRegistrars = [
        'godaddy',
        'namecheap', 
        'google',
        'cloudflare',
        '1and1',
        'hover',
        'enom',
        'network solutions',
        'tucows'
      ];

      // More permissive detection - if registrar is detected, check if it's supported
      // If no registrar is provided, assume Domain Connect is supported for testing
      const isDomainConnectSupported = !registrar || 
        supportedRegistrars.some((reg) => 
          registrar?.toLowerCase().includes(reg.toLowerCase())
        );

      if (!isDomainConnectSupported) {
        // Fallback to manual DNS instructions
        const response: DomainConnectResponse = {
          success: false,
          error: 'Domain Connect not supported by registrar. Manual DNS setup required.',
        };

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        });
      }

      // Generate Domain Connect URL
      try {
        const domainConnectUrl = await generateDomainConnectUrl(domain, registrar, templateId, params, sessionToken);

        const response: DomainConnectResponse = {
          success: true,
          sessionToken,
          redirectUrl: domainConnectUrl,
        };

        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (error) {
        // Handle manual DNS fallback case
        if ((error as Error).message === 'MANUAL_DNS_REQUIRED') {
          const response: DomainConnectResponse = {
            success: false,
            error: 'Domain Connect not supported. Manual DNS setup required.',
          };

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            status: 200,
          });
        }
        
        // Re-throw other errors to be handled by outer catch
        throw error;
      }
    }

    // GET request - check session status
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sessionToken = url.searchParams.get('session');

      if (!sessionToken) {
        throw new Error('Session token required');
      }

      const { data: session, error } = await supabaseAdmin
        .from('domain_connect_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .single();

      if (error) {
        throw new Error(`Session not found: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        status: session.status,
        completedAt: session.completed_at
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Domain Connect error:', error);
    const message = (error as any)?.message ?? 'Unknown error';
    const response: DomainConnectResponse = {
      success: false,
      error: message,
    };
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    });
  }
};

// Normalize domain by removing www. prefix
function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase();
}

// Query DNS for Domain Connect host using Cloudflare DNS-over-HTTPS
async function discoverDomainConnectHost(domain: string): Promise<string | null> {
  const normalizedDomain = normalizeDomain(domain);
  const dnsApiUrl = 'https://cloudflare-dns.com/dns-query';
  
  try {
    // First try TXT record lookup for _domainconnect
    const txtUrl = `${dnsApiUrl}?name=_domainconnect.${normalizedDomain}&type=TXT`;
    const txtResponse = await fetch(txtUrl, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (txtResponse.ok) {
      const txtData = await txtResponse.json();
      if (txtData.Answer && txtData.Answer.length > 0) {
        const txtRecord = txtData.Answer[0].data.replace(/"/g, '');
        // Parse TXT record for Domain Connect host
        const hostMatch = txtRecord.match(/host=([^;\s]+)/);
        if (hostMatch) {
          const rawHost = hostMatch[1].replace(/\.$/, ''); // strip trailing dot
          return `https://${rawHost}`;
        }
      }
    }
    
    // Fallback: try CNAME record lookup
    const cnameUrl = `${dnsApiUrl}?name=_domainconnect.${normalizedDomain}&type=CNAME`;
    const cnameResponse = await fetch(cnameUrl, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (cnameResponse.ok) {
      const cnameData = await cnameResponse.json();
      if (cnameData.Answer && cnameData.Answer.length > 0) {
        const cnameTarget = cnameData.Answer[0].data.replace(/\.$/, '');
        return `https://${cnameTarget}`;
      }
    }
    
    // No Domain Connect DNS records found
    return null;
    
  } catch (error) {
    console.warn('DNS discovery failed:', error);
    return null;
  }
}

// Infer registrar from NS records and get their Domain Connect host
async function inferRegistrarFromNS(domain: string): Promise<string | null> {
  const normalizedDomain = normalizeDomain(domain);
  const dnsApiUrl = 'https://cloudflare-dns.com/dns-query';
  
  try {
    const nsUrl = `${dnsApiUrl}?name=${normalizedDomain}&type=NS`;
    const nsResponse = await fetch(nsUrl, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (nsResponse.ok) {
      const nsData = await nsResponse.json();
      if (nsData.Answer && nsData.Answer.length > 0) {
        const nameserver = nsData.Answer[0].data.toLowerCase();
        
        // Map nameservers to Domain Connect hosts
        if (nameserver.includes('godaddy')) {
          return 'https://dcc.godaddy.com';
        } else if (nameserver.includes('namecheap')) {
          return 'https://www.namecheap.com/domains/domainconnect';
        } else if (nameserver.includes('cloudflare')) {
          return 'https://dash.cloudflare.com/domain-connect';
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('NS record lookup failed:', error);
    return null;
  }
}

async function generateDomainConnectUrl(
  domain: string,
  registrar: string | undefined,
  templateId: string, 
  params: Record<string, string>,
  sessionToken: string
): Promise<string> {
  // Normalize domain (remove www.)
  const normalizedDomain = normalizeDomain(domain);
  
  // Domain Connect template mapping
  const templates = {
    'landing_page': {
      providerId: 'bloomsuite.app',
      serviceId: 'landing_page',
      records: [
        { type: 'CNAME', host: '@', pointsTo: 'pages.bloomsuite.app.' },
        { type: 'CNAME', host: 'www', pointsTo: 'pages.bloomsuite.app.' }
      ]
    },
    'email_auth': {
      providerId: 'bloomsuite.app',
      serviceId: 'email_auth',
      records: [
        { type: 'TXT', host: '@', data: 'v=spf1 include:_spf.resend.com ~all' },
        { type: 'CNAME', host: 'resend._domainkey', pointsTo: 'resend._domainkey.resend.com.' },
        { type: 'TXT', host: '_dmarc', data: 'v=DMARC1; p=reject; rua=mailto:dmarc@bloomsuite.app' }
      ]
    }
  };

  const template = templates[templateId as keyof typeof templates];
  if (!template) {
    throw new Error('Invalid template ID');
  }

  // Normalize params - remove www. from DKIM host and other domain references
  const normalizedParams = { ...params };
  if (normalizedParams.dkim_host) {
    normalizedParams.dkim_host = normalizedParams.dkim_host.replace(/^www\./, '');
  }

  let domainConnectHost: string | null = null;
  
  // Step 1: Try DNS-based discovery
  console.log('Attempting DNS discovery for Domain Connect host...');
  domainConnectHost = await discoverDomainConnectHost(normalizedDomain);
  
  // Step 2: If DNS discovery fails, try to infer from registrar
  if (!domainConnectHost && registrar) {
    console.log('DNS discovery failed, trying registrar-based lookup...');
    if (registrar.toLowerCase().includes('godaddy')) {
      domainConnectHost = 'https://dcc.godaddy.com';
    } else if (registrar.toLowerCase().includes('namecheap')) {
      domainConnectHost = 'https://www.namecheap.com/domains/domainconnect';
    } else if (registrar.toLowerCase().includes('cloudflare')) {
      domainConnectHost = 'https://dash.cloudflare.com/domain-connect';
    }
  }
  
  // Step 3: If still no host, try NS record inference
  if (!domainConnectHost) {
    console.log('Registrar lookup failed, trying NS record inference...');
    domainConnectHost = await inferRegistrarFromNS(normalizedDomain);
  }
  
  // Step 4: If all discovery methods fail, return manual fallback
  if (!domainConnectHost) {
    console.log('All Domain Connect discovery methods failed, falling back to manual DNS');
    throw new Error('MANUAL_DNS_REQUIRED');
  }
  
  // Build Domain Connect apply URL (normalize host and handle known providers)
  let domainConnectBase = domainConnectHost.replace(/\.$/, '');
  if (domainConnectBase.includes('domaincontrol.com') || domainConnectBase.includes('godaddy')) {
    domainConnectBase = 'https://dcc.godaddy.com';
  }
  const applyUrl = `${domainConnectBase}/v2/domainTemplates/providers/${template.providerId}/services/${template.serviceId}/apply`;
  
  // Include session in redirect_uri and use state for compatibility
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/domain-connect-callback?session=${sessionToken}`;
  
  const queryParams = new URLSearchParams({
    domain: normalizedDomain, // Use normalized domain
    redirect_uri: callbackUrl,
    state: sessionToken,
    // Add normalized template-specific parameters
    ...normalizedParams
  });

  const finalUrl = `${applyUrl}?${queryParams.toString()}`;
  console.log('Generated Domain Connect URL:', finalUrl);
  console.log('Domain Connect host:', domainConnectHost);
  
  return finalUrl;
}

serve(handler);