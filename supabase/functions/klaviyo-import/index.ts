import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Get existing job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !importJob) throw new Error('Job not found');

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
      .eq('provider', 'klaviyo')
      .eq('status', 'connected')
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error('Klaviyo not connected or token missing');
    }

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);

    const baseUrl = 'https://a.klaviyo.com/api';
    const headers = {
      Authorization: `Klaviyo-OAuth ${accessToken}`,
      revision: '2024-10-15',
      Accept: 'application/json'
    };

    // Update job status
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'running',
        report: { started_at: new Date().toISOString() }
      })
      .eq('id', importJob.id);

    console.log(`[klaviyo-import] Started job ${importJob.id}`);

    const config = importJob.config as any || {};
    const listIds = config.listIds || [];
    const segmentIds = config.segmentIds || [];

    let totalContacts = 0;
    let totalErrors = 0;
    const batchSize = 100;
    const detailedErrors: Array<{ item: string; error: string }> = [];

    // Process lists
    for (const listId of listIds) {
      if (listId === 'segments') continue; // Skip segments container

      let pageUrl = `${baseUrl}/lists/${listId}/profiles/`;
      
      while (pageUrl) {
        const profilesRes = await fetch(pageUrl, { headers });
        
        // Check for token expiry
        if (profilesRes.status === 401) {
          throw new Error('Access token expired. Please reconnect Klaviyo and try again.');
        }
        
        if (!profilesRes.ok) {
          throw new Error(`Klaviyo API error: ${profilesRes.status}`);
        }
        
        const profilesData = await profilesRes.json();
        const profiles = profilesData.data || [];

        for (const profile of profiles) {
          try {
            const attrs = profile.attributes;
            const email = attrs.email?.toLowerCase();
            if (!email) continue;

            const phone = attrs.phone_number || null;
            const firstName = attrs.first_name || null;
            const lastName = attrs.last_name || null;
            const customFields: any = {};

            // Extract custom properties
            if (attrs.properties) {
              Object.keys(attrs.properties).forEach(key => {
                if (!['$email', '$phone_number', '$first_name', '$last_name'].includes(key)) {
                  customFields[key] = attrs.properties[key];
                }
              });
            }

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
                source: 'klaviyo_import'
              }, { onConflict: 'tenant_id,email' })
              .select()
              .single();

            if (contactError) {
              console.error('Contact upsert error:', contactError);
              totalErrors++;
              continue;
            }

            // Upsert consent
            const consentStatus = attrs.subscriptions?.email?.marketing?.consent === 'SUBSCRIBED' ? 'opted_in' :
                                 attrs.subscriptions?.email?.marketing?.consent === 'UNSUBSCRIBED' ? 'opted_out' :
                                 'suppressed';

            await supabase.from('consents').upsert({
              customer_id: contact.id,
              channel: 'email',
              status: consentStatus,
              source: 'klaviyo_import',
              consent_timestamp: new Date().toISOString()
            }, { onConflict: 'customer_id,channel' });

            // Add to suppression list if needed
            if (consentStatus === 'suppressed') {
              await supabase.from('suppression_list').upsert({
                tenant_id: tenantId,
                email,
                reason: 'suppressed',
                source: 'klaviyo_import'
              }, { onConflict: 'tenant_id,email' });
            }

            totalContacts++;

            // Log item
            await supabase.from('import_job_items').insert({
              job_id: importJob.id,
              item_type: 'contact',
              external_id: profile.id,
              status: 'success',
              data: { email, listId }
            });

          } catch (error) {
            console.error('Profile processing error:', error);
            totalErrors++;
          }
        }

        // Get next page
        pageUrl = profilesData.links?.next || null;

        // Update real-time progress
        await supabase.from('import_jobs').update({
          report: {
            started_at: importJob.report?.started_at,
            progress: {
              stage: `Importing from list ${listId}`,
              contactsProcessed: totalContacts,
              contactsTotal: totalContacts + 100,
              segmentsProcessed: 0,
              segmentsTotal: segmentIds.length,
              currentBatch: Math.floor(totalContacts / batchSize),
              totalBatches: Math.ceil((totalContacts + 100) / batchSize),
              errors: detailedErrors.slice(-10)
            }
          }
        }).eq('id', importJob.id);
      }
    }

    // Process segments
    for (const segmentId of segmentIds) {
      try {
        const segRes = await fetch(`${baseUrl}/segments/${segmentId}/`, { headers });
        const segment = await segRes.json();

        // Create segment in BloomSuite
        const { data: newSegment } = await supabase
          .from('segments')
          .insert({
            tenant_id: tenantId,
            name: segment.data.attributes.name,
            description: `Imported from Klaviyo: ${segment.data.attributes.name}`,
            source: 'klaviyo_import'
          })
          .select()
          .single();

        if (newSegment) {
          // Fetch segment members
          let pageUrl = `${baseUrl}/segments/${segmentId}/profiles/`;
          
          while (pageUrl) {
            const membersRes = await fetch(pageUrl, { headers });
            const membersData = await membersRes.json();

            for (const member of membersData.data || []) {
              const email = member.attributes?.email?.toLowerCase();
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

            pageUrl = membersData.links?.next || null;
          }

          // Create imported tag
          await supabase.from('tags').upsert({
            tenant_id: tenantId,
            name: `imported-${segment.data.attributes.name.toLowerCase().replace(/\s+/g, '-')}`,
            source: 'klaviyo_import'
          }, { onConflict: 'tenant_id,name' });
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

    console.log(`[klaviyo-import] Completed job ${importJob.id}: ${totalContacts} contacts`);

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
    console.error('[klaviyo-import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
