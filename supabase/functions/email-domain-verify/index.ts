
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface VerifyDomainRequest {
  domainId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { domainId }: VerifyDomainRequest = await req.json();

    if (!domainId) {
      return new Response(
        JSON.stringify({ error: 'Domain ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the email domain
    const { data: emailDomain, error: domainError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (domainError || !emailDomain) {
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get required DNS records
    const { data: dnsRecords, error: recordsError } = await supabase
      .from('email_dns_records')
      .select('*')
      .eq('email_domain_id', domainId)
      .eq('required', true);

    if (recordsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch DNS records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Verifying DNS records for domain: ${emailDomain.domain}`);

    const checkResults = [];
    let allPassed = true;

    // Verify each DNS record
    for (const record of dnsRecords || []) {
      try {
        console.log(`Checking ${record.type} record for ${record.name}: ${record.value.substring(0, 50)}...`);
        
        let verified = false;
        
        if (record.type === 'TXT') {
          verified = await verifyTXTRecord(record.name === '@' ? emailDomain.domain : `${record.name}.${emailDomain.domain}`, record.value);
        } else if (record.type === 'CNAME') {
          verified = await verifyCNAMERecord(record.name === '@' ? emailDomain.domain : `${record.name}.${emailDomain.domain}`, record.value);
        }

        const checkResult = {
          record_id: record.id,
          check_name: record.purpose,
          ok: verified,
          details: {
            name: record.name,
            type: record.type,
            expected: record.value,
            purpose: record.purpose
          }
        };

        checkResults.push(checkResult);
        
        if (!verified) {
          allPassed = false;
        }

        console.log(`${record.purpose} verification: ${verified ? '✅' : '❌'}`);

      } catch (error) {
        console.error(`Error verifying ${record.purpose} record:`, error);
        
        const checkResult = {
          record_id: record.id,
          check_name: record.purpose,
          ok: false,
          details: {
            name: record.name,
            type: record.type,
            expected: record.value,
            purpose: record.purpose,
            error: error.message
          }
        };
        
        checkResults.push(checkResult);
        allPassed = false;
      }
    }

    // Save check results
    const checksToInsert = checkResults.map(result => ({
      email_domain_id: domainId,
      check_name: result.check_name,
      ok: result.ok,
      details: result.details
    }));

    await supabase
      .from('email_dns_checks')
      .insert(checksToInsert);

    let newStatus = emailDomain.status;
    let message = 'DNS verification completed.';

    if (allPassed) {
      // All DNS checks passed, try to verify with Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey && emailDomain.resend_domain_id) {
        try {
          const resend = new Resend(resendApiKey);
          const verifyResult = await resend.domains.verify(emailDomain.resend_domain_id);
          
          if (verifyResult.error) {
            console.error('Resend verification failed:', verifyResult.error);
            message = 'DNS records verified but Resend verification pending.';
            newStatus = 'verifying';
          } else {
            console.log('✅ Resend verification successful');
            newStatus = 'active';
            message = 'Domain fully verified and active!';
          }
        } catch (resendError) {
          console.error('Resend verification error:', resendError);
          message = 'DNS records verified but Resend verification failed.';
          newStatus = 'verifying';
        }
      } else {
        newStatus = 'active';
        message = 'DNS records verified! Domain is ready for use.';
      }
    } else {
      newStatus = 'verifying';
      message = 'Some DNS records are not yet configured correctly.';
    }

    // Update domain status
    await supabase
      .from('email_domains')
      .update({ 
        status: newStatus,
        error: allPassed ? null : 'DNS verification incomplete'
      })
      .eq('id', domainId);

    console.log(`✅ Domain verification completed: ${emailDomain.domain} - Status: ${newStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        domain: emailDomain.domain,
        status: newStatus,
        allVerified: allPassed,
        checks: checkResults,
        message: message
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Verify email domain error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Something went wrong during verification. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// Helper function to verify TXT records using DNS over HTTPS
async function verifyTXTRecord(name: string, expectedValue: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      {
        headers: {
          'Accept': 'application/dns-json'
        }
      }
    );

    if (!response.ok) {
      console.log(`DNS lookup failed for ${name}: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    if (!data.Answer || data.Answer.length === 0) {
      console.log(`No TXT records found for ${name}`);
      return false;
    }

    const txtRecords = data.Answer
      .filter((answer: any) => answer.type === 16)
      .map((answer: any) => answer.data.replace(/"/g, ''));

    // For DMARC records, check if the key components match
    if (expectedValue.startsWith('v=DMARC1')) {
      const found = txtRecords.some((record: string) => {
        return record.startsWith('v=DMARC1') && 
               record.includes('p=none') &&
               record.includes('rua=mailto:');
      });
      return found;
    }

    // For other records, check exact match or containment
    const found = txtRecords.some((record: string) => 
      record.includes(expectedValue) || expectedValue.includes(record)
    );

    return found;
  } catch (error) {
    console.error(`Error verifying TXT record for ${name}:`, error);
    return false;
  }
}

// Helper function to verify CNAME records
async function verifyCNAMERecord(name: string, expectedValue: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=CNAME`,
      {
        headers: {
          'Accept': 'application/dns-json'
        }
      }
    );

    if (!response.ok) {
      console.log(`DNS lookup failed for ${name}: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    if (!data.Answer || data.Answer.length === 0) {
      console.log(`No CNAME records found for ${name}`);
      return false;
    }

    const cnameRecords = data.Answer
      .filter((answer: any) => answer.type === 5)
      .map((answer: any) => answer.data.replace(/\.$/, ''));

    const found = cnameRecords.some((record: string) => 
      record === expectedValue || record.includes(expectedValue)
    );

    return found;
  } catch (error) {
    console.error(`Error verifying CNAME record for ${name}:`, error);
    return false;
  }
}

serve(handler);
