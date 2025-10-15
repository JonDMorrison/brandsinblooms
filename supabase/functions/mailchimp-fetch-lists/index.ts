import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[mailchimp-fetch-lists] FATAL:', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[mailchimp-fetch-lists] No Authorization header found');
      throw new Error('Missing Authorization header');
    }

    console.log('[mailchimp-fetch-lists] Auth header present');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Try to get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[mailchimp-fetch-lists] Auth error:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      console.error('[mailchimp-fetch-lists] No user found after auth check');
      throw new Error('User not authenticated');
    }

    console.log('[mailchimp-fetch-lists] User authenticated:', user.id);

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('encrypted_access_token, metadata')
      .eq('user_id', user.id)
      .eq('provider', 'mailchimp')
      .eq('status', 'connected')
      .single();

    if (connectionError) {
      console.error('[mailchimp-fetch-lists] Connection query error:', connectionError);
      throw new Error(`Failed to fetch connection: ${connectionError.message}`);
    }

    if (!connection?.encrypted_access_token) {
      throw new Error('Mailchimp not connected or token missing');
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      console.error('[mailchimp-fetch-lists] Decryption failed:', error.message);
      throw new Error('Failed to decrypt access token. Please reconnect Mailchimp.');
    }

    const dc = connection.metadata?.dc || connection.metadata?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    // Fetch lists
    const listsRes = await fetch(`${baseUrl}/lists?count=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listsData = await listsRes.json();

    // Fetch segments for each list
    const listsWithSegments = await Promise.all(
      (listsData.lists || []).map(async (list: any) => {
        const segmentsRes = await fetch(`${baseUrl}/lists/${list.id}/segments?count=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
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
