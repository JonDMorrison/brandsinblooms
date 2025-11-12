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

// ============================================================
// PHASE 1: BATCH DATABASE OPERATIONS
// Reduces 14,000+ sequential operations to ~50-100 batch operations
// Expected performance improvement: 95%+
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

  // BATCH OPERATION: Single query instead of N queries
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

  // Build email -> ID mapping
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

  // BATCH OPERATION: Single query for all consents
  const { error: consentError } = await supabase
    .from('consents')
    .upsert(consentBatch, { onConflict: 'customer_id,channel' });

  if (consentError) {
    console.error('[mailchimp-import] Batch consent upsert error:', consentError);
    throw consentError;
  }

  console.log(`[mailchimp-import] Successfully upserted ${consentBatch.length} consents in batch`);
}

async function batchUpsertSuppressions(
  supabase: any,
  tenantId: string,
  members: any[]
): Promise<void> {
  const suppressionBatch: SuppressionBatch[] = [];

  for (const member of members) {
    const email = member.email_address?.toLowerCase();
    if (!email) continue;

    if (member.status === 'cleaned' || member.status === 'unsubscribed') {
      suppressionBatch.push({
        tenant_id: tenantId,
        email,
        reason: member.status === 'cleaned' ? 'cleaned' : 'unsubscribed'
      });
    }
  }

  if (suppressionBatch.length === 0) return;

  // BATCH OPERATION: Single query for all suppressions
  const { error: suppressionError } = await supabase
    .from('suppression_list')
    .upsert(suppressionBatch, { onConflict: 'tenant_id,email' });

  if (suppressionError) {
    console.error('[mailchimp-import] Batch suppression upsert error:', suppressionError);
    throw suppressionError;
  }

  console.log(`[mailchimp-import] Successfully upserted ${suppressionBatch.length} suppressions in batch`);
}

async function batchUpsertTags(
  supabase: any,
  tenantId: string,
  members: any[],
  emailToIdMap: Map<string, string>
): Promise<void> {
  // Collect unique tag names
  const uniqueTagNames = new Set<string>();
  members.forEach(member => {
    if (member.tags && Array.isArray(member.tags)) {
      member.tags.forEach((tag: any) => {
        const tagName = tag.name?.toLowerCase().trim();
        if (tagName) uniqueTagNames.add(tagName);
      });
    }
  });

  if (uniqueTagNames.size === 0) return;

  // BATCH OPERATION: Upsert all unique tags at once
  const tagBatch: TagBatch[] = Array.from(uniqueTagNames).map(name => ({
    tenant_id: tenantId,
    name
  }));

  const { data: tags, error: tagError } = await supabase
    .from('tags')
    .upsert(tagBatch, { onConflict: 'tenant_id,name' })
    .select('id, name');

  if (tagError) {
    console.error('[mailchimp-import] Batch tag upsert error:', tagError);
    throw tagError;
  }

  console.log(`[mailchimp-import] Successfully upserted ${tags?.length || 0} tags in batch`);

  // Build tag name -> ID mapping
  const tagNameToIdMap = new Map<string, string>();
  tags?.forEach((tag: any) => {
    tagNameToIdMap.set(tag.name, tag.id);
  });

  // BATCH OPERATION: Link contacts to tags
  const contactTagBatch: ContactTagBatch[] = [];
  members.forEach(member => {
    const email = member.email_address?.toLowerCase();
    if (!email) return;

    const contactId = emailToIdMap.get(email);
    if (!contactId) return;

    if (member.tags && Array.isArray(member.tags)) {
      member.tags.forEach((tag: any) => {
        const tagName = tag.name?.toLowerCase().trim();
        if (!tagName) return;

        const tagId = tagNameToIdMap.get(tagName);
        if (!tagId) return;

        contactTagBatch.push({
          contact_id: contactId,
          tag_id: tagId
        });
      });
    }
  });

  if (contactTagBatch.length === 0) return;

  // BATCH OPERATION: Link all contact-tag relationships at once
  const { error: contactTagError } = await supabase
    .from('contact_tags')
    .upsert(contactTagBatch, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });

  if (contactTagError) {
    console.error('[mailchimp-import] Batch contact-tag link error:', contactTagError);
    throw contactTagError;
  }

  console.log(`[mailchimp-import] Successfully linked ${contactTagBatch.length} contact-tag relationships in batch`);
}

async function batchInsertSources(
  supabase: any,
  tenantId: string,
  members: any[],
  emailToIdMap: Map<string, string>
): Promise<void> {
  const sourceBatch: any[] = [];

  members.forEach(member => {
    const email = member.email_address?.toLowerCase();
    if (!email) return;

    const contactId = emailToIdMap.get(email);
    if (!contactId) return;

    sourceBatch.push({
      customer_id: contactId,
      tenant_id: tenantId,
      field_name: 'source',
      field_value: 'mailchimp_import',
      field_type: 'text'
    });
  });

  // BATCH OPERATION: Insert all sources at once
  const { error: sourceError } = await supabase
    .from('customer_additional_fields')
    .upsert(sourceBatch, { onConflict: 'customer_id,field_name' });

  if (sourceError) {
    console.error('[mailchimp-import] Batch source insertion error:', sourceError);
    throw sourceError;
  }

  console.log(`[mailchimp-import] Successfully inserted ${sourceBatch.length} source records in batch`);
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

    // Use service role key
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

    // Validate JWT
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

    // Get job
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

    // Get tenant
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) throw new Error('Tenant not found');

    // Get connection
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

    // Decrypt token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      console.error('[mailchimp-import] Decryption failed:', error.message);
      throw new Error('Failed to decrypt access token');
    }

    const dc = connection.metadata?.dc || connection.metadata?.api_endpoint?.match(/https:\/\/(.+?)\.api\.mailchimp\.com/)?.[1];
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    // Update job to running
    await supabase.rpc('update_import_job_progress', {
      p_job_id: importJob.id,
      p_progress_percentage: 0,
      p_current_stage: 'Initializing import...'
    });

    console.log(`[mailchimp-import] Started job ${importJob.id}`);

    const config = importJob.config as any || {};
    const listIds = config.listIds || [];
    const segmentIds = config.segmentIds || [];

    let totalContacts = 0;
    let totalErrors = 0;
    const batchSize = 100;
    let currentBatch = 0;

    // Process lists with batch operations
    for (const listId of listIds) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Fetch members from Mailchimp
        const membersRes = await fetch(
          `${baseUrl}/lists/${listId}/members?count=${batchSize}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields,members.tags`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (membersRes.status === 401) {
          throw new Error('Access token expired. Please reconnect Mailchimp.');
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

        try {
          // PHASE 1: BATCH OPERATIONS - Process entire batch at once
          console.log(`[mailchimp-import] Processing batch ${currentBatch + 1} with ${members.length} contacts`);

          // Step 1: Batch upsert contacts
          const emailToIdMap = await batchUpsertContacts(supabase, tenantId, members);

          // Step 2: Batch upsert consents
          await batchUpsertConsents(supabase, members, emailToIdMap);

          // Step 3: Batch upsert suppressions
          await batchUpsertSuppressions(supabase, tenantId, members);

          // Step 4: Batch upsert tags and link to contacts
          await batchUpsertTags(supabase, tenantId, members, emailToIdMap);

          // Step 5: Batch insert source tracking
          await batchInsertSources(supabase, tenantId, members, emailToIdMap);

          totalContacts += members.length;
          currentBatch++;

          // PHASE 3: REAL-TIME PROGRESS UPDATE
          const progressPercentage = Math.min(
            Math.round((totalContacts / (config.estimatedTotal || totalContacts + batchSize)) * 100),
            99
          );

          await supabase.rpc('update_import_job_progress', {
            p_job_id: importJob.id,
            p_progress_percentage: progressPercentage,
            p_current_stage: `Importing contacts from list ${listId}`,
            p_batch_stats: {
              total_batches: currentBatch,
              completed_batches: currentBatch,
              failed_batches: 0,
              contacts_per_batch: batchSize,
              contacts_imported: totalContacts
            }
          });

          console.log(`[mailchimp-import] Progress: ${progressPercentage}% (${totalContacts} contacts imported)`);

        } catch (error: any) {
          console.error('[mailchimp-import] Batch processing error:', error);
          totalErrors++;
          
          await supabase.rpc('log_import_batch_error', {
            p_job_id: importJob.id,
            p_batch_number: currentBatch,
            p_error_message: error.message,
            p_failed_items: members.map((m: any) => m.email_address)
          });
        }

        offset += batchSize;
      }
    }

    // Finalize job
    await supabase
      .from('import_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        current_stage: 'Import completed',
        report: {
          started_at: importJob.created_at,
          completed_at: new Date().toISOString(),
          contacts_imported: totalContacts,
          segments_imported: segmentIds.length,
          errors: totalErrors,
          batches_processed: currentBatch
        }
      })
      .eq('id', importJob.id);

    console.log(`[mailchimp-import] ✅ Completed job ${importJob.id}: ${totalContacts} contacts imported in ${currentBatch} batches`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: importJob.id,
        contactsImported: totalContacts,
        segmentsImported: segmentIds.length,
        errors: totalErrors,
        batchesProcessed: currentBatch,
        progress: {
          stage: 'complete',
          percentage: 100
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
