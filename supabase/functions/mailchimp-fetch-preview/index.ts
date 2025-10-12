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
    const segmentIds = config.segmentIds || [];

    // Fetch preview data
    const lists = [];
    const segments = [];
    const sampleContacts = [];
    let totalEstimated = 0;

    // Fetch list info
    for (const listId of listIds) {
      const listRes = await fetch(`${baseUrl}/lists/${listId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const listData = await listRes.json();
      
      lists.push({
        id: listId,
        name: listData.name,
        memberCount: listData.stats?.member_count || 0
      });

      totalEstimated += listData.stats?.member_count || 0;

      // Fetch sample contacts (first 10)
      if (sampleContacts.length < 10) {
        const membersRes = await fetch(
          `${baseUrl}/lists/${listId}/members?count=10&fields=members.email_address,members.merge_fields,members.status`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const membersData = await membersRes.json();
        
        for (const member of membersData.members || []) {
          if (sampleContacts.length >= 10) break;
          sampleContacts.push({
            email: member.email_address,
            firstName: member.merge_fields?.FNAME,
            lastName: member.merge_fields?.LNAME,
            status: member.status
          });
        }
      }
    }

    // Fetch segment info
    for (const segmentId of segmentIds) {
      const [listId, segId] = segmentId.split(':');
      const segRes = await fetch(`${baseUrl}/lists/${listId}/segments/${segId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const segData = await segRes.json();
      
      segments.push({
        id: segmentId,
        name: segData.name,
        memberCount: segData.member_count || 0
      });
    }

    // Calculate estimated duration (rough estimate: 100 contacts per second)
    const estimatedSeconds = Math.ceil(totalEstimated / 100);
    const estimatedDuration = estimatedSeconds < 60 
      ? `${estimatedSeconds} seconds`
      : estimatedSeconds < 3600
      ? `${Math.ceil(estimatedSeconds / 60)} minutes`
      : `${Math.ceil(estimatedSeconds / 3600)} hours`;

    return new Response(
      JSON.stringify({
        contacts: sampleContacts,
        lists,
        segments,
        totalEstimated,
        estimatedDuration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Preview error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
