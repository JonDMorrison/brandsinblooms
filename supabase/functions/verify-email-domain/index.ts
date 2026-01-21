import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  description: string;
  verified: boolean;
}

interface VerifyDomainRequest {
  domain: string;
  records: DNSRecord[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, records }: VerifyDomainRequest = await req.json();

    console.log(`Verifying DNS records for domain: ${domain}`);

    const verificationResults = await Promise.all(
      records.map(async (record) => {
        try {
          let verified = false;
          
          // For demonstration purposes, we'll simulate DNS verification
          // In a real implementation, you would use DNS lookup APIs
          console.log(`Checking ${record.type} record for ${record.name}: ${record.value}`);
          
          // DNS verification using Cloudflare DNS over HTTPS
          if (record.type === 'TXT') {
            verified = await verifyTXTRecord(record.name, record.value);
          } else if (record.type === 'CNAME') {
            verified = await verifyCNAMERecord(record.name, record.value);
          } else if (record.type === 'MX') {
            verified = await verifyMXRecord(record.name, record.value);
          }

          console.log(`Verification result for ${record.name}: ${verified}`);
          
          return {
            type: record.type,
            name: record.name,
            verified,
            error: null
          };
        } catch (error) {
          console.error(`Error verifying ${record.type} record:`, error);
          return {
            type: record.type,
            name: record.name,
            verified: false,
            error: error.message
          };
        }
      })
    );

    const allVerified = verificationResults.every(result => result.verified);

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        allVerified,
        results: verificationResults
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in verify-email-domain function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Failed to verify DNS records'
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

// Helper function to verify TXT records using DNS over HTTPS
async function verifyTXTRecord(name: string, expectedValue: string): Promise<boolean> {
  try {
    // Use Cloudflare DNS over HTTPS API
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

    // Check if any of the TXT records match our expected value
    const txtRecords = data.Answer
      .filter((answer: any) => answer.type === 16) // TXT record type
      .map((answer: any) => answer.data.replace(/"/g, '')); // Remove quotes

    const found = txtRecords.some((record: string) => 
      record.includes(expectedValue) || expectedValue.includes(record)
    );

    console.log(`TXT records for ${name}:`, txtRecords);
    console.log(`Looking for: ${expectedValue}`);
    console.log(`Match found: ${found}`);

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

    // Check CNAME records
    const cnameRecords = data.Answer
      .filter((answer: any) => answer.type === 5) // CNAME record type
      .map((answer: any) => answer.data.replace(/\.$/, '')); // Remove trailing dot

    const found = cnameRecords.some((record: string) => 
      record === expectedValue || record.includes(expectedValue)
    );

    console.log(`CNAME records for ${name}:`, cnameRecords);
    console.log(`Looking for: ${expectedValue}`);
    console.log(`Match found: ${found}`);

    return found;
  } catch (error) {
    console.error(`Error verifying CNAME record for ${name}:`, error);
    return false;
  }
}

// Helper function to verify MX records
async function verifyMXRecord(name: string, expectedValue: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=MX`,
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
      console.log(`No MX records found for ${name}`);
      return false;
    }

    // Check MX records (type 15)
    // MX record data format: "priority mailserver" e.g. "10 feedback-smtp.us-east-1.amazonses.com."
    const mxRecords = data.Answer
      .filter((answer: any) => answer.type === 15) // MX record type
      .map((answer: any) => {
        // Extract just the mail server (remove priority and trailing dot)
        const parts = answer.data.split(' ');
        return parts.length > 1 ? parts[1].replace(/\.$/, '') : answer.data.replace(/\.$/, '');
      });

    const found = mxRecords.some((record: string) => 
      record === expectedValue || record.includes(expectedValue) || expectedValue.includes(record)
    );

    console.log(`MX records for ${name}:`, mxRecords);
    console.log(`Looking for: ${expectedValue}`);
    console.log(`Match found: ${found}`);

    return found;
  } catch (error) {
    console.error(`Error verifying MX record for ${name}:`, error);
    return false;
  }
}

serve(handler);