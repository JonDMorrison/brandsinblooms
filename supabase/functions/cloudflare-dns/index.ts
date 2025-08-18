import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloudflareRequest {
  domain: string;
  action: 'setup' | 'verify' | 'remove';
  records?: Array<{
    type: string;
    name: string;
    content: string;
    ttl?: number;
  }>;
  integrationId?: string;
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
      const { domain, action, records, integrationId }: CloudflareRequest = await req.json();

      // Get Cloudflare integration
      let integration;
      if (integrationId) {
        const { data, error } = await supabase
          .from('domain_provider_integrations')
          .select('*')
          .eq('id', integrationId)
          .eq('provider_type', 'cloudflare')
          .single();
        
        if (error) throw new Error(`Integration not found: ${error.message}`);
        integration = data;
      } else {
        // Find active Cloudflare integration for the domain's tenant
        const { data: domainData, error: domainError } = await supabase
          .from('domains')
          .select('tenant_id')
          .eq('domain', domain)
          .single();

        if (domainError) throw new Error(`Domain not found: ${domainError.message}`);

        const { data, error } = await supabase
          .from('domain_provider_integrations')
          .select('*')
          .eq('tenant_id', domainData.tenant_id)
          .eq('provider_type', 'cloudflare')
          .eq('is_active', true)
          .single();
        
        if (error) throw new Error(`No active Cloudflare integration found`);
        integration = data;
      }

      const cfConfig = integration.provider_config;
      if (!cfConfig.api_token && !cfConfig.api_key) {
        throw new Error('Cloudflare API credentials not configured');
      }

      // Get zone ID for the domain
      const zoneId = await getCloudflareZoneId(domain, cfConfig);

      switch (action) {
        case 'setup':
          if (!records || records.length === 0) {
            throw new Error('Records required for setup action');
          }
          return await setupDnsRecords(zoneId, records, cfConfig);

        case 'verify':
          return await verifyDnsRecords(zoneId, records || [], cfConfig);

        case 'remove':
          return await removeDnsRecords(zoneId, records || [], cfConfig);

        default:
          throw new Error('Invalid action');
      }
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Cloudflare DNS error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

async function getCloudflareZoneId(domain: string, config: any): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': config.api_token ? `Bearer ${config.api_token}` : `${config.api_key}`,
    ...(config.email && { 'X-Auth-Email': config.email })
  };

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || 'Unknown error'}`);
  }

  if (data.result.length === 0) {
    throw new Error(`Domain ${domain} not found in Cloudflare account`);
  }

  return data.result[0].id;
}

async function setupDnsRecords(zoneId: string, records: any[], config: any) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': config.api_token ? `Bearer ${config.api_token}` : `${config.api_key}`,
    ...(config.email && { 'X-Auth-Email': config.email })
  };

  const results = [];

  for (const record of records) {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 300
        })
      });

      const data = await response.json();
      
      if (data.success) {
        results.push({
          success: true,
          record: record,
          recordId: data.result.id
        });
      } else {
        results.push({
          success: false,
          record: record,
          error: data.errors?.[0]?.message || 'Unknown error'
        });
      }

    } catch (error) {
      results.push({
        success: false,
        record: record,
        error: error.message
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    results
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function verifyDnsRecords(zoneId: string, records: any[], config: any) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': config.api_token ? `Bearer ${config.api_token}` : `${config.api_key}`,
    ...(config.email && { 'X-Auth-Email': config.email })
  };

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || 'Unknown error'}`);
  }

  const existingRecords = data.result;
  const verification = records.map(record => {
    const exists = existingRecords.find((existing: any) => 
      existing.type === record.type &&
      existing.name === record.name &&
      existing.content === record.content
    );

    return {
      record,
      exists: !!exists,
      recordId: exists?.id
    };
  });

  return new Response(JSON.stringify({
    success: true,
    verification
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function removeDnsRecords(zoneId: string, records: any[], config: any) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': config.api_token ? `Bearer ${config.api_token}` : `${config.api_key}`,
    ...(config.email && { 'X-Auth-Email': config.email })
  };

  // First get existing records to find IDs
  const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers
  });

  const listData = await listResponse.json();
  const existingRecords = listData.result;

  const results = [];

  for (const record of records) {
    const existingRecord = existingRecords.find((existing: any) => 
      existing.type === record.type &&
      existing.name === record.name &&
      existing.content === record.content
    );

    if (existingRecord) {
      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`, {
          method: 'DELETE',
          headers
        });

        const data = await response.json();
        
        results.push({
          success: data.success,
          record: record,
          error: data.success ? null : data.errors?.[0]?.message
        });

      } catch (error) {
        results.push({
          success: false,
          record: record,
          error: error.message
        });
      }
    } else {
      results.push({
        success: false,
        record: record,
        error: 'Record not found'
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    results
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

serve(handler);