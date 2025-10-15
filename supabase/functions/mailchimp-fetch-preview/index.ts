// Mailchimp preview fetcher - fetches sample data for import preview
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { decryptToken } from '../_shared/crypto/tokens.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    
    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Create client for auth verification
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify token and get user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');
    
    // Use service role for database queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
