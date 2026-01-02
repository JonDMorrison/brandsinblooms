import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface VerifyDomainRequest {
  domainId?: string;
  email_domain_id?: string;
  reset_attempts?: boolean;
}

interface DNSCheck {
  check_name: string;
  ok: boolean;
  dns_verified?: boolean; // Independent DNS lookup result
  details: any;
}

interface ResendRecord {
  type?: string;
  record_type?: string;
  name?: string;
  value?: string;
  status?: string;
  priority?: number;
}

interface ConflictDetail {
  hostname: string;
  conflictType: string;
  cnameTarget?: string;
  mxExists?: boolean;
  txtExists?: boolean;
}

// =========================================================
// FQDN Helper - Ensures we always query correct hostnames
// =========================================================

/**
 * Convert a record name to a fully-qualified domain name (FQDN).
 * Handles various input formats from Resend API.
 * 
 * @param recordName - The record name (may be relative, "@", empty, or already FQDN)
 * @param rootDomain - The root domain (e.g., "clearlychiro.com")
 * @returns Fully-qualified hostname without trailing dot
 */
function toFqdn(recordName: string, rootDomain: string): string {
  const name = (recordName || '').trim().toLowerCase().replace(/\.$/, '');
  const domain = rootDomain.trim().toLowerCase().replace(/\.$/, '');
  
  // Empty or @ means root domain
  if (!name || name === '@') {
    return domain;
  }
  
  // Already FQDN (equals domain or ends with .domain)
  if (name === domain || name.endsWith(`.${domain}`)) {
    return name;
  }
  
  // Relative hostname - append domain
  return `${name}.${domain}`;
}

// =========================================================
// CNAME Conflict Detection
// =========================================================

interface ConflictCheckResult {
  hasConflict: boolean;
  cnameExists: boolean;
  mxExists: boolean;
  txtExists: boolean;
  cnameTarget?: string;
}

async function detectCnameConflict(hostname: string): Promise<ConflictCheckResult> {
  const checkType = async (dnsType: number): Promise<{ exists: boolean; values: string[] }> => {
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${dnsType}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
      if (!response.ok) return { exists: false, values: [] };
      const data = await response.json();
      const answers = data.Answer || [];
      return {
        exists: answers.length > 0,
        values: answers.map((a: any) => {
          let val = a.data || '';
          if (val.endsWith('.')) val = val.slice(0, -1);
          return val;
        })
      };
    } catch {
      return { exists: false, values: [] };
    }
  };
  
  const [cname, mx, txt] = await Promise.all([
    checkType(5),  // CNAME
    checkType(15), // MX
    checkType(16)  // TXT
  ]);
  
  const hasConflict = cname.exists && (mx.exists || txt.exists);
  
  return {
    hasConflict,
    cnameExists: cname.exists,
    mxExists: mx.exists,
    txtExists: txt.exists,
    cnameTarget: cname.values[0]
  };
}

// =========================================================
// Independent DNS Verification via Cloudflare DoH
// =========================================================

async function verifyDNSRecordDirectly(
  name: string, 
  type: 'TXT' | 'CNAME' | 'MX', 
  expectedValue: string,
  priority?: number
): Promise<{ found: boolean; actualValues: string[] }> {
  // CRITICAL: Validate FQDN - must contain a dot
  if (!name.includes('.')) {
    console.log(JSON.stringify({
      event: 'dns_lookup_error',
      error: 'invalid_hostname',
      hostname: name,
      message: `Hostname "${name}" is not a valid FQDN (missing dot). This is a bug.`
    }));
    return { found: false, actualValues: [] };
  }
  
  // Normalize hostname
  const normalizedName = name.toLowerCase().trim().replace(/\.$/, '');
  
  try {
    const dnsType = type === 'TXT' ? 16 : type === 'CNAME' ? 5 : 15;
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(normalizedName)}&type=${dnsType}`;
    
    console.log(JSON.stringify({
      event: 'dns_lookup_request',
      hostname: normalizedName,
      type,
      dnsType,
      url
    }));
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) {
      console.log(JSON.stringify({
        event: 'dns_lookup_http_error',
        hostname: normalizedName,
        type,
        httpStatus: response.status
      }));
      return { found: false, actualValues: [] };
    }
    
    const data = await response.json();
    const answers = data.Answer || [];
    const actualValues: string[] = [];
    
    for (const answer of answers) {
      let value = answer.data || '';
      
      // TXT records come quoted, remove quotes
      if (type === 'TXT' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      // CNAME records may have trailing dot
      if (type === 'CNAME' && value.endsWith('.')) {
        value = value.slice(0, -1);
      }
      
      // MX records: remove trailing dot from hostname
      if (type === 'MX') {
        value = value.replace(/\.$/, '');
      }
      
      actualValues.push(value);
      
      // For MX, check priority matches too
      if (type === 'MX') {
        const parts = value.split(' ');
        const mxPriority = parseInt(parts[0], 10);
        const mxHost = parts[1]?.replace(/\.$/, '') || '';
        
        if (priority !== undefined && mxPriority === priority && mxHost === expectedValue) {
          return { found: true, actualValues };
        }
        if (mxHost === expectedValue || value.includes(expectedValue)) {
          return { found: true, actualValues };
        }
      } else {
        // For TXT/CNAME, check if value contains expected
        if (value === expectedValue || value.includes(expectedValue) || expectedValue.includes(value)) {
          return { found: true, actualValues };
        }
      }
    }
    
    return { found: false, actualValues };
  } catch (error: any) {
    console.log(JSON.stringify({
      event: 'dns_lookup_exception',
      hostname: normalizedName,
      type,
      error: error?.message
    }));
    return { found: false, actualValues: [] };
  }
}

function getNextVerifyInterval(attempts: number): number {
  if (attempts <= 3) return 2 * 60 * 1000;
  if (attempts <= 6) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

function calculateNextVerifyAt(attempts: number, allPassed: boolean): Date | null {
  if (allPassed) return null;
  if (attempts >= 10) return null;
  
  const interval = getNextVerifyInterval(attempts + 1);
  return new Date(Date.now() + interval);
}

function mapResendStatus(resendStatus: string, allChecksPassed: boolean): string {
  if (allChecksPassed && resendStatus === 'verified') return 'active';
  if (resendStatus === 'pending' || resendStatus === 'not_started') return 'pending_dns';
  if (resendStatus === 'failed') return 'failed';
  return 'verifying';
}

// Build human-readable error message based on actual record verification status
function buildVerificationError(checks: DNSCheck[], resendRecords: ResendRecord[], conflictDetected: boolean): string {
  if (conflictDetected) {
    return 'DNS conflict detected: CNAME record conflicts with MX/TXT records. Click "Fix DNS Conflict" to repair.';
  }
  
  const failedChecks = checks.filter(c => !c.ok);
  if (failedChecks.length === 0) return '';
  
  const issues: string[] = [];
  
  // Analyze which specific records are failing
  for (const record of resendRecords) {
    if (record.status && record.status !== 'verified') {
      const recordType = record.record_type || record.type || 'Unknown';
      const recordName = record.name || 'Unknown';
      issues.push(`${recordType} at ${recordName}: ${record.status}`);
    }
  }
  
  if (issues.length > 0) {
    return `Pending DNS records: ${issues.join(', ')}. DNS changes may still be propagating (up to 48 hours).`;
  }
  
  return `Verification incomplete: ${failedChecks.map(c => c.check_name).join(', ')} pending. DNS changes may still be propagating.`;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    console.log("🔍 Starting email domain verification");
    
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isServiceRole = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isServiceRole = true;
        console.log("🔑 Service role access - cron job");
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
        }
        userId = user.id;
      }
    } else {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 });
    }

    const { domainId, email_domain_id, reset_attempts }: VerifyDomainRequest = await req.json();
    const finalDomainId = domainId || email_domain_id;

    if (!finalDomainId) {
      return corsJsonResponse({ error: 'Domain ID is required' }, { status: 400 });
    }

    console.log(`🔍 Verifying domain: ${finalDomainId}, reset_attempts: ${reset_attempts}`);

    const { data: emailDomain, error: domainError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', finalDomainId)
      .single();

    if (domainError || !emailDomain) {
      console.error('❌ Domain not found:', domainError);
      return corsJsonResponse({ error: 'Domain not found' }, { status: 404 });
    }

    if (!isServiceRole && userId) {
      const { data: userTenant } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userId)
        .single();
      
      if (userTenant?.tenant_id !== emailDomain.tenant_id) {
        return corsJsonResponse({ error: 'Access denied to this domain' }, { status: 403 });
      }
    }

    let currentAttempts = emailDomain.verify_attempts || 0;
    if (reset_attempts) {
      currentAttempts = 0;
      console.log("🔄 Resetting verification attempts to 0");
    }

    if (currentAttempts >= 10 && !reset_attempts) {
      console.log("⚠️ Max verification attempts reached");
      return corsJsonResponse({
        ok: false,
        status: 'failed',
        message: 'Maximum verification attempts (10) reached. Click "Retry" to reset and try again.',
        domain: emailDomain.domain,
        verify_attempts: currentAttempts
      });
    }

    if (!emailDomain.resend_domain_id) {
      return corsJsonResponse({ 
        error: 'No Resend domain ID found. Domain may not be properly provisioned.',
        status: emailDomain.status
      }, { status: 400 });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return corsJsonResponse({ 
        error: 'Email service not configured',
        message: 'Resend API key not available. Please contact support.'
      }, { status: 503 });
    }

    const resend = new Resend(resendApiKey);
    const checks: DNSCheck[] = [];
    let allPassed = true;
    let resendDomainStatus: any = null;
    let resendRecords: ResendRecord[] = [];
    
    // Track conflicts
    let dnsConflictDetected = false;
    const conflictDetails: ConflictDetail[] = [];
    
    // Track per-record DNS verification status (declared here so it's accessible after the try block)
    const recordDnsStatus: Record<string, { found: boolean; actualValues: string[]; fqdn: string; hasConflict?: boolean }> = {};

    try {
      console.log(`📧 Triggering Resend verification for: ${emailDomain.resend_domain_id}`);
      
      // Step 1: Trigger Resend to re-check DNS records
      try {
        const { data: verifyResult, error: verifyError } = await resend.domains.verify(emailDomain.resend_domain_id);
        
        if (verifyError) {
          console.log(`⚠️ Resend verify returned error:`, JSON.stringify(verifyError));
        } else {
          console.log(`✅ Resend verify triggered successfully`);
        }
      } catch (verifyError: any) {
        console.log(`⚠️ Resend verify call failed:`, verifyError?.message);
      }
      
      // Step 2: Wait for Resend to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Get updated domain status from Resend
      console.log(`📊 Fetching updated domain status...`);
      const { data: domainStatus, error: statusError } = await resend.domains.get(emailDomain.resend_domain_id);
      
      if (statusError) {
        console.error('❌ Resend status error:', JSON.stringify(statusError));
        return corsJsonResponse({ 
          error: 'Failed to verify domain',
          message: 'Unable to check domain status with Resend. Please try again.',
          details: statusError
        }, { status: 400 });
      }

      resendDomainStatus = domainStatus;
      resendRecords = domainStatus.records || [];
      console.log(`📊 Resend domain status:`, JSON.stringify(domainStatus, null, 2));

      // =========================================================
      // CRITICAL: Compute verification status from per-record statuses
      // Not from top-level fields that may not exist
      // =========================================================
      
      // Analyze records directly from Resend response
      let dkimVerified = false;
      let spfVerified = false;
      let mxVerified = false;
      let returnPathVerified = false;
      
      for (const record of resendRecords) {
        const recordType = record.record_type || record.type || '';
        const recordName = record.name || '';
        const recordStatus = record.status;
        const isVerified = recordStatus === 'verified';
        
        // Check DKIM (usually a CNAME or TXT with domainkey in the name)
        if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
          if (isVerified) dkimVerified = true;
          console.log(`  DKIM record: ${recordName} = ${recordStatus}`);
        }
        
        // Check SPF (TXT record with spf in value, typically on send subdomain)
        if (recordType === 'TXT' && !recordName.includes('_domainkey')) {
          if (isVerified) spfVerified = true;
          console.log(`  SPF/TXT record: ${recordName} = ${recordStatus}`);
        }
        
        // Check MX (for return-path / bounce handling)
        if (recordType === 'MX') {
          if (isVerified) {
            mxVerified = true;
            returnPathVerified = true; // MX is the return-path mechanism
          }
          console.log(`  MX record: ${recordName} = ${recordStatus}`);
        }
        
        // Check CNAME for return-path (some setups use CNAME)
        if (recordType === 'CNAME' && !recordName.includes('_domainkey')) {
          if (isVerified) returnPathVerified = true;
          console.log(`  CNAME record: ${recordName} = ${recordStatus}`);
        }
      }
      
      // Also check top-level status fields as fallback (Resend sometimes provides these)
      if (domainStatus.status === 'verified') {
        dkimVerified = true;
        spfVerified = true;
        returnPathVerified = true;
      }
      
      // Build DNS check results
      const dkimCheck: DNSCheck = {
        check_name: 'dkim',
        ok: dkimVerified,
        details: {
          status: dkimVerified ? 'verified' : 'pending',
          records: resendRecords.filter((r: ResendRecord) => 
            (r.name?.includes('dkim') || r.name?.includes('_domainkey'))
          )
        }
      };
      checks.push(dkimCheck);
      if (!dkimCheck.ok) allPassed = false;

      const spfCheck: DNSCheck = {
        check_name: 'spf',
        ok: spfVerified,
        details: {
          status: spfVerified ? 'verified' : 'pending',
          records: resendRecords.filter((r: ResendRecord) => 
            r.record_type === 'TXT' || r.type === 'TXT'
          )
        }
      };
      checks.push(spfCheck);
      if (!spfCheck.ok) allPassed = false;

      const returnPathCheck: DNSCheck = {
        check_name: 'return_path',
        ok: returnPathVerified,
        details: {
          status: returnPathVerified ? 'verified' : 'pending',
          mx_verified: mxVerified,
          records: resendRecords.filter((r: ResendRecord) => 
            r.record_type === 'MX' || r.type === 'MX' || 
            (r.record_type === 'CNAME' && !r.name?.includes('_domainkey'))
          )
        }
      };
      checks.push(returnPathCheck);
      if (!returnPathCheck.ok) allPassed = false;

      const verificationCheck: DNSCheck = {
        check_name: 'domain_verification',
        ok: domainStatus.status === 'verified',
        details: {
          resend_status: domainStatus.status,
          all_records_count: resendRecords.length,
          verified_count: resendRecords.filter((r: ResendRecord) => r.status === 'verified').length
        }
      };
      checks.push(verificationCheck);
      if (!verificationCheck.ok) allPassed = false;

      console.log(`📊 Resend verification results: DKIM=${dkimVerified}, SPF=${spfVerified}, ReturnPath=${returnPathVerified}, Overall=${domainStatus.status}`);

      // =========================================================
      // PHASE 2: Independent DNS verification for pending records
      // This catches cases where DNS is correct but Resend hasn't updated
      // CRITICAL FIX: Use toFqdn() to construct proper hostnames
      // =========================================================
      console.log(`🔍 Running independent DNS verification for pending records...`);
      console.log(`   Root domain: ${emailDomain.domain}`);
      
      let dkimDnsVerified = dkimVerified;
      let spfDnsVerified = spfVerified;
      let mxDnsVerified = mxVerified;
      
      
      for (const record of resendRecords) {
        const recordType = (record.record_type || record.type || '').toUpperCase();
        const recordName = record.name || '';
        const recordValue = record.value || '';
        const recordStatus = record.status;
        
        // Skip verified records
        if (recordStatus === 'verified') continue;
        
        // CRITICAL: Compute FQDN for DNS lookup
        const fqdn = toFqdn(recordName, emailDomain.domain);
        
        console.log(JSON.stringify({
          event: 'dns_lookup_start',
          domain: emailDomain.domain,
          recordType,
          recordNameFromProvider: recordName,
          fqdnQueried: fqdn,
          expectedValue: recordValue,
          resolver: 'cloudflare_doh'
        }));
        
        // Check for CNAME conflicts on non-DKIM records (send subdomain typically)
        // DKIM records should be CNAME, so we don't check for conflicts on those
        if ((recordType === 'MX' || recordType === 'TXT') && !recordName.includes('_domainkey')) {
          const conflict = await detectCnameConflict(fqdn);
          
          if (conflict.hasConflict) {
            console.log(JSON.stringify({
              event: 'dns_conflict_detected',
              hostname: fqdn,
              cnameTarget: conflict.cnameTarget,
              mxExists: conflict.mxExists,
              txtExists: conflict.txtExists,
              message: 'CNAME conflicts with MX/TXT records - invalid DNS configuration'
            }));
            
            dnsConflictDetected = true;
            conflictDetails.push({
              hostname: fqdn,
              conflictType: 'cname_with_mx_txt',
              cnameTarget: conflict.cnameTarget,
              mxExists: conflict.mxExists,
              txtExists: conflict.txtExists
            });
          }
        }
        
        if (recordType === 'TXT') {
          const { found, actualValues } = await verifyDNSRecordDirectly(fqdn, 'TXT', recordValue);
          recordDnsStatus[recordName] = { found, actualValues, fqdn };
          
          console.log(JSON.stringify({
            event: 'dns_lookup_result',
            domain: emailDomain.domain,
            recordType: 'TXT',
            fqdnQueried: fqdn,
            found,
            actualValues,
            expectedValue: recordValue,
            resolver: 'cloudflare_doh'
          }));
          
          if (found) {
            if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
              dkimDnsVerified = true;
            } else {
              spfDnsVerified = true;
            }
          }
        } else if (recordType === 'CNAME') {
          const { found, actualValues } = await verifyDNSRecordDirectly(fqdn, 'CNAME', recordValue);
          recordDnsStatus[recordName] = { found, actualValues, fqdn };
          
          console.log(JSON.stringify({
            event: 'dns_lookup_result',
            domain: emailDomain.domain,
            recordType: 'CNAME',
            fqdnQueried: fqdn,
            found,
            actualValues,
            expectedValue: recordValue,
            resolver: 'cloudflare_doh'
          }));
          
          if (found) {
            if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
              dkimDnsVerified = true;
            }
          }
        } else if (recordType === 'MX') {
          const { found, actualValues } = await verifyDNSRecordDirectly(fqdn, 'MX', recordValue, record.priority);
          recordDnsStatus[recordName] = { found, actualValues, fqdn };
          
          console.log(JSON.stringify({
            event: 'dns_lookup_result',
            domain: emailDomain.domain,
            recordType: 'MX',
            fqdnQueried: fqdn,
            found,
            actualValues,
            expectedValue: recordValue,
            priority: record.priority,
            resolver: 'cloudflare_doh'
          }));
          
          if (found) {
            mxDnsVerified = true;
          }
        }
      }
      
      const allDnsVerified = dkimDnsVerified && spfDnsVerified && mxDnsVerified;
      console.log(`📊 Independent DNS results: DKIM=${dkimDnsVerified}, SPF=${spfDnsVerified}, MX=${mxDnsVerified}, AllDNS=${allDnsVerified}, ConflictDetected=${dnsConflictDetected}`);
      
      // Update checks with DNS verification status
      checks.find(c => c.check_name === 'dkim')!.dns_verified = dkimDnsVerified;
      checks.find(c => c.check_name === 'spf')!.dns_verified = spfDnsVerified;
      checks.find(c => c.check_name === 'return_path')!.dns_verified = mxDnsVerified;
      
      // Add a combined DNS verification check
      const dnsVerificationCheck: DNSCheck = {
        check_name: 'dns_direct',
        ok: allDnsVerified && !dnsConflictDetected,
        dns_verified: allDnsVerified,
        details: {
          dkim_dns_verified: dkimDnsVerified,
          spf_dns_verified: spfDnsVerified,
          mx_dns_verified: mxDnsVerified,
          conflict_detected: dnsConflictDetected,
          conflict_details: conflictDetails,
          message: dnsConflictDetected
            ? 'DNS conflict detected - CNAME coexists with MX/TXT at same hostname'
            : allDnsVerified 
              ? 'All DNS records verified via direct lookup' 
              : 'Some DNS records not yet propagated'
        }
      };
      checks.push(dnsVerificationCheck);

    } catch (resendError: any) {
      console.error('❌ Resend verification error:', resendError);
      
      const errorCheck: DNSCheck = {
        check_name: 'resend_api',
        ok: false,
        details: {
          error: resendError?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
      checks.push(errorCheck);
      allPassed = false;
    }

    // Step 5: Insert/update DNS checks in database
    for (const check of checks) {
      const { error: checkError } = await supabase
        .from('email_dns_checks')
        .upsert({
          email_domain_id: emailDomain.id,
          check_name: check.check_name,
          ok: check.ok,
          details: check.details,
          checked_at: new Date().toISOString()
        }, {
          onConflict: 'email_domain_id,check_name'
        });

      if (checkError) {
        console.error(`❌ Failed to save check ${check.check_name}:`, checkError);
      }
    }

    // Step 6: Calculate new status and retry info
    const newAttempts = currentAttempts + 1;
    
    // Determine verification phase for UI
    const dnsDirectCheck = checks.find(c => c.check_name === 'dns_direct');
    const allDnsVerified = dnsDirectCheck?.dns_verified || false;
    const dnsVerifiedButResendPending = allDnsVerified && !allPassed && !dnsConflictDetected;
    
    let verificationPhase: string;
    if (dnsConflictDetected) {
      verificationPhase = 'dns_conflict';
    } else if (!allDnsVerified) {
      verificationPhase = 'dns_missing';
    } else if (!allPassed) {
      verificationPhase = 'dns_present_waiting_provider';
    } else {
      verificationPhase = 'provider_verified';
    }
    
    // Status is conflict if conflict detected, otherwise map from Resend
    const newStatus = dnsConflictDetected 
      ? 'pending_dns' 
      : mapResendStatus(resendDomainStatus?.status, allPassed);
    
    const errorMessage = allPassed ? null : buildVerificationError(checks, resendRecords, dnsConflictDetected);
    const nextVerifyAt = calculateNextVerifyAt(newAttempts, allPassed);

    console.log(`📊 Status update: ${emailDomain.status} -> ${newStatus}, phase: ${verificationPhase}, attempts: ${newAttempts}, next_verify: ${nextVerifyAt?.toISOString() || 'none'}`);

    // Step 7: Update domain status with all retry fields
    const updateData: any = {
      status: newStatus,
      error: errorMessage,
      last_verify_attempt_at: new Date().toISOString(),
      verify_attempts: newAttempts,
      last_verify_error: errorMessage,
      resend_status: {
        status: resendDomainStatus?.status,
        dkim_verified: checks.find(c => c.check_name === 'dkim')?.ok || false,
        spf_verified: checks.find(c => c.check_name === 'spf')?.ok || false,
        return_path_verified: checks.find(c => c.check_name === 'return_path')?.ok || false,
        dns_conflict_detected: dnsConflictDetected,
        dns_conflict_details: conflictDetails,
        verification_phase: verificationPhase,
        // Include per-record status for UI
        records: resendRecords.map((r: ResendRecord) => {
          const recordName = r.name || '';
          const fqdn = toFqdn(recordName, emailDomain.domain);
          const dnsStatus = recordDnsStatus?.[recordName];
          const hasConflict = conflictDetails.some(c => c.hostname === fqdn);
          
          return {
            record: r.record_type || r.type,
            type: r.record_type || r.type,
            name: r.name,
            fqdn_queried: fqdn,
            value: r.value,
            status: r.status,
            dns_verified: r.status === 'verified' || dnsStatus?.found || false,
            has_conflict: hasConflict
          };
        })
      },
      next_verify_at: nextVerifyAt?.toISOString() || null,
      updated_at: new Date().toISOString()
    };

    if (allPassed && !emailDomain.verified_at) {
      updateData.verified_at = new Date().toISOString();
    }

    const { error: updateError, data: updatedDomain } = await supabase
      .from('email_domains')
      .update(updateData)
      .eq('id', emailDomain.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update domain status:', updateError);
    }

    // Step 8: Sync to company_profiles when domain becomes active
    if (allPassed && newStatus === 'active') {
      console.log(`📝 Syncing verified domain to company_profiles...`);
      
      const { data: tenantUser } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', emailDomain.tenant_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (tenantUser?.id) {
        const { error: profileError } = await supabase
          .from('company_profiles')
          .update({
            email_auth_status: 'verified',
            email_domain: emailDomain.domain,
            custom_sender_email: `mail@${emailDomain.domain}`,
            dns_records_verified: true,
            email_auth_setup_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', tenantUser.id);
        
        if (profileError) {
          console.error('⚠️ Failed to sync to company_profiles:', profileError);
        } else {
          console.log(`✅ Synced domain ${emailDomain.domain} to company_profile for user ${tenantUser.id}`);
        }
      }
    }

    console.log(`🎉 Domain verification completed: ${emailDomain.domain} -> ${newStatus} (phase: ${verificationPhase})`);

    const response = {
      ok: allPassed,
      allVerified: allPassed,
      dns_verified: allDnsVerified,
      dns_verified_resend_pending: dnsVerifiedButResendPending,
      dns_conflict_detected: dnsConflictDetected,
      dns_conflict_details: conflictDetails,
      verification_phase: verificationPhase,
      suggested_auto_fix_available: dnsConflictDetected && emailDomain.is_entri_managed,
      status: newStatus,
      domain: emailDomain.domain,
      verify_attempts: newAttempts,
      last_verify_attempt_at: updateData.last_verify_attempt_at,
      next_verify_at: updateData.next_verify_at,
      verified_at: updateData.verified_at || null,
      message: allPassed 
        ? 'Domain verification successful! All DNS records verified.' 
        : dnsConflictDetected
          ? 'DNS conflict detected: CNAME record conflicts with MX/TXT records at the same hostname. Click "Fix DNS Conflict" to repair automatically.'
          : dnsVerifiedButResendPending
            ? 'DNS records verified! Waiting for Resend to confirm (this can take up to a few hours).'
            : errorMessage || 'Some verification checks failed',
      checks: checks.map(c => ({
        name: c.check_name,
        passed: c.ok,
        dns_verified: c.dns_verified,
        details: c.details
      })),
      resend_status: updateData.resend_status,
      // Include pending records for UI display with DNS status
      pending_records: resendRecords
        .filter((r: ResendRecord) => r.status !== 'verified')
        .map((r: ResendRecord) => {
          const recordName = r.name || '';
          const fqdn = toFqdn(recordName, emailDomain.domain);
          const hasConflict = conflictDetails.some(c => c.hostname === fqdn);
          
          return {
            type: r.record_type || r.type,
            name: r.name,
            fqdn_queried: fqdn,
            status: r.status,
            has_conflict: hasConflict,
            dns_verified: checks.find(c => 
              (c.check_name === 'dkim' && ((r.name?.includes('dkim') || r.name?.includes('_domainkey')))) ||
              (c.check_name === 'spf' && r.record_type === 'TXT' && !r.name?.includes('_domainkey')) ||
              (c.check_name === 'return_path' && r.record_type === 'MX')
            )?.dns_verified || false
          };
        })
    };

    return corsJsonResponse(response);

  } catch (error: any) {
    console.error('❌ Email domain verification error:', error);
    return corsJsonResponse({ 
      error: 'Internal server error',
      message: error?.message || 'Something went wrong during verification. Please try again or contact support.'
    }, { status: 500 });
  }
};

serve(handler);
