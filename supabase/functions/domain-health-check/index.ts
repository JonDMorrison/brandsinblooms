import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckRequest {
  domainId?: string;
  domain?: string;
  checkTypes?: string[];
}

interface HealthCheckResult {
  domainId: string;
  domain: string;
  checks: {
    dns: { status: string; details: any; responseTime: number };
    tls: { status: string; details: any; responseTime: number };
    http: { status: string; details: any; responseTime: number };
  };
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
      const { domainId, domain, checkTypes = ['dns', 'tls', 'http'] }: HealthCheckRequest = await req.json();

      let domainRecord;

      if (domainId) {
        const { data, error } = await supabase
          .from('domains')
          .select('*')
          .eq('id', domainId)
          .single();
        
        if (error) throw new Error(`Domain not found: ${error.message}`);
        domainRecord = data;
      } else if (domain) {
        const { data, error } = await supabase
          .from('domains')
          .select('*')
          .eq('domain', domain)
          .single();
        
        if (error) throw new Error(`Domain not found: ${error.message}`);
        domainRecord = data;
      } else {
        throw new Error('Either domainId or domain must be provided');
      }

      const results: HealthCheckResult = {
        domainId: domainRecord.id,
        domain: domainRecord.domain,
        checks: {
          dns: { status: 'unknown', details: {}, responseTime: 0 },
          tls: { status: 'unknown', details: {}, responseTime: 0 },
          http: { status: 'unknown', details: {}, responseTime: 0 }
        }
      };

      // Perform health checks
      for (const checkType of checkTypes) {
        const startTime = performance.now();
        
        try {
          switch (checkType) {
            case 'dns':
              results.checks.dns = await performDnsCheck(domainRecord.domain);
              break;
            case 'tls':
              results.checks.tls = await performTlsCheck(domainRecord.domain);
              break;
            case 'http':
              results.checks.http = await performHttpCheck(domainRecord.domain);
              break;
          }
          
          results.checks[checkType as keyof typeof results.checks].responseTime = 
            performance.now() - startTime;

        } catch (error) {
          results.checks[checkType as keyof typeof results.checks] = {
            status: 'error',
            details: { error: error.message },
            responseTime: performance.now() - startTime
          };
        }
      }

      // Store health check results
      for (const [checkType, result] of Object.entries(results.checks)) {
        await supabase
          .from('domain_health_checks')
          .insert({
            domain_id: domainRecord.id,
            check_type: checkType,
            status: result.status,
            details: result.details,
            response_time_ms: Math.round(result.responseTime)
          });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // GET request - retrieve health check history
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const domainId = url.searchParams.get('domainId');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      if (!domainId) {
        throw new Error('domainId parameter required');
      }

      const { data: checks, error } = await supabase
        .from('domain_health_checks')
        .select('*')
        .eq('domain_id', domainId)
        .order('checked_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch health checks: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true, checks }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

async function performDnsCheck(domain: string) {
  try {
    // Check DNS resolution using Cloudflare DNS-over-HTTPS
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    const dnsData = await response.json();
    
    if (dnsData.Status !== 0) {
      return {
        status: 'error',
        details: { error: 'DNS resolution failed', dnsData }
      };
    }

    const aRecords = dnsData.Answer?.filter((record: any) => record.type === 1) || [];
    
    return {
      status: aRecords.length > 0 ? 'healthy' : 'warning',
      details: {
        records: aRecords.map((record: any) => record.data),
        ttl: aRecords[0]?.TTL || 0
      }
    };

  } catch (error) {
    return {
      status: 'error',
      details: { error: error.message }
    };
  }
}

async function performTlsCheck(domain: string) {
  try {
    const response = await fetch(`https://${domain}`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    return {
      status: response.ok ? 'healthy' : 'warning',
      details: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      }
    };

  } catch (error) {
    // Try to determine if it's a TLS issue
    const isTlsError = error.message.includes('certificate') || 
                      error.message.includes('TLS') || 
                      error.message.includes('SSL');
    
    return {
      status: 'error',
      details: { 
        error: error.message,
        type: isTlsError ? 'tls' : 'connection'
      }
    };
  }
}

async function performHttpCheck(domain: string) {
  try {
    const startTime = Date.now();
    const response = await fetch(`https://${domain}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    const loadTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'healthy' : 'warning',
      details: {
        status: response.status,
        statusText: response.statusText,
        loadTime,
        headers: {
          'content-type': response.headers.get('content-type'),
          'server': response.headers.get('server'),
          'cache-control': response.headers.get('cache-control')
        }
      }
    };

  } catch (error) {
    return {
      status: 'error',
      details: { error: error.message }
    };
  }
}

serve(handler);