import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsJsonResponse, handleCorsPrelight } from '../_shared/cors.ts';

interface BulkActionRequest {
  action: 'add-tag' | 'add-to-segment';
  campaignId: string;
  recipientIds?: string[] | null;
  search?: string | null;
  eventFilter?: string | null;
  eventFilters?: string[] | null;
  timeRange?: 'all' | '1h' | '24h' | '7d';
  deliveryFilter?: 'all' | 'delivered' | 'bounced' | 'pending' | 'failed';
  tagName?: string | null;
  segmentId?: string | null;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return corsJsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    const body = (await req.json()) as BulkActionRequest;
    if (!body?.campaignId || !body?.action) {
      return corsJsonResponse({ error: 'campaignId and action are required' }, { status: 400 });
    }

    const { data: userRecord, error: userError } = await userClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      return corsJsonResponse({ error: 'User tenant not found' }, { status: 403 });
    }

    const { data: rows, error: rowsError } = await userClient.rpc(
      'get_campaign_recipient_matches' as never,
      {
        p_campaign_id: body.campaignId,
        p_search: body.search?.trim() || null,
        p_event_filters: body.eventFilters?.length ? body.eventFilters : null,
        p_event_filter: body.eventFilter?.trim() || 'all',
        p_time_range: body.timeRange || 'all',
        p_delivery_filter: body.deliveryFilter || 'all',
        p_recipient_ids: body.recipientIds?.length ? body.recipientIds : null,
      } as never,
    );

    if (rowsError) {
      console.error('[campaign-recipient-bulk-actions] Failed to resolve rows', rowsError);
      return corsJsonResponse({ error: 'Failed to resolve recipients' }, { status: 500 });
    }

    const customerIds = Array.from(new Set((rows || []).map((row: any) => row.customer_id).filter(Boolean)));
    const skippedCount = (rows || []).filter((row: any) => !row.customer_id).length;

    if (body.action === 'add-tag') {
      const normalizedTag = String(body.tagName || '').trim();
      if (!normalizedTag) {
        return corsJsonResponse({ error: 'tagName is required' }, { status: 400 });
      }

      const { data: existingTag, error: tagLookupError } = await userClient
        .from('crm_tags')
        .select('id, name')
        .eq('tenant_id', userRecord.tenant_id)
        .ilike('name', normalizedTag)
        .maybeSingle();

      if (tagLookupError) {
        return corsJsonResponse({ error: 'Failed to resolve tag' }, { status: 500 });
      }

      let tagId = existingTag?.id || null;
      let tagName = existingTag?.name || normalizedTag;

      if (!tagId) {
        const { data: insertedTag, error: insertTagError } = await userClient
          .from('crm_tags')
          .insert({ tenant_id: userRecord.tenant_id, name: normalizedTag })
          .select('id, name')
          .single();

        if (insertTagError || !insertedTag) {
          return corsJsonResponse({ error: 'Failed to create tag' }, { status: 500 });
        }

        tagId = insertedTag.id;
        tagName = insertedTag.name;
      }

      if (customerIds.length > 0) {
        const { error: insertMembershipError } = await userClient
          .from('customer_tags')
          .upsert(
            customerIds.map((customerId) => ({ contact_id: customerId, tag_id: tagId })),
            { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
          );

        if (insertMembershipError) {
          return corsJsonResponse({ error: 'Failed to assign tag to customers' }, { status: 500 });
        }
      }

      return corsJsonResponse({
        ok: true,
        processedCount: customerIds.length,
        skippedCount,
        failedCount: 0,
        totalResolved: rows?.length || 0,
        tagName,
      });
    }

    if (body.action === 'add-to-segment') {
      const segmentId = String(body.segmentId || '').trim();
      if (!segmentId) {
        return corsJsonResponse({ error: 'segmentId is required' }, { status: 400 });
      }

      const { data: segment, error: segmentError } = await userClient
        .from('crm_segments')
        .select('id, name')
        .eq('id', segmentId)
        .eq('tenant_id', userRecord.tenant_id)
        .single();

      if (segmentError || !segment) {
        return corsJsonResponse({ error: 'Segment not found' }, { status: 404 });
      }

      if (customerIds.length > 0) {
        const { error: addSegmentError } = await userClient
          .from('customer_segments')
          .upsert(
            customerIds.map((customerId) => ({
              customer_id: customerId,
              segment_id: segment.id,
              assigned_by_user_id: user.id,
            })),
            { onConflict: 'customer_id,segment_id', ignoreDuplicates: true },
          );

        if (addSegmentError) {
          return corsJsonResponse({ error: 'Failed to assign customers to segment' }, { status: 500 });
        }
      }

      return corsJsonResponse({
        ok: true,
        processedCount: customerIds.length,
        skippedCount,
        failedCount: 0,
        totalResolved: rows?.length || 0,
        segmentName: segment.name,
      });
    }

    return corsJsonResponse({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[campaign-recipient-bulk-actions] Error', error);
    return corsJsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
});