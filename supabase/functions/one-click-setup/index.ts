import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetupRequest {
  domain: string;
  setupType: 'landing_page' | 'email_auth' | 'full_app' | 'custom';
  customRecords?: Array<{
    type: string;
    name: string;
    content: string;
    ttl?: number;
  }>;
  integrationId?: string;
}

// DNS Record Templates
const DNS_TEMPLATES = {
  landing_page: [
    { type: 'A', name: '@', content: '185.199.108.153' },
    { type: 'A', name: '@', content: '185.199.109.153' },
    { type: 'A', name: '@', content: '185.199.110.153' },
    { type: 'A', name: '@', content: '185.199.111.153' },
    { type: 'CNAME', name: 'www', content: '@' },
  ],
  email_auth: [
    { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.resend.com ~all' },
    { type: 'CNAME', name: 'resend._domainkey', content: 'resend._domainkey.resend.com.' },
    { type: 'TXT', name: '_dmarc', content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@your-domain.com' },
  ],
  full_app: [
    // Landing page records
    { type: 'A', name: '@', content: '185.199.108.153' },
    { type: 'A', name: '@', content: '185.199.109.153' },
    { type: 'A', name: '@', content: '185.199.110.153' },
    { type: 'A', name: '@', content: '185.199.111.153' },
    { type: 'CNAME', name: 'www', content: '@' },
    // Email auth records
    { type: 'TXT', name: '@', content: 'v=spf1 include:_spf.resend.com ~all' },
    { type: 'CNAME', name: 'resend._domainkey', content: 'resend._domainkey.resend.com.' },
    { type: 'TXT', name: '_dmarc', content: 'v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@your-domain.com' },
    // API subdomain
    { type: 'CNAME', name: 'api', content: 'your-api-endpoint.herokuapp.com.' },
  ],
};

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
      const { domain, setupType, customRecords, integrationId }: SetupRequest = await req.json();

      console.log(`Starting one-click setup for ${domain} with type: ${setupType}`);

      // Get domain record
      const { data: domainRecord, error: domainError } = await supabase
        .from('domains')
        .select('*')
        .eq('domain', domain)
        .single();

      if (domainError) {
        throw new Error(`Domain not found: ${domainError.message}`);
      }

      // Get DNS provider integration
      let integration;
      if (integrationId) {
        const { data, error } = await supabase
          .from('domain_provider_integrations')
          .select('*')
          .eq('id', integrationId)
          .single();
        
        if (error) throw new Error(`Integration not found: ${error.message}`);
        integration = data;
      } else {
        // Find active integration for the tenant
        const { data, error } = await supabase
          .from('domain_provider_integrations')
          .select('*')
          .eq('tenant_id', domainRecord.tenant_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error || !data.length) {
          throw new Error('No active DNS provider integration found');
        }
        integration = data[0];
      }

      // Determine records to create
      const records = setupType === 'custom' ? customRecords : DNS_TEMPLATES[setupType];
      if (!records || records.length === 0) {
        throw new Error('No DNS records to configure');
      }

      // Replace placeholders in records
      const processedRecords = records.map(record => ({
        ...record,
        name: record.name === '@' ? domain : record.name.replace('@', domain),
        content: record.content.replace('your-domain.com', domain)
      }));

      console.log(`Setting up ${processedRecords.length} DNS records:`, processedRecords);

      // Create setup session for tracking
      const { data: session, error: sessionError } = await supabase
        .from('domain_setup_sessions')
        .insert({
          domain_id: domainRecord.id,
          setup_type: setupType,
          records_to_create: processedRecords,
          provider_integration_id: integration.id,
          status: 'in_progress',
          progress: 0,
        })
        .select()
        .single();

      if (sessionError) {
        throw new Error(`Failed to create setup session: ${sessionError.message}`);
      }

      // Call the appropriate DNS provider function
      let dnsResponse;
      if (integration.provider_type === 'cloudflare') {
        dnsResponse = await supabase.functions.invoke('cloudflare-dns', {
          body: {
            domain,
            action: 'setup',
            records: processedRecords,
            integrationId: integration.id,
          }
        });
      } else {
        throw new Error(`Provider ${integration.provider_type} not supported yet`);
      }

      if (dnsResponse.error) {
        // Update session with error
        await supabase
          .from('domain_setup_sessions')
          .update({
            status: 'failed',
            error_message: dnsResponse.error.message,
          })
          .eq('id', session.id);

        throw new Error(`DNS setup failed: ${dnsResponse.error.message}`);
      }

      const results = dnsResponse.data.results;
      const successCount = results.filter((r: any) => r.success).length;
      const totalCount = results.length;

      // Update domain record with setup info
      await supabase
        .from('domains')
        .update({
          setup_type: setupType,
          dns_provider: integration.provider_type,
          last_setup_at: new Date().toISOString(),
        })
        .eq('id', domainRecord.id);

      // Update session with results
      await supabase
        .from('domain_setup_sessions')
        .update({
          status: successCount === totalCount ? 'completed' : 'partial',
          progress: Math.round((successCount / totalCount) * 100),
          results: results,
          completed_at: successCount === totalCount ? new Date().toISOString() : null,
        })
        .eq('id', session.id);

      // Log setup activity
      await supabase
        .from('domain_activity_logs')
        .insert({
          domain_id: domainRecord.id,
          action: 'one_click_setup',
          details: {
            setup_type: setupType,
            records_created: successCount,
            total_records: totalCount,
            provider: integration.provider_type,
          },
        });

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        results: results,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount,
          progress: Math.round((successCount / totalCount) * 100),
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET request - check setup session status
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        throw new Error('Session ID required');
      }

      const { data: session, error } = await supabase
        .from('domain_setup_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw new Error(`Session not found: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        session: session,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('One-click setup error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

serve(handler);