import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface RepairRequest {
  domainId: string;
  conflictCleanup?: Array<{
    hostname: string;
    deleteTypes: string[]; // e.g., ['CNAME'] when we need MX+TXT
  }>;
}

/**
 * Email Domain Repair Function
 * 
 * This function handles automated DNS conflict repair via Entri.
 * When a CNAME conflict is detected (CNAME coexisting with MX/TXT at same hostname),
 * this function:
 * 1. Fetches the domain's DNS records from the database
 * 2. Identifies conflicting record types
 * 3. Prepares a cleanup payload for Entri (delete conflicting records first)
 * 4. Returns the records needed for Entri to apply
 * 
 * The actual Entri modal is opened by the frontend using this data.
 */

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    console.log("🔧 Starting email domain repair");
    
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    const { domainId, conflictCleanup }: RepairRequest = await req.json();

    if (!domainId) {
      return corsJsonResponse({ error: 'Domain ID is required' }, { status: 400 });
    }

    console.log(`🔧 Repairing domain: ${domainId}`);

    // Fetch domain
    const { data: emailDomain, error: domainError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (domainError || !emailDomain) {
      console.error('❌ Domain not found:', domainError);
      return corsJsonResponse({ error: 'Domain not found' }, { status: 404 });
    }

    // Verify user has access
    const { data: userTenant } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (userTenant?.tenant_id !== emailDomain.tenant_id) {
      return corsJsonResponse({ error: 'Access denied to this domain' }, { status: 403 });
    }

    // Check if domain is Entri-managed
    if (!emailDomain.is_entri_managed) {
      return corsJsonResponse({ 
        error: 'Domain is not Entri-managed',
        message: 'Automatic DNS repair is only available for domains set up via Entri. Please fix DNS records manually.'
      }, { status: 400 });
    }

    // Fetch DNS records for this domain
    const { data: dnsRecords, error: recordsError } = await supabase
      .from('email_dns_records')
      .select('*')
      .eq('email_domain_id', domainId);

    if (recordsError) {
      console.error('❌ Failed to fetch DNS records:', recordsError);
      return corsJsonResponse({ error: 'Failed to fetch DNS records' }, { status: 500 });
    }

    if (!dnsRecords || dnsRecords.length === 0) {
      return corsJsonResponse({ 
        error: 'No DNS records found',
        message: 'No DNS records found for this domain. Please delete and re-add the domain.'
      }, { status: 400 });
    }

    console.log(`📋 Found ${dnsRecords.length} DNS records for domain ${emailDomain.domain}`);

    // Parse conflict details from resend_status if available
    const resendStatus = emailDomain.resend_status as any;
    const conflictDetails = resendStatus?.dns_conflict_details || [];
    
    // Build cleanup rules based on detected conflicts
    const cleanupRules: Array<{ hostname: string; deleteTypes: string[] }> = [];
    
    for (const conflict of conflictDetails) {
      if (conflict.conflictType === 'cname_with_mx_txt') {
        // When we need MX/TXT at a hostname but CNAME exists, delete the CNAME
        cleanupRules.push({
          hostname: conflict.hostname,
          deleteTypes: ['CNAME']
        });
        console.log(`🧹 Will cleanup CNAME at ${conflict.hostname} (conflicts with MX/TXT)`);
      }
    }
    
    // Merge with any explicitly provided cleanup rules
    if (conflictCleanup && conflictCleanup.length > 0) {
      for (const rule of conflictCleanup) {
        const existing = cleanupRules.find(r => r.hostname === rule.hostname);
        if (existing) {
          existing.deleteTypes = [...new Set([...existing.deleteTypes, ...rule.deleteTypes])];
        } else {
          cleanupRules.push(rule);
        }
      }
    }

    // Prepare records for Entri in the expected format
    const entriRecords = dnsRecords.map(record => ({
      type: record.type,
      host: record.name,
      value: record.value,
      ttl: 3600,
      // Include priority for MX records
      ...(record.type === 'MX' && record.priority !== undefined && { priority: record.priority })
    }));

    console.log(`✅ Prepared ${entriRecords.length} records for Entri with ${cleanupRules.length} cleanup rules`);

    // Return the data needed for the frontend to open Entri
    return corsJsonResponse({
      success: true,
      domain: emailDomain.domain,
      domainId: emailDomain.id,
      isEntriManaged: true,
      entriProvider: emailDomain.entri_provider,
      records: entriRecords,
      cleanupRules,
      conflictDetails,
      message: cleanupRules.length > 0 
        ? `Will cleanup ${cleanupRules.length} conflicting record(s) and apply ${entriRecords.length} correct record(s)`
        : `Will apply ${entriRecords.length} DNS record(s)`
    });

  } catch (error: any) {
    console.error('❌ Email domain repair error:', error);
    return corsJsonResponse({ 
      error: 'Internal server error',
      message: error?.message || 'Something went wrong during repair. Please try again or contact support.'
    }, { status: 500 });
  }
};

serve(handler);
