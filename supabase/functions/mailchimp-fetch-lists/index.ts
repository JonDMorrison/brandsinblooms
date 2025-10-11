import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get connection
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'mailchimp')
      .eq('status', 'connected')
      .single();

    if (!connection) {
      throw new Error('Mailchimp not connected');
    }

    const dc = connection.account_info?.dc || connection.account_info?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    // Fetch lists
    const listsRes = await fetch(`${baseUrl}/lists?count=100`, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });
    const listsData = await listsRes.json();

    // Fetch segments for each list
    const listsWithSegments = await Promise.all(
      (listsData.lists || []).map(async (list: any) => {
        const segmentsRes = await fetch(`${baseUrl}/lists/${list.id}/segments?count=100`, {
          headers: { Authorization: `Bearer ${connection.access_token}` },
        });
        const segmentsData = await segmentsRes.json();
        
        return {
          id: list.id,
          name: list.name,
          member_count: list.stats?.member_count || 0,
          segments: (segmentsData.segments || []).map((seg: any) => ({
            id: seg.id,
            name: seg.name,
            member_count: seg.member_count || 0,
            type: seg.type,
            options: seg.options
          }))
        };
      })
    );

    console.log(`[mailchimp-fetch-lists] Fetched ${listsWithSegments.length} lists`);

    return new Response(
      JSON.stringify({ lists: listsWithSegments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mailchimp-fetch-lists] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
