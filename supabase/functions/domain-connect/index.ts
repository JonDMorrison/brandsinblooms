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
        'godaddy.com',
        'namecheap.com',
        'google.com',
        'cloudflare.com',
        '1and1.com',
        'hover.com',
      ];

      const isDomainConnectSupported = supportedRegistrars.some((reg) =>
        domain.includes(reg) || registrar?.toLowerCase().includes(reg)
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
      const domainConnectUrl = await generateDomainConnectUrl(domain, templateId, params, sessionToken);

      const response: DomainConnectResponse = {
        success: true,
        sessionToken,
        redirectUrl: domainConnectUrl,
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