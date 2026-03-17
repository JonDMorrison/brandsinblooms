import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[constant-contact-fetch-preview] FATAL:', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { listIds } = await req.json();
    
    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
      throw new Error('listIds array is required');
    }

    // Create client for auth verification
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('encrypted_access_token')
      .eq('user_id', user.id)
      .eq('provider', 'constant_contact')
      .eq('status', 'connected')
      .single();

    if (connectionError || !connection?.encrypted_access_token) {
      throw new Error('Constant Contact not connected');
    }

    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      throw new Error('Failed to decrypt access token. Please reconnect Constant Contact.');
    }

    // Fetch preview contacts for each list (limited to 10 per list for preview)
    const previewContacts: any[] = [];
    
    for (const listId of listIds.slice(0, 3)) { // Limit to 3 lists for preview
      const contactsRes = await fetch(
        `https://api.cc.email/v3/contacts?lists=${listId}&limit=10&include=custom_fields,list_memberships,street_addresses,phone_numbers`,
        {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
        }
      );

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        for (const contact of contactsData.contacts || []) {
          previewContacts.push({
            id: contact.contact_id,
            email: contact.email_address?.address || '',
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            phone: contact.phone_numbers?.[0]?.phone_number || '',
            created_at: contact.create_date,
            list_id: listId,
            custom_fields: contact.custom_fields || [],
            source: 'constant_contact'
          });
        }
      }
    }

    console.log(`[constant-contact-fetch-preview] Fetched ${previewContacts.length} preview contacts`);

    return new Response(
      JSON.stringify({ 
        contacts: previewContacts.slice(0, 25), // Limit total preview to 25
        total_preview: previewContacts.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[constant-contact-fetch-preview] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
