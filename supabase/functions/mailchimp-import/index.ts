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

// Shutdown handling
let isShuttingDown = false;
addEventListener('beforeunload', (ev) => {
  console.log('[mailchimp-import] Function shutdown due to:', (ev as any).detail?.reason);
  isShuttingDown = true;
});

// ============================================================
// PHASE 1: BATCH DATABASE OPERATIONS
// ============================================================

interface ContactBatch {
  tenant_id: string;
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  custom_fields?: any;
}

interface ConsentBatch {
  customer_id: string;
  channel: string;
  status: string;
  consent_timestamp: string;
}

interface SuppressionBatch {
  tenant_id: string;
  email: string;
  reason: string;
}

interface TagBatch {
  tenant_id: string;
  name: string;
}

interface ContactTagBatch {
  contact_id: string;
  tag_id: string;
}

async function batchUpsertContacts(
  supabase: any,
  tenantId: string,
  members: any[]
): Promise<Map<string, string>> {
  const contactBatch: ContactBatch[] = [];
  const emailToIdMap = new Map<string, string>();

  console.log(`[mailchimp-import] Preparing batch upsert for ${members.length} contacts`);

  for (const member of members) {
    const email = member.email_address?.toLowerCase();
    if (!email) continue;

    const phone = member.merge_fields?.PHONE || null;
    const firstName = member.merge_fields?.FNAME || null;
    const lastName = member.merge_fields?.LNAME || null;
    const customFields: any = {};

    Object.keys(member.merge_fields || {}).forEach(key => {
      if (!['PHONE', 'FNAME', 'LNAME'].includes(key)) {
        customFields[key] = member.merge_fields[key];
      }
    });

    contactBatch.push({
      tenant_id: tenantId,
      email,
      phone,
      first_name: firstName,
      last_name: lastName,
      custom_fields: Object.keys(customFields).length > 0 ? customFields : null
    });
  }

  const { data: contacts, error: contactError } = await supabase
    .from('crm_customers')
    .upsert(contactBatch, { 
      onConflict: 'tenant_id,email',
      ignoreDuplicates: false 
    })
    .select('id, email');

  if (contactError) {
    console.error('[mailchimp-import] Batch contact upsert error:', contactError);
    throw contactError;
  }

  console.log(`[mailchimp-import] Successfully upserted ${contacts?.length || 0} contacts in batch`);

  contacts?.forEach((contact: any) => {
    emailToIdMap.set(contact.email, contact.id);
  });

  return emailToIdMap;
}

async function batchUpsertConsents(
  supabase: any,
  members: any[],
  emailToIdMap: Map<string, string>
): Promise<void> {
  const consentBatch: ConsentBatch[] = [];

  for (const member of members) {
    const email = member.email_address?.toLowerCase();
    if (!email) continue;

    const customerId = emailToIdMap.get(email);
    if (!customerId) continue;

    const consentStatus = member.status === 'subscribed' ? 'opted_in' : 
                         member.status === 'unsubscribed' ? 'opted_out' :
                         member.status === 'cleaned' ? 'suppressed' : 'suppressed';

    consentBatch.push({
      customer_id: customerId,
      channel: 'email',
      status: consentStatus,
      consent_timestamp: new Date().toISOString()
    });
  }

  if (consentBatch.length === 0) return;

  const { error: consentError } = await supabase
    .from('customer_consent')
    .upsert(consentBatch, { 
      onConflict: 'customer_id,channel',
      ignoreDuplicates: false 
    });

  if (consentError) {
    console.error('[mailchimp-import] Batch consent upsert error:', consentError);
  } else {
    console.log(`[mailchimp-import] Successfully upserted ${consentBatch.length} consents in batch`);
  }
}

async function batchUpsertSuppressions(
  supabase: any,
  tenantId: string,
  members: any[]
): Promise<void> {
  const suppressionBatch: SuppressionBatch[] = [];

  for (const member of members) {
    if (member.status === 'unsubscribed' || member.status === 'cleaned') {
      const email = member.email_address?.toLowerCase();
      if (!email) continue;

      suppressionBatch.push({
        tenant_id: tenantId,
        email,
        reason: member.status === 'cleaned' ? 'Cleaned/bounced by Mailchimp' : 'Unsubscribed in Mailchimp'
      });
    }
  }

  if (suppressionBatch.length === 0) return;

  const { error: suppressionError } = await supabase
    .from('suppression_list')
    .upsert(suppressionBatch, { 
      onConflict: 'tenant_id,email',
      ignoreDuplicates: true 
    });

  if (suppressionError) {
    console.error('[mailchimp-import] Batch suppression upsert error:', suppressionError);
  } else {
    console.log(`[mailchimp-import] Successfully upserted ${suppressionBatch.length} suppressions in batch`);
  }
}

async function batchUpsertTags(
  supabase: any,
  tenantId: string,
  members: any[],
  emailToIdMap: Map<string, string>
): Promise<void> {
  const uniqueTags = new Set<string>();
  const contactTagLinks: { email: string; tags: string[] }[] = [];

  for (const member of members) {
    const email = member.email_address?.toLowerCase();
    if (!email || !member.tags?.length) continue;

    const tagNames: string[] = [];
    for (const tag of member.tags) {
      if (tag.name) {
        uniqueTags.add(tag.name);
        tagNames.push(tag.name);
      }
    }

    if (tagNames.length > 0) {
      contactTagLinks.push({ email, tags: tagNames });
    }
  }

  if (uniqueTags.size === 0) return;

  const tagBatch: TagBatch[] = Array.from(uniqueTags).map(name => ({
    tenant_id: tenantId,
    name
  }));

  const { data: tags, error: tagError } = await supabase
    .from('crm_tags')
    .upsert(tagBatch, { 
      onConflict: 'tenant_id,name',
      ignoreDuplicates: false 
    })
    .select('id, name');

  if (tagError) {
    console.error('[mailchimp-import] Batch tag upsert error:', tagError);
    return;
  }

  console.log(`[mailchimp-import] Successfully upserted ${tags?.length || 0} tags in batch`);

  const tagNameToIdMap = new Map<string, string>();
  tags?.forEach((tag: any) => {
    tagNameToIdMap.set(tag.name, tag.id);
  });

  const contactTagBatch: ContactTagBatch[] = [];
  for (const link of contactTagLinks) {
    const contactId = emailToIdMap.get(link.email);
    if (!contactId) continue;

    for (const tagName of link.tags) {
      const tagId = tagNameToIdMap.get(tagName);
      if (tagId) {
        contactTagBatch.push({
          contact_id: contactId,
          tag_id: tagId
        });
      }
    }
  }

  if (contactTagBatch.length === 0) return;

  const { error: linkError } = await supabase
    .from('customer_tags')
    .upsert(contactTagBatch, { 
      onConflict: 'contact_id,tag_id',
      ignoreDuplicates: true 
    });

  if (linkError) {
    console.error('[mailchimp-import] Batch contact-tag link error:', linkError);
  } else {
    console.log(`[mailchimp-import] Successfully linked ${contactTagBatch.length} contact-tag relationships in batch`);
  }
}

async function batchInsertSources(
  supabase: any,
  tenantId: string,
  members: any[],
  emailToIdMap: Map<string, string>
): Promise<void> {
  const sourceBatch: any[] = [];

  for (const member of members) {
    const email = member.email_address?.toLowerCase();
    if (!email) continue;

    const contactId = emailToIdMap.get(email);
    if (!contactId) continue;

    sourceBatch.push({
      tenant_id: tenantId,
      customer_id: contactId,
      source_type: 'mailchimp',
      source_id: member.id,
      imported_at: new Date().toISOString()
    });
  }

  if (sourceBatch.length === 0) return;

  const { error: sourceError } = await supabase
    .from('customer_sources')
    .upsert(sourceBatch, { 
      onConflict: 'customer_id,source_type',
      ignoreDuplicates: true 
    });

  if (sourceError) {
    console.error('[mailchimp-import] Batch source insert error:', sourceError);
  } else {
    console.log(`[mailchimp-import] Successfully inserted ${sourceBatch.length} source records in batch`);
  }
}

// ============================================================
// BACKGROUND PROCESSING FUNCTION
// ============================================================

async function processMailchimpImport(
  jobId: string,
  userId: string,
  migrationJobId: string,
  tenantId: string,
  accessToken: string,
  baseUrl: string,
  config: any
) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    console.log(`[mailchimp-import] Starting background processing for job ${jobId}`);

    const listIds = config.listIds || [];
    const segmentIds = config.segmentIds || [];
    let totalContacts = 0;
    let totalErrors = 0;
    const batchSize = 100;
    let currentBatch = 0;

    // Update to running status
    await Promise.all([
      supabase.from('import_jobs').update({
        status: 'running',
        started_at: new Date().toISOString()
      }).eq('id', jobId),
      
      supabase.from('migration_jobs' as any).update({
        status: 'running',
        started_at: new Date().toISOString()
      }).eq('id', migrationJobId)
    ]);

    // Process lists with batch operations
    for (const listId of listIds) {
      if (isShuttingDown) {
        console.log('[mailchimp-import] Graceful shutdown - saving checkpoint');
        await Promise.all([
          supabase.from('import_jobs').update({
            status: 'paused',
            paused_at: new Date().toISOString()
          }).eq('id', jobId),
          
          supabase.from('migration_jobs' as any).update({
            status: 'paused',
            paused_at: new Date().toISOString()
          }).eq('id', migrationJobId)
        ]);
        return;
      }

      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        if (isShuttingDown) break;

        currentBatch++;

        const response = await fetch(
          `${baseUrl}/lists/${listId}/members?count=${batchSize}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields,members.tags`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          console.error('[mailchimp-import] API error:', await response.text());
          break;
        }

        const data = await response.json();
        const members = data.members || [];
        
        if (members.length === 0) {
          hasMore = false;
          break;
        }

        try {
          const emailToIdMap = await batchUpsertContacts(supabase, tenantId, members);
          await batchUpsertConsents(supabase, members, emailToIdMap);
          await batchUpsertSuppressions(supabase, tenantId, members);
          await batchUpsertTags(supabase, tenantId, members, emailToIdMap);
          await batchInsertSources(supabase, tenantId, members, emailToIdMap);

          totalContacts += members.length;

          const progressPercentage = Math.floor((offset / (data.total_items || 1)) * 100);
          
          await Promise.all([
            supabase.rpc('update_import_job_progress', {
              p_job_id: jobId,
              p_progress_percentage: progressPercentage,
              p_current_stage: `Importing contacts (${totalContacts} processed)`,
              p_batch_stats: {
                current_batch: currentBatch,
                total_batches: Math.ceil((data.total_items || 1) / batchSize),
                failed_batches: 0,
                contacts_per_batch: batchSize,
                contacts_imported: totalContacts
              }
            }),

            supabase.from('migration_jobs' as any).update({
              progress_current: totalContacts,
              progress_percentage: progressPercentage,
              metadata: {
                current_batch: currentBatch,
                list_id: listId,
                last_offset: offset,
                list_ids: listIds,
                segment_ids: segmentIds
              }
            }).eq('id', migrationJobId)
          ]);

        } catch (error: any) {
          console.error('[mailchimp-import] Batch processing error:', error);
          totalErrors++;
          
          await supabase.rpc('log_import_batch_error', {
            p_job_id: jobId,
            p_batch_number: currentBatch,
            p_error_message: error.message,
            p_failed_items: members.map((m: any) => m.email_address)
          });
        }

        offset += batchSize;
        if (offset >= data.total_items) hasMore = false;
      }
    }

    // Finalize both jobs
    await Promise.all([
      supabase.from('import_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        current_stage: 'Import completed',
        report: {
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          contacts_imported: totalContacts,
          segments_imported: segmentIds.length,
          errors: totalErrors,
          batches_processed: currentBatch
        }
      }).eq('id', jobId),

      supabase.from('migration_jobs' as any).update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        progress_current: totalContacts,
        progress_total: totalContacts
      }).eq('id', migrationJobId)
    ]);

    console.log(`[mailchimp-import] ✅ Completed job ${jobId}: ${totalContacts} contacts imported`);

  } catch (error: any) {
    console.error('[mailchimp-import] Background processing error:', error);
    
    await Promise.all([
      supabase.from('import_jobs').update({
        status: 'failed',
        progress_percentage: 0,
        current_stage: `Error: ${error.message}`
      }).eq('id', jobId),

      supabase.from('migration_jobs' as any).update({
        status: 'failed',
        error_message: error.message
      }).eq('id', migrationJobId)
    ]);
  }
}

// ============================================================
// HTTP HANDLER
// ============================================================

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('[mailchimp-import] Auth error:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          details: userError?.message || 'No user session'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('[mailchimp-import] Authenticated user:', user.id);

    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !importJob) {
      console.error('[mailchimp-import] Job not found:', jobError);
      throw new Error('Job not found');
    }

    console.log('[mailchimp-import] Found job:', importJob.id);

    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) throw new Error('Tenant not found');

    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'mailchimp')
      .eq('status', 'connected')
      .single();

    if (!connection?.encrypted_access_token) {
      throw new Error('Mailchimp not connected');
    }

    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      console.error('[mailchimp-import] Decryption failed:', error.message);
      throw new Error('Failed to decrypt access token');
    }

    const dc = connection.metadata?.dc || connection.metadata?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    const config = importJob.config as any || {};
    const listIds = config.listIds || [];
    const segmentIds = config.segmentIds || [];

    // Create migration_job record
    const { data: migrationJob, error: migrationError } = await supabase
      .from('migration_jobs' as any)
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        source_platform: 'mailchimp',
        job_type: 'import',
        status: 'pending',
        progress_current: 0,
        progress_total: config.estimatedTotal || 1000,
        metadata: { list_ids: listIds, segment_ids: segmentIds }
      })
      .select()
      .single();

    if (migrationError || !migrationJob) {
      console.error('[mailchimp-import] Failed to create migration job:', migrationError);
      throw new Error('Failed to create migration job');
    }

    console.log('[mailchimp-import] Created migration job:', migrationJob.id);

    // Link migration_job to import_job
    await supabase
      .from('import_jobs')
      .update({ migration_job_id: migrationJob.id })
      .eq('id', jobId);

    await supabase.rpc('update_import_job_progress', {
      p_job_id: importJob.id,
      p_progress_percentage: 0,
      p_current_stage: 'Initializing import...'
    });

    console.log(`[mailchimp-import] Starting background processing for job ${importJob.id}`);

    // Start background processing - DO NOT AWAIT
    EdgeRuntime.waitUntil(
      processMailchimpImport(
        jobId,
        user.id,
        migrationJob.id,
        tenantId,
        accessToken,
        baseUrl,
        config
      )
    );

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: importJob.id,
        migrationJobId: migrationJob.id,
        message: 'Import started in background',
        progress: {
          stage: 'initializing',
          percentage: 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[mailchimp-import] Error:', error.message);
    
    const statusCode = error.message?.includes('Auth') ? 401 
      : error.message?.includes('not found') ? 404 
      : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
    );
  }
});
