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

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get job and tenant
    const { data: job } = await supabase
      .from('import_jobs')
      .select('config')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) throw new Error('Job not found');

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
      .eq('provider', 'klaviyo')
      .eq('status', 'connected')
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error('Klaviyo not connected');
    }

    const accessToken = await decryptToken(connection.encrypted_access_token);
    const baseUrl = 'https://a.klaviyo.com/api';
    const headers = {
      Authorization: `Klaviyo-OAuth ${accessToken}`,
      revision: '2024-10-15',
      Accept: 'application/json'
    };

    const config = job.config as any;
    const listIds = config.listIds || [];
    
    const validationErrors: string[] = [];

    // Validate each list and check for duplicates
    for (const listId of listIds) {
      if (listId === 'segments') continue;

      // Fetch first 100 profiles for validation
      const profilesRes = await fetch(
        `${baseUrl}/lists/${listId}/profiles/?page[size]=100`,
        { headers }
      );
      const profilesData = await profilesRes.json();

      for (const profile of profilesData.data || []) {
        const email = profile.attributes?.email;
        
        if (!email) {
          validationErrors.push(`Profile ${profile.id} has no email address`);
          continue;
        }

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

    return new Response(
      JSON.stringify({
        valid: limitedErrors.length === 0,
        validationErrors: limitedErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
