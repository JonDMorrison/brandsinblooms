import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY');

async function decryptToken(encryptedToken: string): Promise<string> {
  const parts = encryptedToken.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const combined = new Uint8Array([...encrypted, ...authTag]);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined
  );
  
  return new TextDecoder().decode(decrypted);
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mailchimp-validate] No Authorization header');
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Extract JWT from Authorization header and validate
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('[mailchimp-validate] Auth error:', {
        error: userError,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none'
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed. Please refresh the page and try again.',
          details: userError?.message || 'No user session found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      );
    }

    console.log('[mailchimp-validate] Authenticated user:', user.id);

    // Get job and tenant
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('config, provider, tenant_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      console.error('[mailchimp-validate] Job query error:', jobError);
      throw new Error('Job not found');
    }

    console.log('[mailchimp-validate] Found job for tenant:', job.tenant_id);

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    // Get connection
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('provider', 'mailchimp')
      .eq('status', 'connected')
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error('Mailchimp not connected');
    }

    const accessToken = await decryptToken(connection.encrypted_access_token);
    const dc = connection.metadata?.dc || connection.metadata?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    const config = job.config as any;
    const listIds = config.listIds || [];
    
    const validationErrors: string[] = [];

    // Validate each list and check for duplicate emails
    for (const listId of listIds) {
      // Fetch first 100 contacts for validation
      const membersRes = await fetch(
        `${baseUrl}/lists/${listId}/members?count=100&fields=members.email_address`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const membersData = await membersRes.json();

      for (const member of membersData.members || []) {
        const email = member.email_address;
        
        // Validate email format
        if (!validateEmail(email)) {
          validationErrors.push(`Invalid email format: ${email}`);
        }
        
        // Check for duplicates in existing database
        const { data: existing } = await supabase
          .from('crm_customers')
          .select('id, email')
          .eq('tenant_id', userData.tenant_id)
          .eq('email', email.toLowerCase())
          .maybeSingle();

        // Note: We allow duplicates but warn about them
        if (existing) {
          console.log(`Duplicate found: ${email} will be updated`);
        }
      }
    }

    // Limit validation errors to first 50
    const limitedErrors = validationErrors.slice(0, 50);
    if (validationErrors.length > 50) {
      limitedErrors.push(`... and ${validationErrors.length - 50} more validation errors`);
    }

    console.log(`[mailchimp-validate] Validation complete. Errors: ${limitedErrors.length}`);

    return new Response(
      JSON.stringify({
        valid: limitedErrors.length === 0,
        validationErrors: limitedErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[mailchimp-validate] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Determine appropriate status code
    const statusCode = error.message?.includes('Auth') || error.message?.includes('Unauthorized') 
      ? 401 
      : error.message?.includes('not found') 
      ? 404 
      : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
    );
  }
});