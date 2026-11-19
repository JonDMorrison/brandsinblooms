import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isPrivateVerificationHost } from '../_shared/bloom-support/engineering.ts';

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

const CHECK_TYPES = ['dns', 'tls', 'http'] as const;
type CheckType = typeof CHECK_TYPES[number];

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    status,
  });

// crm-r2-F40: checkTypes is a list of dns, tls and http only (each run once); anything else is refused.
function parseCheckTypes(value: unknown): CheckType[] | null {
  if (value === undefined) return [...CHECK_TYPES];
  if (!Array.isArray(value)) return null;
  const checkTypes: CheckType[] = [];
  for (const entry of value) {
    const checkType = CHECK_TYPES.find((known) => known === entry);
    if (!checkType) return null;
    if (!checkTypes.includes(checkType)) checkTypes.push(checkType);
  }
  return checkTypes;
}

// crm-r2-F39: domains.domain is free text any tenant member can write, so it is fetched only when it is
// a public DNS hostname: no IP literal, port, userinfo, path, single label or internal name.
function publicHostname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/\.$/, '');
  if (!raw || /[\s/\\@?#:[\]%]/.test(raw)) return null;
  let hostname: string;
  try {
    hostname = new URL(`https://${raw}`).hostname;
  } catch {
    return null;
  }
  const labels = hostname.split('.');
  if (
    labels.length < 2 ||
    !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    /^(?:\d+|0x[0-9a-f]*)$/.test(labels[labels.length - 1]) ||
    isPrivateVerificationHost(hostname)
  ) {
    return null;
  }
  return hostname;
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

    // crm-r2-F54: the domain row and its history are read as the caller (row-level security), so a
    // caller sees and checks only its own tenant's domains. The service role only stores the results.
    const authorization = req.headers.get('Authorization') ?? '';
    if (!authorization.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData?.user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    if (req.method === 'POST') {
      const { domainId, domain, checkTypes: requestedCheckTypes }: HealthCheckRequest = await req.json();
      const checkTypes = parseCheckTypes(requestedCheckTypes);
      if (!checkTypes) {
        return jsonResponse({ success: false, error: 'checkTypes may contain only dns, tls and http' }, 400);
      }

      let domainRecord;

      if (domainId) {
        const { data, error } = await callerClient
          .from('domains')
          .select('*')
          .eq('id', domainId)
          .maybeSingle();

        if (error) throw new Error('Domain lookup failed');
        domainRecord = data;
      } else if (domain) {
        const { data, error } = await callerClient
          .from('domains')
          .select('*')
          .eq('domain', domain)
          .limit(1)
          .maybeSingle();

        if (error) throw new Error('Domain lookup failed');
        domainRecord = data;
      } else {
        throw new Error('Either domainId or domain must be provided');
      }

      if (!domainRecord) {
        return jsonResponse({ success: false, error: 'Domain not found' }, 404);
      }

      const hostname = publicHostname(domainRecord.domain);

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
          if (!hostname) {
            results.checks[checkType] = {
              status: 'error',
              details: { error: 'Domain is not a public hostname' },
              responseTime: 0
            };
            continue;
          }

          switch (checkType) {
            case 'dns':
              results.checks.dns = { ...(await performDnsCheck(hostname)), responseTime: 0 };
              break;
            case 'tls':
              results.checks.tls = { ...(await performTlsCheck(hostname)), responseTime: 0 };
              break;
            case 'http':
              results.checks.http = { ...(await performHttpCheck(hostname)), responseTime: 0 };
              break;
          }
          
          results.checks[checkType].responseTime = 
            performance.now() - startTime;

        } catch (_error) {
          results.checks[checkType] = {
            status: 'error',
            details: { error: 'Check failed' },
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
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10') || 10, 1), 100);

      if (!domainId) {
        throw new Error('domainId parameter required');
      }

      const { data: visibleDomain, error: visibleError } = await callerClient
        .from('domains')
        .select('id')
        .eq('id', domainId)
        .maybeSingle();

      if (visibleError) throw new Error('Domain lookup failed');
      if (!visibleDomain) {
        return jsonResponse({ success: false, error: 'Domain not found' }, 404);
      }

      const { data: checks, error } = await callerClient
        .from('domain_health_checks')
        .select('*')
        .eq('domain_id', domainId)
        .order('checked_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error('Failed to fetch health checks');
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
      error: error instanceof Error ? error.message : 'Health check failed'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 400,
    });
  }
};

async function performDnsCheck(domain: string) {
  try {
    // Check DNS resolution using Cloudflare DNS-over-HTTPS
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(10000)
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

  } catch (_error) {
    return {
      status: 'error',
      details: { error: 'DNS lookup failed' }
    };
  }
}

// crm-r2-F39: only the three named headers are returned, a redirect is reported (never followed) and
// connection errors are generic.
function namedHeaders(response: Response) {
  return {
    'content-type': response.headers.get('content-type'),
    'server': response.headers.get('server'),
    'cache-control': response.headers.get('cache-control')
  };
}

async function performTlsCheck(domain: string) {
  try {
    const response = await fetch(`https://${domain}/`, { 
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    await response.body?.cancel();
    
    return {
      status: response.ok ? 'healthy' : 'warning',
      details: {
        status: response.status,
        redirected: response.status >= 300 && response.status < 400,
        headers: namedHeaders(response)
      }
    };

  } catch (error) {
    // Try to determine if it's a TLS issue
    const message = error instanceof Error ? error.message : String(error);
    const isTlsError = message.includes('certificate') || 
                      message.includes('TLS') || 
                      message.includes('SSL');
    
    return {
      status: 'error',
      details: { 
        error: isTlsError ? 'TLS handshake failed' : 'Connection failed',
        type: isTlsError ? 'tls' : 'connection'
      }
    };
  }
}

async function performHttpCheck(domain: string) {
  try {
    const startTime = Date.now();
    const response = await fetch(`https://${domain}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    await response.body?.cancel();
    
    const loadTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'healthy' : 'warning',
      details: {
        status: response.status,
        statusText: response.statusText,
        redirected: response.status >= 300 && response.status < 400,
        loadTime,
        headers: namedHeaders(response)
      }
    };

  } catch (_error) {
    return {
      status: 'error',
      details: { error: 'Connection failed' }
    };
  }
}

serve(handler);