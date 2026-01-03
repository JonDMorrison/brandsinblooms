import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface RepairRequest {
  domainId: string;
  conflictCleanup?: Array<{
    hostname: string;
    deleteTypes: string[]; // e.g., ['CNAME'] when we need MX+TXT
  }>;
  triggerVerifyAfter?: boolean; // NEW: Trigger re-verification after repair
}

// =========================================================
// FQDN Helper - Mirror of email-domain-verify for consistency
// =========================================================

function toFqdn(recordName: string, rootDomain: string): string {
  const name = (recordName || '').trim().toLowerCase().replace(/\.$/, '');
  const domain = rootDomain.trim().toLowerCase().replace(/\.$/, '');
  
  if (!name || name === '@') {
    return domain;
  }
  
  if (name === domain || name.endsWith(`.${domain}`)) {
    return name;
  }
  
  return `${name}.${domain}`;
}

/**
 * Email Domain Repair Function
 * 
 * This function handles automated DNS conflict repair via Entri.
 * When a CNAME conflict is detected (CNAME coexisting with MX/TXT at same hostname),
 * this function:
 * 1. Fetches the domain's DNS records from the database
 * 2. Identifies conflicting record types using FQDN-based detection
 * 3. Prepares a cleanup payload for Entri (delete conflicting records first)
 * 4. Returns the records needed for Entri to apply
 * 5. Optionally triggers re-verification after repair
 * 
 * The actual Entri modal is opened by the frontend using this data.
 * 
 * IDEMPOTENT: Running multiple times converges to same correct state.
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

    const { domainId, conflictCleanup, triggerVerifyAfter = true }: RepairRequest = await req.json();

    if (!domainId) {
      return corsJsonResponse({ error: 'Domain ID is required' }, { status: 400 });
    }

    console.log(`🔧 Repairing domain: ${domainId}, triggerVerifyAfter: ${triggerVerifyAfter}`);

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
        message: 'Automatic DNS repair is only available for domains set up via Entri. Please fix DNS records manually.',
        manual_steps: [
          'Log in to your DNS provider',
          'Find the conflicting CNAME record',
          'Delete the CNAME record',
          'Add the required MX and TXT records',
          'Return here and click "Check Status"'
        ]
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
    // CRITICAL: Use FQDN for cleanup rules
    const cleanupRules: Array<{ 
      hostname: string; 
      fqdn: string;
      deleteTypes: string[];
      reason: string;
    }> = [];
    
    for (const conflict of conflictDetails) {
      const fqdn = conflict.hostname; // Already FQDN from verify function
      
      if (conflict.conflictType === 'cname_with_mx_txt') {
        // When we need MX/TXT at a hostname but CNAME exists, delete the CNAME
        cleanupRules.push({
          hostname: conflict.hostname,
          fqdn: fqdn,
          deleteTypes: ['CNAME'],
          reason: `CNAME at ${fqdn} blocks MX/TXT records (RFC violation)`
        });
        console.log(`🧹 Will cleanup CNAME at ${fqdn} (conflicts with MX/TXT)`);
      }
    }
    
    // Also check if any records need DKIM CNAME but TXT exists
    // (This is the reverse case - we need CNAME but TXT is blocking)
    for (const record of dnsRecords) {
      if (record.type === 'CNAME' && record.name?.includes('_domainkey')) {
        const fqdn = toFqdn(record.name, emailDomain.domain);
        
        // Check if this hostname has a blocking TXT
        const hasBlockingTxt = conflictDetails.some((c: any) => 
          c.hostname === fqdn && c.txtExists
        );
        
        if (hasBlockingTxt && !cleanupRules.some(r => r.fqdn === fqdn)) {
          cleanupRules.push({
            hostname: record.name,
            fqdn: fqdn,
            deleteTypes: ['TXT'],
            reason: `TXT at ${fqdn} blocks DKIM CNAME record`
          });
          console.log(`🧹 Will cleanup TXT at ${fqdn} (blocks DKIM CNAME)`);
        }
      }
    }
    
    // Merge with any explicitly provided cleanup rules
    if (conflictCleanup && conflictCleanup.length > 0) {
      for (const rule of conflictCleanup) {
        const fqdn = rule.hostname.includes('.') 
          ? rule.hostname 
          : toFqdn(rule.hostname, emailDomain.domain);
          
        const existing = cleanupRules.find(r => r.fqdn === fqdn);
        if (existing) {
          existing.deleteTypes = [...new Set([...existing.deleteTypes, ...rule.deleteTypes])];
        } else {
          cleanupRules.push({
            hostname: rule.hostname,
            fqdn: fqdn,
            deleteTypes: rule.deleteTypes,
            reason: 'Explicitly requested cleanup'
          });
        }
      }
    }

    // Prepare records for Entri in the expected format
    // CRITICAL: Use proper host values (relative to domain for Entri)
    const entriRecords = dnsRecords.map(record => {
      // Entri expects relative hostnames (without the root domain)
      let host = record.name || '@';
      
      // If the name is already FQDN, strip the domain
      if (host.endsWith(`.${emailDomain.domain}`)) {
        host = host.replace(`.${emailDomain.domain}`, '');
      } else if (host === emailDomain.domain) {
        host = '@';
      }
      
      return {
        type: record.type,
        host: host,
        value: record.value,
        ttl: 3600,
        // Include priority for MX records
        ...(record.type === 'MX' && record.priority !== undefined && { priority: record.priority })
      };
    });

    // Prepare cleanup records for Entri
    // NOTE: Entri may handle this via "preCheck" or separate cleanup flow
    const entriCleanupRecords = cleanupRules.map(rule => {
      // Convert FQDN back to relative hostname for Entri
      let host = rule.hostname;
      if (host.endsWith(`.${emailDomain.domain}`)) {
        host = host.replace(`.${emailDomain.domain}`, '');
      } else if (host === emailDomain.domain) {
        host = '@';
      }
      
      return {
        host: host,
        fqdn: rule.fqdn,
        deleteTypes: rule.deleteTypes,
        reason: rule.reason
      };
    });

    console.log(`✅ Prepared ${entriRecords.length} records for Entri with ${cleanupRules.length} cleanup rules`);

    // Log the full repair plan for debugging
    console.log(JSON.stringify({
      event: 'repair_plan',
      domain: emailDomain.domain,
      domainId: emailDomain.id,
      recordsToApply: entriRecords.length,
      cleanupRules: cleanupRules.map(r => ({
        fqdn: r.fqdn,
        deleteTypes: r.deleteTypes,
        reason: r.reason
      })),
      triggerVerifyAfter
    }));

    // Return the data needed for the frontend to open Entri
    return corsJsonResponse({
      success: true,
      domain: emailDomain.domain,
      domainId: emailDomain.id,
      isEntriManaged: true,
      entriProvider: emailDomain.entri_provider,
      entriConnectionId: emailDomain.entri_connection_id,
      records: entriRecords,
      cleanupRules: entriCleanupRecords,
      conflictDetails,
      message: cleanupRules.length > 0 
        ? `Will cleanup ${cleanupRules.length} conflicting record(s) and apply ${entriRecords.length} correct record(s)`
        : `Will apply ${entriRecords.length} DNS record(s)`,
      
      // NEW: Flag to tell frontend to trigger verification after Entri completes
      triggerVerifyAfter,
      
      // NEW: Full cleanup plan for debugging
      repairPlan: {
        cleanup: cleanupRules.map(r => ({
          hostname: r.fqdn,
          deleteTypes: r.deleteTypes,
          reason: r.reason
        })),
        apply: entriRecords.map(r => ({
          type: r.type,
          host: r.host,
          value: r.value?.substring(0, 50) + (r.value && r.value.length > 50 ? '...' : '')
        }))
      }
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
