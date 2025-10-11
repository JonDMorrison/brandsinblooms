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
      .eq('provider', 'klaviyo')
      .eq('status', 'connected')
      .single();

    if (!connection) {
      throw new Error('Klaviyo not connected');
    }

    const baseUrl = 'https://a.klaviyo.com/api';
    const headers = {
      Authorization: `Klaviyo-OAuth ${connection.access_token}`,
      revision: '2024-10-15',
      Accept: 'application/json'
    };

    // Fetch lists
    const listsRes = await fetch(`${baseUrl}/lists/`, {
      headers
    });
    const listsData = await listsRes.json();

    // Fetch segments
    const segmentsRes = await fetch(`${baseUrl}/segments/`, {
      headers
    });
    const segmentsData = await segmentsRes.json();

    // Format for UI
    const listsWithSegments = (listsData.data || []).map((list: any) => ({
      id: list.id,
      name: list.attributes.name,
      member_count: list.attributes.profile_count || 0,
      segments: []
    }));

    // Add segments as a separate "list" for selection
    if (segmentsData.data && segmentsData.data.length > 0) {
      listsWithSegments.push({
        id: 'segments',
        name: 'Klaviyo Segments',
        member_count: 0,
        segments: segmentsData.data.map((seg: any) => ({
          id: seg.id,
          name: seg.attributes.name,
          member_count: seg.attributes.profile_count || 0,
          type: 'segment'
        }))
      });
    }

    console.log(`[klaviyo-fetch-lists] Fetched ${listsWithSegments.length} lists`);

    return new Response(
      JSON.stringify({ lists: listsWithSegments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[klaviyo-fetch-lists] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
