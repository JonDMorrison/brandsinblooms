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
  console.error('[mailchimp-import] FATAL:', error.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[mailchimp-import] No Authorization header');
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[mailchimp-import] Auth error:', userError);
      throw new Error('Authentication failed');
    }

    console.log('[mailchimp-import] Authenticated user:', user.id);

    // Get existing job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !importJob) {
      console.error('[mailchimp-import] Job query error:', jobError);
      throw new Error('Job not found');
    }

    console.log('[mailchimp-import] Found job:', importJob.id, 'for tenant:', importJob.tenant_id);

    // Get tenant
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) throw new Error('Tenant not found');

    // Get connection with encrypted token
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'mailchimp')
      .eq('status', 'connected')
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error('Mailchimp not connected or token missing');
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      console.error('[mailchimp-import] Decryption failed:', error.message);
      throw new Error('Failed to decrypt access token. Please reconnect Mailchimp.');
    }

    const dc = connection.metadata?.dc || connection.metadata?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    // Update job status
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'running',
        report: { started_at: new Date().toISOString() }
      })
      .eq('id', importJob.id);

    console.log(`[mailchimp-import] Started job ${importJob.id}`);

    const config = importJob.config as any || {};
    const listIds = config.listIds || [];
    const segmentIds = config.segmentIds || [];

    // Process lists
    let totalContacts = 0;
    let totalErrors = 0;
    const batchSize = 100;
    const detailedErrors: Array<{ item: string; error: string }> = [];

    for (const listId of listIds) {
      let offset = 0;
      const count = 100;
      let hasMore = true;

      while (hasMore) {
        const membersRes = await fetch(
          `${baseUrl}/lists/${listId}/members?count=${count}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields,members.tags`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        // Check for token expiry
        if (membersRes.status === 401) {
          throw new Error('Access token expired. Please reconnect Mailchimp and try again.');
        }
        
        if (!membersRes.ok) {
          throw new Error(`Mailchimp API error: ${membersRes.status}`);
        }
        
        const membersData = await membersRes.json();
        const members = membersData.members || [];

        if (members.length === 0) {
          hasMore = false;
          break;
        }

        // Batch upsert contacts
        for (const member of members) {
          try {
            const email = member.email_address?.toLowerCase();
            if (!email) continue;

            const phone = member.merge_fields?.PHONE || null;
            const firstName = member.merge_fields?.FNAME || null;
            const lastName = member.merge_fields?.LNAME || null;
            const customFields: any = {};

            // Extract custom merge fields
            Object.keys(member.merge_fields || {}).forEach(key => {
              if (!['PHONE', 'FNAME', 'LNAME'].includes(key)) {
                customFields[key] = member.merge_fields[key];
              }
            });

            // Upsert contact
            const { data: contact, error: contactError } = await supabase
              .from('crm_customers')
              .upsert({
                tenant_id: tenantId,
                email,
                phone,
                first_name: firstName,
                last_name: lastName,
                custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
                source: 'mailchimp_import'
              }, { onConflict: 'tenant_id,email' })
              .select()
              .single();

            if (contactError) {
              console.error('Contact upsert error:', contactError);
              totalErrors++;
              continue;
            }

            // Upsert consent
            const consentStatus = member.status === 'subscribed' ? 'opted_in' : 
                                 member.status === 'unsubscribed' ? 'opted_out' :
                                 member.status === 'cleaned' ? 'suppressed' : 'suppressed';

            await supabase.from('consents').upsert({
              customer_id: contact.id,
              channel: 'email',
              status: consentStatus,
              source: 'mailchimp_import',
              consent_timestamp: new Date().toISOString()
            }, { onConflict: 'customer_id,channel' });

            // Add to suppression list if needed
            if (consentStatus === 'suppressed') {
              await supabase.from('suppression_list').upsert({
                tenant_id: tenantId,
                email,
                reason: member.status === 'cleaned' ? 'cleaned' : 'unsubscribed',
                source: 'mailchimp_import'
              }, { onConflict: 'tenant_id,email' });
            }

            // Process tags
            if (member.tags && Array.isArray(member.tags)) {
              for (const tag of member.tags) {
                const tagName = tag.name?.toLowerCase().trim();
                if (!tagName) continue;

                // Upsert tag
                const { data: tagRecord } = await supabase
                  .from('tags')
                  .upsert({
                    tenant_id: tenantId,
                    name: tagName,
                    source: 'mailchimp_import'
                  }, { onConflict: 'tenant_id,name' })
                  .select()
                  .single();

                if (tagRecord) {
                  // Link contact to tag
                  await supabase.from('contact_tags').upsert({
                    contact_id: contact.id,
                    tag_id: tagRecord.id
                  }, { onConflict: 'contact_id,tag_id' });
                }
              }
            }

            totalContacts++;

            // Log item
            await supabase.from('import_job_items').insert({
              job_id: importJob.id,
              item_type: 'contact',
              external_id: member.id,
              status: 'success',
              data: { email, listId }
            });

          } catch (error) {
            console.error('Member processing error:', error);
            totalErrors++;
          }
        }

        offset += count;
        
        // Update real-time progress
        await supabase.from('import_jobs').update({
          report: { 
            started_at: importJob.report?.started_at,
            progress: {
              stage: `Importing from list ${listId}`,
              contactsProcessed: totalContacts,
              contactsTotal: offset + count,
              segmentsProcessed: 0,
              segmentsTotal: segmentIds.length,
              currentBatch: Math.floor(offset / batchSize),
              totalBatches: Math.ceil((offset + count) / batchSize),
              errors: detailedErrors.slice(-10)
            }
          }
        }).eq('id', importJob.id);
      }
    }

    // Process segments
    for (const segmentId of segmentIds) {
      try {
        // Parse segmentId format: listId:segmentId
        const [listId, segId] = segmentId.split(':');
        
        const segRes = await fetch(`${baseUrl}/lists/${listId}/segments/${segId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const segment = await segRes.json();

        // Create segment in BloomSuite
        const { data: newSegment } = await supabase
          .from('segments')
          .insert({
            tenant_id: tenantId,
            name: segment.name,
            description: `Imported from Mailchimp: ${segment.name}`,
            source: 'mailchimp_import'
          })
          .select()
          .single();

        if (newSegment) {
          // Fetch segment members
          const membersRes = await fetch(
            `${baseUrl}/lists/${listId}/segments/${segId}/members?count=1000`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const membersData = await membersRes.json();

          // Add members to segment
          for (const member of membersData.members || []) {
            const email = member.email_address?.toLowerCase();
            if (!email) continue;

            const { data: contact } = await supabase
              .from('crm_customers')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('email', email)
              .single();

            if (contact) {
              await supabase.from('segment_members').upsert({
                segment_id: newSegment.id,
                customer_id: contact.id
              }, { onConflict: 'segment_id,customer_id' });
            }
          }

          // Create imported tag
          const { data: importTag } = await supabase
            .from('tags')
            .upsert({
              tenant_id: tenantId,
              name: `imported-${segment.name.toLowerCase().replace(/\s+/g, '-')}`,
              source: 'mailchimp_import'
            }, { onConflict: 'tenant_id,name' })
            .select()
            .single();
        }
      } catch (error) {
        console.error('Segment processing error:', error);
        totalErrors++;
      }
    }

    // Finalize job
    await supabase.from('import_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      report: {
        started_at: importJob.report?.started_at,
        completed_at: new Date().toISOString(),
        contacts_imported: totalContacts,
        segments_imported: segmentIds.length,
        errors: totalErrors
      }
    }).eq('id', importJob.id);

    console.log(`[mailchimp-import] Completed job ${importJob.id}: ${totalContacts} contacts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: importJob.id,
        contactsImported: totalContacts,
        segmentsImported: segmentIds.length,
        errors: totalErrors,
        progress: {
          stage: 'complete',
          contactsProcessed: totalContacts,
          contactsTotal: totalContacts,
          segmentsProcessed: segmentIds.length,
          segmentsTotal: segmentIds.length,
          currentBatch: 0,
          totalBatches: 0,
          errors: detailedErrors.slice(0, 50)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mailchimp-import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
