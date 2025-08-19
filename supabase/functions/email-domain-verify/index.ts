import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

interface VerifyDomainRequest {
  domainId?: string;
  email_domain_id?: string;
}

interface DNSCheck {
  check_name: string;
  ok: boolean;
  details: any;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    console.log("🔍 Starting email domain verification");
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 });
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    const { domainId, email_domain_id }: VerifyDomainRequest = await req.json();
    const finalDomainId = domainId || email_domain_id;

    if (!finalDomainId) {
      return corsJsonResponse({ error: 'Domain ID is required' }, { status: 400 });
    }

    console.log(`🔍 Verifying domain: ${finalDomainId}`);

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

    if (!emailDomain.resend_domain_id) {
      return corsJsonResponse({ error: 'No Resend domain ID found' }, { status: 400 });
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

    try {
      console.log(`📧 Retrieving Resend domain status: ${emailDomain.resend_domain_id}`);
      
      // Get domain status from Resend
      const { data: domainStatus, error: statusError } = await resend.domains.get(emailDomain.resend_domain_id);
      
      if (statusError) {
        console.error('❌ Resend status error:', statusError);
        return corsJsonResponse({ 
          error: 'Failed to verify domain',
          message: 'Unable to check domain status. Please try again.',
          details: statusError
        }, { status: 400 });
      }

      console.log(`📊 Resend domain status:`, domainStatus);

      // Check DKIM status
      const dkimCheck: DNSCheck = {
        check_name: 'dkim',
        ok: domainStatus.status === 'verified' || domainStatus.dkim_verified === true,
        details: {
          status: domainStatus.status,
          dkim_verified: domainStatus.dkim_verified,
          records: domainStatus.records
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
          spf_record: domainStatus.records?.find(r => r.record_type === 'TXT' && r.value?.includes('spf1'))
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
          return_path_record: domainStatus.records?.find(r => r.record_type === 'CNAME')
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
          verification_record: domainStatus.records?.find(r => r.name?.includes('_resend'))
        }
      };
      checks.push(verificationCheck);
      if (!verificationCheck.ok) allPassed = false;

      // Try to call verify if available (some Resend versions support this)
      try {
        if (resend.domains.verify && typeof resend.domains.verify === 'function') {
          console.log(`🔄 Triggering Resend verification for: ${emailDomain.resend_domain_id}`);
          await resend.domains.verify(emailDomain.resend_domain_id);
        }
      } catch (verifyError) {
        console.log(`⚠️ Resend verify method not available or failed: ${verifyError.message}`);
      }

    } catch (resendError) {
      console.error('❌ Resend verification error:', resendError);
      
      // Create a generic error check
      const errorCheck: DNSCheck = {
        check_name: 'resend_api',
        ok: false,
        details: {
          error: resendError.message,
          timestamp: new Date().toISOString()
        }
      };
      checks.push(errorCheck);
      allPassed = false;
    }

    // Insert/update DNS checks in database
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

    // Update domain status
    let newStatus = 'verifying';
    let errorMessage = null;

    if (allPassed) {
      newStatus = 'active';
      console.log(`✅ All checks passed - domain is active`);
    } else {
      const failedChecks = checks.filter(c => !c.ok);
      errorMessage = `Verification incomplete: ${failedChecks.map(c => c.check_name).join(', ')} failed`;
      console.log(`⚠️ Some checks failed: ${errorMessage}`);
    }

    const { error: updateError } = await supabase
      .from('email_domains')
      .update({
        status: newStatus,
        error: errorMessage
      })
      .eq('id', emailDomain.id);

    if (updateError) {
      console.error('❌ Failed to update domain status:', updateError);
    }

    console.log(`🎉 Domain verification completed: ${emailDomain.domain} -> ${newStatus}`);

    return corsJsonResponse({
      ok: allPassed,
      status: newStatus,
      checks: checks.map(c => ({
        name: c.check_name,
        passed: c.ok,
        details: c.details
      })),
      domain: emailDomain.domain,
      message: allPassed ? 'Domain verification successful' : 'Some verification checks failed'
    });

  } catch (error) {
    console.error('❌ Email domain verification error:', error);
    return corsJsonResponse({ 
      error: 'Internal server error',
      message: 'Something went wrong during verification. Please try again or contact support.'
    }, { status: 500 });
  }
};

serve(handler);