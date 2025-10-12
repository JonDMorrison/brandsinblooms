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
    const segmentIds = config.segmentIds || [];

    // Fetch preview data
    const lists = [];
    const segments = [];
    const sampleContacts = [];
    let totalEstimated = 0;

    // Fetch list info
    for (const listId of listIds) {
      if (listId === 'segments') continue;

      const listRes = await fetch(`${baseUrl}/lists/${listId}/`, { headers });
      const listData = await listRes.json();
      
      // Get profile count for this list
      const profilesRes = await fetch(
        `${baseUrl}/lists/${listId}/profiles/?page[size]=1`,
        { headers }
      );
      const profilesData = await profilesRes.json();
      const memberCount = profilesData.meta?.total || 0;

      lists.push({
        id: listId,
        name: listData.data?.attributes?.name || 'Unnamed List',
        memberCount
      });

      totalEstimated += memberCount;

      // Fetch sample contacts (first 10)
      if (sampleContacts.length < 10) {
        const samplesRes = await fetch(
          `${baseUrl}/lists/${listId}/profiles/?page[size]=10`,
          { headers }
        );
        const samplesData = await samplesRes.json();
        
        for (const profile of samplesData.data || []) {
          if (sampleContacts.length >= 10) break;
          const attrs = profile.attributes;
          sampleContacts.push({
            email: attrs.email,
            firstName: attrs.first_name,
            lastName: attrs.last_name,
            status: attrs.subscriptions?.email?.marketing?.consent || 'unknown'
          });
        }
      }
    }

    // Fetch segment info
    for (const segmentId of segmentIds) {
      const segRes = await fetch(`${baseUrl}/segments/${segmentId}/`, { headers });
      const segData = await segRes.json();
      
      // Get profile count for this segment
      const profilesRes = await fetch(
        `${baseUrl}/segments/${segmentId}/profiles/?page[size]=1`,
        { headers }
      );
      const profilesData = await profilesRes.json();
      
      segments.push({
        id: segmentId,
        name: segData.data?.attributes?.name || 'Unnamed Segment',
        memberCount: profilesData.meta?.total || 0
      });
    }

    // Calculate estimated duration
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
