import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface VerifyDomainRequest {
  domainId?: string;
  email_domain_id?: string;
  reset_attempts?: boolean; // Used when retrying a failed domain
}

interface DNSCheck {
  check_name: string;
  ok: boolean;
  details: any;
}

// Retry policy: interval based on attempt number
function getNextVerifyInterval(attempts: number): number {
  if (attempts <= 3) return 2 * 60 * 1000; // 2 minutes
  if (attempts <= 6) return 5 * 60 * 1000; // 5 minutes
  return 15 * 60 * 1000; // 15 minutes
}

// Calculate next verify time
function calculateNextVerifyAt(attempts: number, allPassed: boolean): Date | null {
  if (allPassed) return null; // No retry needed if verified
  if (attempts >= 10) return null; // Max attempts reached
  
  const interval = getNextVerifyInterval(attempts + 1);
  return new Date(Date.now() + interval);
}

// Map Resend status to our status
function mapResendStatus(resendStatus: string, allChecksPassed: boolean): string {
  if (allChecksPassed && resendStatus === 'verified') return 'active';
  if (resendStatus === 'pending' || resendStatus === 'not_started') return 'pending_dns';
  if (resendStatus === 'failed') return 'failed';
  return 'verifying';
}

// Build human-readable error message
function buildVerificationError(checks: DNSCheck[], resendStatus: any): string {
  const failedChecks = checks.filter(c => !c.ok);
  if (failedChecks.length === 0) return '';
  
  const checkNames = failedChecks.map(c => c.check_name).join(', ');
  
  // Check for domain mismatch
  if (resendStatus?.records) {
    const records = resendStatus.records;
    for (const record of records) {
      if (record.name && record.status !== 'verified') {
        // This could indicate a mismatch
        const recordHost = record.name.split('.')[0];
        if (recordHost === 'send' || recordHost === 'mail') {
          return `DNS records not verified for ${record.name}. Check: ${checkNames}. Ensure DNS records are applied to the correct subdomain.`;
        }
      }
    }
  }
  
  return `Verification incomplete: ${checkNames} failed. DNS records may still be propagating (can take up to 48 hours).`;
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
    
    // Check for Authorization header (could be user JWT or service role for cron)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isServiceRole = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      // Check if it's a service role call (from cron)
      if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        isServiceRole = true;
        console.log("🔑 Service role access - cron job");
      } else {
        // Verify user authentication
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

    // Get domain information
    const { data: emailDomain, error: domainError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', finalDomainId)
      .single();

    if (domainError || !emailDomain) {
      console.error('❌ Domain not found:', domainError);
      return corsJsonResponse({ error: 'Domain not found' }, { status: 404 });
    }

    // Verify user has access to this domain's tenant (unless service role)
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

    // Reset attempts if requested (retry button for failed domains)
    let currentAttempts = emailDomain.verify_attempts || 0;
    if (reset_attempts) {
      currentAttempts = 0;
      console.log("🔄 Resetting verification attempts to 0");
    }

    // Check if max attempts reached
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

    // Setup Resend
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
      
      // Step 2: Wait for Resend to process (2 seconds)
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
      console.log(`📊 Resend domain status:`, JSON.stringify(domainStatus, null, 2));

      // Step 4: Build DNS check results
      
      // Check DKIM status
      const dkimCheck: DNSCheck = {
        check_name: 'dkim',
        ok: domainStatus.status === 'verified' || domainStatus.dkim_verified === true,
        details: {
          status: domainStatus.status,
          dkim_verified: domainStatus.dkim_verified,
          records: domainStatus.records?.filter((r: any) => r.type === 'DKIM' || r.name?.includes('dkim'))
        }
      };
      checks.push(dkimCheck);
      if (!dkimCheck.ok) allPassed = false;

      // Check SPF status
      const spfCheck: DNSCheck = {
        check_name: 'spf',
        ok: domainStatus.spf_verified === true,
        details: {
          spf_verified: domainStatus.spf_verified,
          spf_record: domainStatus.records?.find((r: any) => r.record_type === 'TXT' && r.value?.includes('spf1'))
        }
      };
      checks.push(spfCheck);
      if (!spfCheck.ok) allPassed = false;

      // Check return path (CNAME) status
      const returnPathCheck: DNSCheck = {
        check_name: 'return_path',
        ok: domainStatus.return_path_verified === true,
        details: {
          return_path_verified: domainStatus.return_path_verified,
          return_path_record: domainStatus.records?.find((r: any) => r.record_type === 'CNAME')
        }
      };
      checks.push(returnPathCheck);
      if (!returnPathCheck.ok) allPassed = false;

      // Check overall domain verification
      const verificationCheck: DNSCheck = {
        check_name: 'domain_verification',
        ok: domainStatus.status === 'verified',
        details: {
          status: domainStatus.status,
          verification_record: domainStatus.records?.find((r: any) => r.name?.includes('_resend'))
        }
      };
      checks.push(verificationCheck);
      if (!verificationCheck.ok) allPassed = false;

    } catch (resendError: any) {
      console.error('❌ Resend verification error:', resendError);
      
      // Create a generic error check
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
    const newStatus = mapResendStatus(resendDomainStatus?.status, allPassed);
    const errorMessage = allPassed ? null : buildVerificationError(checks, resendDomainStatus);
    const nextVerifyAt = calculateNextVerifyAt(newAttempts, allPassed);

    console.log(`📊 Status update: ${emailDomain.status} -> ${newStatus}, attempts: ${newAttempts}, next_verify: ${nextVerifyAt?.toISOString() || 'none'}`);

    // Step 7: Update domain status with all retry fields
    const updateData: any = {
      status: newStatus,
      error: errorMessage,
      last_verify_attempt_at: new Date().toISOString(),
      verify_attempts: newAttempts,
      last_verify_error: errorMessage,
      resend_status: resendDomainStatus,
      next_verify_at: nextVerifyAt?.toISOString() || null,
      updated_at: new Date().toISOString()
    };

    // Set verified_at if newly verified
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

    console.log(`🎉 Domain verification completed: ${emailDomain.domain} -> ${newStatus}`);

    // Build response
    const response = {
      ok: allPassed,
      allVerified: allPassed,
      status: newStatus,
      domain: emailDomain.domain,
      verify_attempts: newAttempts,
      last_verify_attempt_at: updateData.last_verify_attempt_at,
      next_verify_at: updateData.next_verify_at,
      verified_at: updateData.verified_at || null,
      message: allPassed 
        ? 'Domain verification successful! All DNS records verified.' 
        : errorMessage || 'Some verification checks failed',
      checks: checks.map(c => ({
        name: c.check_name,
        passed: c.ok,
        details: c.details
      })),
      resend_status: {
        status: resendDomainStatus?.status,
        dkim_verified: resendDomainStatus?.dkim_verified,
        spf_verified: resendDomainStatus?.spf_verified,
        return_path_verified: resendDomainStatus?.return_path_verified
      }
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
