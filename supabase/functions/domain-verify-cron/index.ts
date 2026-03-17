import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

/**
 * Domain Verification Cron Job
 * 
 * Runs every 2 minutes to automatically verify domains that are pending verification.
 * This ensures domains get verified even if the user doesn't manually click "Verify".
 * 
 * Logic:
 * 1. Find domains with status in (pending_dns, verifying, pending) where next_verify_at <= now()
 * 2. Call email-domain-verify for each domain
 * 3. Update database with results
 */

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  console.log("🕐 Domain verification cron job started");

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Find domains due for verification
    const now = new Date().toISOString();
    const { data: pendingDomains, error: fetchError } = await supabase
      .from('email_domains')
      .select('id, domain, tenant_id, status, verify_attempts, next_verify_at')
      .in('status', ['pending_dns', 'verifying', 'pending'])
      .not('resend_domain_id', 'is', null)
      .or(`next_verify_at.lte.${now},next_verify_at.is.null`)
      .lt('verify_attempts', 10)
      .order('next_verify_at', { ascending: true, nullsFirst: true })
      .limit(10); // Process max 10 at a time to avoid timeout

    if (fetchError) {
      console.error('❌ Error fetching pending domains:', fetchError);
      return corsJsonResponse({ 
        error: 'Failed to fetch pending domains',
        details: fetchError 
      }, { status: 500 });
    }

    if (!pendingDomains || pendingDomains.length === 0) {
      console.log("✅ No domains pending verification");
      return corsJsonResponse({ 
        success: true, 
        message: 'No domains pending verification',
        domains_processed: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`📋 Found ${pendingDomains.length} domains to verify`);

    const results: any[] = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Process each domain
    for (const domain of pendingDomains) {
      console.log(`🔍 Verifying domain: ${domain.domain} (attempts: ${domain.verify_attempts})`);
      
      try {
        // Call the email-domain-verify function directly
        const verifyResponse = await fetch(
          `${supabaseUrl}/functions/v1/email-domain-verify`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              email_domain_id: domain.id
            })
          }
        );

        const verifyResult = await verifyResponse.json();
        
        results.push({
          domain_id: domain.id,
          domain: domain.domain,
          success: verifyResult.ok || false,
          status: verifyResult.status,
          message: verifyResult.message,
          verify_attempts: verifyResult.verify_attempts
        });

        console.log(`✅ Domain ${domain.domain}: ${verifyResult.status} (attempt ${verifyResult.verify_attempts})`);

      } catch (verifyError: any) {
        console.error(`❌ Error verifying ${domain.domain}:`, verifyError);
        
        // Update the domain with the error
        await supabase
          .from('email_domains')
          .update({
            last_verify_error: `Cron verification failed: ${verifyError?.message || 'Unknown error'}`,
            last_verify_attempt_at: new Date().toISOString(),
            verify_attempts: (domain.verify_attempts || 0) + 1
          })
          .eq('id', domain.id);

        results.push({
          domain_id: domain.id,
          domain: domain.domain,
          success: false,
          error: verifyError?.message || 'Unknown error'
        });
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const duration = Date.now() - startTime;

    console.log(`🎉 Cron job completed: ${successCount}/${results.length} domains verified successfully in ${duration}ms`);

    return corsJsonResponse({
      success: true,
      message: `Processed ${results.length} domains`,
      domains_processed: results.length,
      domains_verified: successCount,
      duration_ms: duration,
      results
    });

  } catch (error: any) {
    console.error('❌ Domain verification cron error:', error);
    return corsJsonResponse({ 
      error: 'Cron job failed',
      message: error?.message || 'Unknown error',
      duration_ms: Date.now() - startTime
    }, { status: 500 });
  }
};

serve(handler);
