import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken, assertEncryptionKeyConfigured } from '../_shared/crypto/tokens.ts';
// IMPROVEMENT: Proactive token refresh for Constant Contact
import { getValidCCAccessToken } from '../_shared/ccTokenRefresh.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error('[constant-contact-import] FATAL:', error.message);
}

interface ImportContact {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  custom_fields?: any[];
  source_id: string;
  list_id: string;
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

    const { listIds, importJobId } = await req.json();

    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
      throw new Error('listIds array is required');
    }

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

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    const tenant_id = userData.tenant_id;

    // Get connection
    const { data: connection, error: connectionError } = await supabase
      .from('provider_connections')
      .select('id, encrypted_access_token, encrypted_refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'constant_contact')
      .eq('status', 'connected')
      .single();

    if (connectionError || !connection?.encrypted_access_token) {
      throw new Error('Constant Contact not connected');
    }

    // IMPROVEMENT: Proactive token refresh if within 5 min of expiry
    let accessToken: string;
    try {
      accessToken = await getValidCCAccessToken(supabase, connection);
    } catch (error: any) {
      throw new Error('Failed to get valid access token. Please reconnect Constant Contact.');
    }

    // Track import stats
    let imported = 0;
    let skipped = 0;
    let processed = 0;
    let errors: string[] = [];

    // Process each list
    for (const listId of listIds) {
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        // Build URL with pagination
        let url = `https://api.cc.email/v3/contacts?lists=${listId}&limit=500&include=custom_fields,list_memberships,street_addresses,phone_numbers`;
        if (cursor) {
          url += `&cursor=${cursor}`;
        }

        const contactsRes = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
        });

        if (!contactsRes.ok) {
          const errorText = await contactsRes.text();
          console.error(`[constant-contact-import] Error fetching list ${listId}:`, contactsRes.status, errorText);
          errors.push(`Failed to fetch list ${listId}: ${contactsRes.status}`);
          break;
        }

        const data = await contactsRes.json();
        const contacts = data.contacts || [];

        // Process contacts in batches
        const batchSize = 50;
        for (let i = 0; i < contacts.length; i += batchSize) {
          const batch = contacts.slice(i, i + batchSize);

          // FIX: [issue #65] - TODO: Batch customer upserts instead of processing individually (N+1 pattern)
          for (const contact of batch) {
            const email = contact.email_address?.address?.toLowerCase();
            if (!email) {
              skipped++;
              continue;
            }

            processed++;

            // Check if customer already exists
            const { data: existingCustomer } = await supabase
              .from('crm_customers')
              .select('id')
              .eq('tenant_id', tenant_id)
              .eq('email', email)
              .maybeSingle();

            if (existingCustomer) {
              // Update existing customer if needed
              const { error: updateError } = await supabase
                .from('crm_customers')
                .update({
                  first_name: contact.first_name || undefined,
                  last_name: contact.last_name || undefined,
                  phone: contact.phone_numbers?.[0]?.phone_number || undefined,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingCustomer.id);

              if (updateError) {
                console.error('[constant-contact-import] Update error:', updateError);
              }

              // Add source if not already present
              await supabase
                .from('customer_sources')
                .upsert({
                  customer_id: existingCustomer.id,
                  source_type: 'constant_contact',
                  source_id: contact.contact_id,
                  tenant_id
                }, { onConflict: 'customer_id,source_type' });

              skipped++;
            } else {
              // Create new customer
              const { data: newCustomer, error: insertError } = await supabase
                .from('crm_customers')
                .insert({
                  tenant_id,
                  email,
                  first_name: contact.first_name || null,
                  last_name: contact.last_name || null,
                  phone: contact.phone_numbers?.[0]?.phone_number || null,
                  source: 'constant_contact',
                  created_at: new Date().toISOString()
                })
                .select('id')
                .single();

              if (insertError) {
                console.error('[constant-contact-import] Insert error:', insertError);
                errors.push(`Failed to import ${email}: ${insertError.message}`);
                continue;
              }

              if (newCustomer) {
                // Add source record
                await supabase
                  .from('customer_sources')
                  .insert({
                    customer_id: newCustomer.id,
                    source_type: 'constant_contact',
                    source_id: contact.contact_id,
                    tenant_id
                  });

                imported++;
              }
            }
          }
        }

        // Check for pagination
        cursor = data._links?.next?.cursor || null;
        hasMore = !!cursor;

        console.log(`[constant-contact-import] Processed ${contacts.length} contacts from list ${listId}, cursor: ${cursor ? 'has more' : 'done'}`);
      }
    }

    if (processed > 0) {
      try {
        await supabase.rpc('record_contact_import_event', {
          p_tenant_id: tenant_id,
          p_source: 'constant_contact',
          p_contact_count: processed,
          p_metadata: {
            import_job_id: importJobId || null,
            list_ids: listIds,
            imported_count: imported,
            skipped_count: skipped,
          },
        });
      } catch (importEventError: any) {
        console.warn('[constant-contact-import] Failed to record import activity event:', importEventError?.message || importEventError);
      }
    }

    // Update import job if provided
    if (importJobId) {
      await supabase
        .from('import_jobs')
        .update({
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          imported_count: imported,
          skipped_count: skipped,
          error_count: errors.length,
          errors: errors.length > 0 ? errors.slice(0, 100) : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', importJobId);
    }

    console.log(`[constant-contact-import] Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors: errors.slice(0, 10) // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[constant-contact-import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
