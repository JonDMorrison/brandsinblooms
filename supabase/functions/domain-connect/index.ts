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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { domain, registrar, templateId, params }: DomainConnectRequest = await req.json();

      // Get or create domain record
      let { data: domainRecord, error: domainError } = await supabase
        .from('domains')
        .select('*')
        .eq('domain', domain)
        .maybeSingle();

      if (domainError) {
        throw new Error(`Error fetching domain: ${domainError.message}`);
      }

      // If domain doesn't exist, create it
      if (!domainRecord) {
        const { data: newDomain, error: createError } = await supabase
          .from('domains')
          .insert({
            domain: domain,
            type: 'email_sending',
            status: 'pending',
            dns_status: 'pending',
            tls_status: 'pending'
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
      const { data: session, error: sessionError } = await supabase
        .from('domain_connect_sessions')
        .insert({
          domain_id: domainRecord.id,
          session_token: sessionToken,
          registrar_name: registrar,
          template_id: templateId,
          params: params,
          status: 'pending'
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create session: ${sessionError.message}`);
      }

      // Check if registrar supports Domain Connect
      const supportedRegistrars = [
        'godaddy.com', 
        'namecheap.com', 
        'google.com',
        'cloudflare.com',
        '1and1.com',
        'hover.com'
      ];

      const isDomainConnectSupported = supportedRegistrars.some(reg => 
        domain.includes(reg) || registrar?.toLowerCase().includes(reg)
      );

      if (!isDomainConnectSupported) {
        // Fallback to manual DNS instructions
        const response: DomainConnectResponse = {
          success: false,
          error: 'Domain Connect not supported by registrar. Manual DNS setup required.'
        };
        
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        });
      }

      // Generate Domain Connect URL
      const domainConnectUrl = await generateDomainConnectUrl(domain, templateId, params, sessionToken);

      const response: DomainConnectResponse = {
        success: true,
        sessionToken,
        redirectUrl: domainConnectUrl
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET request - check session status
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sessionToken = url.searchParams.get('session');

      if (!sessionToken) {
        throw new Error('Session token required');
      }

      const { data: session, error } = await supabase
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
    
    const response: DomainConnectResponse = {
      success: false,
      error: error.message
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

async function generateDomainConnectUrl(
  domain: string, 
  templateId: string, 
  params: Record<string, string>,
  sessionToken: string
): Promise<string> {
  // Extract registrar from domain
  const domainParts = domain.split('.');
  const tld = domainParts.slice(-2).join('.');
  
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

  // Build Domain Connect URL
  const baseUrl = `https://${domain}/_domainconnect`;
  const queryParams = new URLSearchParams({
    domain,
    providerId: template.providerId,
    serviceId: template.serviceId,
    redirect_uri: `https://api.bloomsuite.app/domain-connect/callback?session=${sessionToken}`,
    state: sessionToken,
    ...params
  });

  return `${baseUrl}?${queryParams.toString()}`;
}

serve(handler);