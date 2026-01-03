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
  presentRecordTypes: string[]; // NEW: Which record types are present at this hostname
  blockingType: string; // NEW: Which type is causing the conflict (usually CNAME)
  cnameTarget?: string;
  mxExists?: boolean;
  txtExists?: boolean;
}

// =========================================================
// Readiness Status Types (Single Source of Truth for UI)
// =========================================================

type ReadinessStatus = 
  | 'CONNECTED_READY'           // DNS verified, domain is working - primary success state
  | 'ACTION_REQUIRED_DNS_MISSING'
  | 'ACTION_REQUIRED_DNS_CONFLICT'
  | 'DOMAIN_NOT_CONNECTED';

interface ReadinessResult {
  status: ReadinessStatus;
  message: string;
  subMessage?: string;
  cta?: string | null;
}

interface ReadinessResponse {
  status: ReadinessStatus;
  message: string;
  subMessage?: string;
  cta: string | null;
}

interface DirectDnsCheck {
  record_type: string;
  fqdnQueried: string; // CRITICAL: Use consistent naming
  expected: string;
  found: boolean;
  actual_values: string[];
  resolverUsed: string;
  checkedAt: string;
}

interface DirectDnsResponse {
  verified: boolean;
  checks: DirectDnsCheck[];
}

interface ProviderResponse {
  status: string;
  dkim_verified: boolean;
  spf_verified: boolean;
  return_path_verified: boolean;
  last_checked_at: string;
}

interface ConflictsResponse {
  detected: boolean;
  details: ConflictDetail[];
}

// =========================================================
// FQDN Helper - Single Source of Truth for Hostname Normalization
// GUARDRAIL: All DNS lookups MUST use this function
// =========================================================

/**
 * Convert a record name to a fully-qualified domain name (FQDN).
 * Handles various input formats from Resend API.
 * 
 * CRITICAL: This is the ONLY function that should construct hostnames for DNS lookups.
 * 
 * @param recordName - The record name (may be relative, "@", empty, or already FQDN)
 * @param rootDomain - The root domain (e.g., "clearlychiro.com")
 * @returns Fully-qualified hostname without trailing dot
 */
function toFqdn(recordName: string, rootDomain: string): string {
  const name = (recordName || '').trim().toLowerCase().replace(/\.$/, '');
  const domain = rootDomain.trim().toLowerCase().replace(/\.$/, '');
  
  // Validate root domain has at least one dot
  if (!domain.includes('.')) {
    console.log(JSON.stringify({
      event: 'fqdn_error',
      error: 'invalid_root_domain',
      rootDomain: domain,
      message: `Root domain "${domain}" is invalid (no TLD). This is a bug.`
    }));
    return domain; // Return as-is, let the DNS lookup fail with clear error
  }
  
  // Empty or @ means root domain
  if (!name || name === '@') {
    return domain;
  }
  
  // Already FQDN (equals domain or ends with .domain)
  if (name === domain || name.endsWith(`.${domain}`)) {
    return name;
  }
  
  // Relative hostname - append domain
  const fqdn = `${name}.${domain}`;
  
  // Log for debugging
  console.log(JSON.stringify({
    event: 'fqdn_normalized',
    input: recordName,
    rootDomain: domain,
    output: fqdn
  }));
  
  return fqdn;
}

/**
 * Validate that a hostname is a proper FQDN before DNS lookup.
 * Returns true if valid, logs error and returns false if invalid.
 */
function validateFqdn(hostname: string, context: string): boolean {
  if (!hostname.includes('.')) {
    console.log(JSON.stringify({
      event: 'fqdn_validation_failed',
      error: 'hostname_not_fqdn',
      hostname,
      context,
      message: `BLOCKED: "${hostname}" is not a valid FQDN. DNS lookup would fail or query wrong host.`
    }));
    return false;
  }
  return true;
}

// =========================================================
// DNS Lookup with FQDN Guardrail
// =========================================================

const DNS_RESOLVER = 'cloudflare_doh';
const DNS_RESOLVER_URL = 'https://cloudflare-dns.com/dns-query';

/**
 * Perform a DNS lookup with automatic FQDN validation.
 * CRITICAL: This is the ONLY function that should make DNS queries.
 */
async function dnsLookup(
  hostname: string, 
  dnsType: number,
  context: string
): Promise<{ exists: boolean; values: string[]; error?: string }> {
  // GUARDRAIL: Validate FQDN before any lookup
  if (!validateFqdn(hostname, context)) {
    return { exists: false, values: [], error: 'invalid_fqdn' };
  }
  
  const normalizedHostname = hostname.toLowerCase().trim().replace(/\.$/, '');
  
  try {
    const url = `${DNS_RESOLVER_URL}?name=${encodeURIComponent(normalizedHostname)}&type=${dnsType}`;
    
    console.log(JSON.stringify({
      event: 'dns_lookup_request',
      hostname: normalizedHostname,
      dnsType,
      context,
      resolver: DNS_RESOLVER
    }));
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) {
      console.log(JSON.stringify({
        event: 'dns_lookup_http_error',
        hostname: normalizedHostname,
        dnsType,
        httpStatus: response.status
      }));
      return { exists: false, values: [] };
    }
    
    const data = await response.json();
    const answers = data.Answer || [];
    
    const values = answers.map((a: any) => {
      let val = a.data || '';
      // Remove trailing dots and quotes
      if (val.endsWith('.')) val = val.slice(0, -1);
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      return val;
    });
    
    return { exists: values.length > 0, values };
  } catch (error: any) {
    console.log(JSON.stringify({
      event: 'dns_lookup_exception',
      hostname: normalizedHostname,
      dnsType,
      error: error?.message
    }));
    return { exists: false, values: [], error: error?.message };
  }
}

// =========================================================
// CNAME Conflict Detection - Real Evidence-Based
// =========================================================

interface ConflictCheckResult {
  hasConflict: boolean;
  cnameExists: boolean;
  mxExists: boolean;
  txtExists: boolean;
  presentRecordTypes: string[];
  blockingType: string | null;
  cnameTarget?: string;
}

/**
 * Detect DNS conflicts at a hostname by querying all relevant record types.
 * CNAME cannot coexist with MX or TXT at the same hostname (RFC violation).
 */
async function detectCnameConflict(hostname: string): Promise<ConflictCheckResult> {
  // GUARDRAIL: Validate FQDN
  if (!validateFqdn(hostname, 'conflict_detection')) {
    return {
      hasConflict: false,
      cnameExists: false,
      mxExists: false,
      txtExists: false,
      presentRecordTypes: [],
      blockingType: null
    };
  }
  
  // Query all three record types in parallel
  const [cname, mx, txt] = await Promise.all([
    dnsLookup(hostname, 5, 'conflict_check_cname'),   // CNAME = 5
    dnsLookup(hostname, 15, 'conflict_check_mx'),     // MX = 15
    dnsLookup(hostname, 16, 'conflict_check_txt')     // TXT = 16
  ]);
  
  const presentRecordTypes: string[] = [];
  if (cname.exists) presentRecordTypes.push('CNAME');
  if (mx.exists) presentRecordTypes.push('MX');
  if (txt.exists) presentRecordTypes.push('TXT');
  
  // Conflict: CNAME exists AND (MX exists OR TXT exists)
  const hasConflict = cname.exists && (mx.exists || txt.exists);
  
  console.log(JSON.stringify({
    event: 'conflict_check_result',
    hostname,
    presentRecordTypes,
    hasConflict,
    cnameTarget: cname.values[0]
  }));
  
  return {
    hasConflict,
    cnameExists: cname.exists,
    mxExists: mx.exists,
    txtExists: txt.exists,
    presentRecordTypes,
    blockingType: hasConflict ? 'CNAME' : null,
    cnameTarget: cname.values[0]
  };
}

// =========================================================
// Independent DNS Verification via Cloudflare DoH
// =========================================================

interface DnsVerifyResult {
  found: boolean;
  actualValues: string[];
  fqdnQueried: string;
  resolverUsed: string;
  checkedAt: string;
}

async function verifyDNSRecordDirectly(
  fqdn: string, 
  type: 'TXT' | 'CNAME' | 'MX', 
  expectedValue: string,
  priority?: number
): Promise<DnsVerifyResult> {
  const checkedAt = new Date().toISOString();
  
  // GUARDRAIL: Validate FQDN
  if (!validateFqdn(fqdn, `verify_${type}`)) {
    return { 
      found: false, 
      actualValues: [], 
      fqdnQueried: fqdn, 
      resolverUsed: DNS_RESOLVER,
      checkedAt 
    };
  }
  
  const dnsType = type === 'TXT' ? 16 : type === 'CNAME' ? 5 : 15;
  const result = await dnsLookup(fqdn, dnsType, `verify_record_${type}`);
  
  if (result.error || !result.exists) {
    return { 
      found: false, 
      actualValues: result.values, 
      fqdnQueried: fqdn, 
      resolverUsed: DNS_RESOLVER,
      checkedAt 
    };
  }
  
  // Check if any of the returned values match expected
  let found = false;
  
  for (const value of result.values) {
    if (type === 'MX') {
      // MX format: "priority host" or just "host"
      const parts = value.split(' ');
      const mxPriority = parts.length > 1 ? parseInt(parts[0], 10) : undefined;
      const mxHost = (parts.length > 1 ? parts[1] : parts[0])?.replace(/\.$/, '') || '';
      
      if (priority !== undefined && mxPriority === priority && mxHost === expectedValue) {
        found = true;
        break;
      }
      if (mxHost === expectedValue || value.includes(expectedValue)) {
        found = true;
        break;
      }
    } else {
      // TXT/CNAME: check if value matches (substring match for flexibility)
      if (value === expectedValue || value.includes(expectedValue) || expectedValue.includes(value)) {
        found = true;
        break;
      }
    }
  }
  
  console.log(JSON.stringify({
    event: 'dns_verify_result',
    fqdnQueried: fqdn,
    type,
    expectedValue: expectedValue.substring(0, 50) + (expectedValue.length > 50 ? '...' : ''),
    found,
    actualCount: result.values.length
  }));
  
  return { 
    found, 
    actualValues: result.values, 
    fqdnQueried: fqdn, 
    resolverUsed: DNS_RESOLVER,
    checkedAt 
  };
}

// =========================================================
// Readiness Status Computation - Strict Rules
// =========================================================

/**
 * Compute the unified readiness status for the UI.
 * 
 * DEFINITION OF "WORKING" (for CONNECTED_READY):
 * - Entri connection completed successfully
 * - direct_dns.verified === true
 * - conflicts.detected === false
 * - Required DNS records (DKIM, SPF, return-path) are publicly resolvable
 * 
 * NOTE: Provider verification (Resend) is NOT part of this definition.
 * Provider verification happens silently in the background.
 * 
 * STRICT RULES (in priority order):
 * 1. DOMAIN_NOT_CONNECTED: Entri not completed or domain not managed
 * 2. ACTION_REQUIRED_DNS_CONFLICT: CNAME conflicts with MX/TXT
 * 3. CONNECTED_READY: DNS verified, domain is WORKING
 * 4. ACTION_REQUIRED_DNS_MISSING: DNS not verified
 */
function computeReadinessStatus(params: {
  resendStatus: string;
  allDnsVerified: boolean;
  dnsConflictDetected: boolean;
  isEntriManaged: boolean;
  entriConnectionId: string | null;
  allProviderVerified: boolean;
}): ReadinessResult {
  const { 
    allDnsVerified, 
    dnsConflictDetected, 
    isEntriManaged, 
    entriConnectionId
    // NOTE: We intentionally ignore resendStatus and allProviderVerified
    // Readiness is based on DNS truth, not provider verification
  } = params;
  
  // Priority 1: Domain not connected (Entri not completed)
  // Only show this if user hasn't set up Entri at all
  if (!isEntriManaged && !entriConnectionId) {
    return {
      status: 'DOMAIN_NOT_CONNECTED',
      message: "Domain isn't connected to BloomSuite yet.",
      subMessage: 'Set up automatic DNS configuration to get started.',
      cta: 'Connect DNS'
    };
  }
  
  // Priority 2: DNS conflict detected - Red, action required
  // IMPORTANT: This takes precedence over DNS missing
  if (dnsConflictDetected) {
    return {
      status: 'ACTION_REQUIRED_DNS_CONFLICT',
      message: 'A conflicting DNS record is blocking email setup.',
      subMessage: isEntriManaged ? 'We can fix this automatically.' : 'Please remove the conflicting CNAME record.',
      cta: isEntriManaged ? 'Fix DNS Conflict' : null
    };
  }
  
  // Priority 3: DNS verified = CONNECTED_READY (domain is WORKING)
  // This is the success state - user should feel DONE
  if (allDnsVerified) {
    return {
      status: 'CONNECTED_READY',
      message: 'Your email domain is connected and ready to use.',
      subMessage: null, // No sub-message needed - this is final
      cta: null
    };
  }
  
  // Priority 4: DNS not verified - Red, action required
  return {
    status: 'ACTION_REQUIRED_DNS_MISSING',
    message: 'DNS records not visible yet.',
    subMessage: isEntriManaged ? 'We can repair automatically.' : 'Please check your DNS configuration.',
    cta: isEntriManaged ? 'Repair DNS' : null
  };
}

// =========================================================
// Helper Functions
// =========================================================

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

function mapResendStatus(resendStatus: string, allChecksPassed: boolean, allDnsVerifiedIndependently: boolean): string {
  // If our independent DNS verification passes, mark as active even if Resend is still "pending"
  // This allows sending immediately while Resend's internal state catches up
  if (allDnsVerifiedIndependently) return 'active';
  if (allChecksPassed && resendStatus === 'verified') return 'active';
  if (resendStatus === 'pending' || resendStatus === 'not_started') return 'pending_dns';
  if (resendStatus === 'failed') return 'failed';
  return 'verifying';
}

function buildVerificationError(checks: DNSCheck[], resendRecords: ResendRecord[], conflictDetected: boolean): string {
  if (conflictDetected) {
    return 'DNS conflict detected: CNAME record conflicts with MX/TXT records. Click "Fix DNS Conflict" to repair.';
  }
  
  const failedChecks = checks.filter(c => !c.ok);
  if (failedChecks.length === 0) return '';
  
  const issues: string[] = [];
  
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

// =========================================================
// Main Handler
// =========================================================

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

    // Rate limiting check (5 minutes minimum between attempts)
    const lastAttempt = emailDomain.last_verify_attempt_at;
    const minIntervalMs = 5 * 60 * 1000; // 5 minutes
    
    if (!reset_attempts && lastAttempt) {
      const timeSinceLastAttempt = Date.now() - new Date(lastAttempt).getTime();
      if (timeSinceLastAttempt < minIntervalMs) {
        const retryAfterSeconds = Math.ceil((minIntervalMs - timeSinceLastAttempt) / 1000);
        console.log(`⏳ Rate limited: ${retryAfterSeconds}s until next attempt allowed`);
        return corsJsonResponse({
          error: 'rate_limited',
          message: `Please wait ${retryAfterSeconds} seconds before checking again.`,
          retry_after_seconds: retryAfterSeconds
        }, { status: 429 });
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
    
    // Track conflicts with enhanced detail
    let dnsConflictDetected = false;
    const conflictDetails: ConflictDetail[] = [];
    
    // Track per-record DNS verification status with full evidence
    const recordDnsStatus: Record<string, DnsVerifyResult & { hasConflict?: boolean }> = {};
    
    // Track DNS checks for evidence panel
    const dnsChecksForEvidence: DirectDnsCheck[] = [];

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
      // PHASE 1: Compute provider verification status from records
      // =========================================================
      
      let dkimVerified = false;
      let spfVerified = false;
      let mxVerified = false;
      let returnPathVerified = false;
      
      for (const record of resendRecords) {
        const recordType = record.record_type || record.type || '';
        const recordName = record.name || '';
        const recordStatus = record.status;
        const isVerified = recordStatus === 'verified';
        
        if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
          if (isVerified) dkimVerified = true;
          console.log(`  DKIM record: ${recordName} = ${recordStatus}`);
        }
        
        if (recordType === 'TXT' && !recordName.includes('_domainkey')) {
          if (isVerified) spfVerified = true;
          console.log(`  SPF/TXT record: ${recordName} = ${recordStatus}`);
        }
        
        if (recordType === 'MX') {
          if (isVerified) {
            mxVerified = true;
            returnPathVerified = true;
          }
          console.log(`  MX record: ${recordName} = ${recordStatus}`);
        }
        
        if (recordType === 'CNAME' && !recordName.includes('_domainkey')) {
          if (isVerified) returnPathVerified = true;
          console.log(`  CNAME record: ${recordName} = ${recordStatus}`);
        }
      }
      
      // Check top-level status as fallback
      if (domainStatus.status === 'verified') {
        dkimVerified = true;
        spfVerified = true;
        returnPathVerified = true;
      }
      
      // Build provider check results
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
      // PHASE 2: Independent DNS verification for ALL records
      // CRITICAL: Use toFqdn() ALWAYS before any DNS lookup
      // =========================================================
      console.log(`🔍 Running independent DNS verification...`);
      console.log(`   Root domain: ${emailDomain.domain}`);
      
      let dkimDnsVerified = dkimVerified;
      let spfDnsVerified = spfVerified;
      let mxDnsVerified = mxVerified;
      
      // Collect all unique hostnames that need conflict checking
      const hostnamesForConflictCheck = new Set<string>();
      
      for (const record of resendRecords) {
        const recordType = (record.record_type || record.type || '').toUpperCase();
        const recordName = record.name || '';
        const recordValue = record.value || '';
        const recordStatus = record.status;
        
        // CRITICAL: Compute FQDN using helper function
        const fqdn = toFqdn(recordName, emailDomain.domain);
        
        console.log(JSON.stringify({
          event: 'dns_verification_start',
          domain: emailDomain.domain,
          recordType,
          recordNameFromProvider: recordName,
          fqdnQueried: fqdn,
          expectedValue: recordValue.substring(0, 50) + (recordValue.length > 50 ? '...' : ''),
          resolver: DNS_RESOLVER
        }));
        
        // Track hostnames that might have conflicts (MX/TXT records, not DKIM)
        if ((recordType === 'MX' || recordType === 'TXT') && !recordName.includes('_domainkey')) {
          hostnamesForConflictCheck.add(fqdn);
        }
        
        // Skip already verified records for DNS lookup (but still include in evidence)
        if (recordStatus === 'verified') {
          dnsChecksForEvidence.push({
            record_type: recordType,
            fqdnQueried: fqdn,
            expected: recordValue,
            found: true,
            actual_values: [],
            resolverUsed: DNS_RESOLVER,
            checkedAt: new Date().toISOString()
          });
          continue;
        }
        
        // Perform DNS verification based on record type
        let verifyResult: DnsVerifyResult;
        
        if (recordType === 'TXT') {
          verifyResult = await verifyDNSRecordDirectly(fqdn, 'TXT', recordValue);
          recordDnsStatus[recordName] = verifyResult;
          
          if (verifyResult.found) {
            if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
              dkimDnsVerified = true;
            } else {
              spfDnsVerified = true;
            }
          }
        } else if (recordType === 'CNAME') {
          verifyResult = await verifyDNSRecordDirectly(fqdn, 'CNAME', recordValue);
          recordDnsStatus[recordName] = verifyResult;
          
          if (verifyResult.found) {
            if (recordName.includes('_domainkey') || recordName.includes('dkim')) {
              dkimDnsVerified = true;
            }
          }
        } else if (recordType === 'MX') {
          verifyResult = await verifyDNSRecordDirectly(fqdn, 'MX', recordValue, record.priority);
          recordDnsStatus[recordName] = verifyResult;
          
          if (verifyResult.found) {
            mxDnsVerified = true;
          }
        } else {
          continue;
        }
        
        // Add to evidence
        dnsChecksForEvidence.push({
          record_type: recordType,
          fqdnQueried: fqdn,
          expected: recordValue,
          found: verifyResult.found,
          actual_values: verifyResult.actualValues,
          resolverUsed: verifyResult.resolverUsed,
          checkedAt: verifyResult.checkedAt
        });
      }
      
      // =========================================================
      // PHASE 3: Conflict Detection for all relevant hostnames
      // =========================================================
      console.log(`🔍 Checking for DNS conflicts at ${hostnamesForConflictCheck.size} hostname(s)...`);
      
      for (const fqdn of hostnamesForConflictCheck) {
        const conflict = await detectCnameConflict(fqdn);
        
        if (conflict.hasConflict) {
          console.log(JSON.stringify({
            event: 'dns_conflict_detected',
            hostname: fqdn,
            presentRecordTypes: conflict.presentRecordTypes,
            blockingType: conflict.blockingType,
            cnameTarget: conflict.cnameTarget,
            message: 'CNAME conflicts with MX/TXT records - invalid DNS configuration'
          }));
          
          dnsConflictDetected = true;
          conflictDetails.push({
            hostname: fqdn,
            conflictType: 'cname_with_mx_txt',
            presentRecordTypes: conflict.presentRecordTypes,
            blockingType: conflict.blockingType || 'CNAME',
            cnameTarget: conflict.cnameTarget,
            mxExists: conflict.mxExists,
            txtExists: conflict.txtExists
          });
          
          // Mark affected records as having conflict
          for (const [recordName, status] of Object.entries(recordDnsStatus)) {
            if (status.fqdnQueried === fqdn) {
              status.hasConflict = true;
            }
          }
        }
      }
      
      const allDnsVerified = dkimDnsVerified && spfDnsVerified && mxDnsVerified;
      console.log(`📊 Independent DNS results: DKIM=${dkimDnsVerified}, SPF=${spfDnsVerified}, MX=${mxDnsVerified}, AllDNS=${allDnsVerified}, ConflictDetected=${dnsConflictDetected}`);
      
      // Update checks with DNS verification status
      const dkimCheckRef = checks.find(c => c.check_name === 'dkim');
      if (dkimCheckRef) dkimCheckRef.dns_verified = dkimDnsVerified;
      
      const spfCheckRef = checks.find(c => c.check_name === 'spf');
      if (spfCheckRef) spfCheckRef.dns_verified = spfDnsVerified;
      
      const returnPathCheckRef = checks.find(c => c.check_name === 'return_path');
      if (returnPathCheckRef) returnPathCheckRef.dns_verified = mxDnsVerified;
      
      // Add combined DNS verification check
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
    
    const newStatus = dnsConflictDetected 
      ? 'pending_dns' 
      : mapResendStatus(resendDomainStatus?.status, allPassed, allDnsVerified);

    const treatedAsActive = newStatus === 'active';
    const errorMessage = treatedAsActive ? null : (allPassed ? null : buildVerificationError(checks, resendRecords, dnsConflictDetected));
    const nextVerifyAt = treatedAsActive ? null : calculateNextVerifyAt(newAttempts, allPassed);

    console.log(`📊 Status update: ${emailDomain.status} -> ${newStatus}, phase: ${verificationPhase}, attempts: ${newAttempts}, next_verify: ${nextVerifyAt?.toISOString() || 'none'}`);

    // Step 7: Update domain status with all fields
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

    if ((allPassed || treatedAsActive) && !emailDomain.verified_at) {
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
    if (newStatus === 'active') {
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

    // Compute unified readiness status for UI
    const readinessResult = computeReadinessStatus({
      resendStatus: resendDomainStatus?.status || 'pending',
      allDnsVerified,
      dnsConflictDetected,
      isEntriManaged: emailDomain.is_entri_managed || false,
      entriConnectionId: emailDomain.entri_connection_id || null,
      allProviderVerified: allPassed
    });

    // Determine if CTA should be available (based on Entri availability)
    const entriRepairAvailable = emailDomain.is_entri_managed === true;
    const actualCta = readinessResult.cta && entriRepairAvailable ? readinessResult.cta : null;

    const response = {
      ok: allPassed,
      allVerified: allPassed,
      dns_verified: allDnsVerified,
      dns_verified_resend_pending: dnsVerifiedButResendPending,
      dns_conflict_detected: dnsConflictDetected,
      dns_conflict_details: conflictDetails,
      verification_phase: verificationPhase,
      suggested_auto_fix_available: dnsConflictDetected && entriRepairAvailable,
      status: newStatus,
      domain: emailDomain.domain,
      verify_attempts: newAttempts,
      last_verify_attempt_at: updateData.last_verify_attempt_at,
      next_verify_at: updateData.next_verify_at,
      verified_at: updateData.verified_at || null,
      
      // Unified readiness object for UI (single source of truth)
      readiness: {
        status: readinessResult.status,
        message: readinessResult.message,
        subMessage: readinessResult.subMessage || null,
        cta: actualCta // CTA only if Entri repair is available
      } as ReadinessResponse,
      
      // Structured data for evidence panel
      direct_dns: {
        verified: allDnsVerified,
        checks: dnsChecksForEvidence
      } as DirectDnsResponse,
      
      provider: {
        status: resendDomainStatus?.status || 'pending',
        dkim_verified: checks.find(c => c.check_name === 'dkim')?.ok || false,
        spf_verified: checks.find(c => c.check_name === 'spf')?.ok || false,
        return_path_verified: checks.find(c => c.check_name === 'return_path')?.ok || false,
        last_checked_at: new Date().toISOString()
      } as ProviderResponse,
      
      conflicts: {
        detected: dnsConflictDetected,
        details: conflictDetails
      } as ConflictsResponse,
      
      timestamps: {
        last_dns_check_at: new Date().toISOString(),
        last_provider_check_at: new Date().toISOString()
      },
      
      // Legacy fields for backwards compatibility
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
            dns_verified: recordDnsStatus[recordName]?.found || false
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
