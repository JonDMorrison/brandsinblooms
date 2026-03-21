import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsJsonResponse, handleCorsPrelight } from '../_shared/cors.ts';

type TimeRange = 'all' | '1h' | '24h' | '7d';
type DeliveryFilter = 'all' | 'delivered' | 'bounced' | 'pending' | 'failed';

interface ExportRequest {
  campaignId: string;
  recipientIds?: string[] | null;
  search?: string | null;
  eventFilter?: string | null;
  eventFilters?: string[] | null;
  timeRange?: TimeRange;
  deliveryFilter?: DeliveryFilter;
}

function toCsvValue(value: unknown) {
  const stringValue = value == null ? '' : String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatEventLabel(event: string | null | undefined) {
  switch ((event || '').toLowerCase()) {
    case 'opened':
      return 'Opened';
    case 'clicked':
      return 'Clicked';
    case 'delivered':
      return 'Delivered';
    case 'bounced':
      return 'Bounced';
    case 'complained':
      return 'Complained';
    case 'unsubscribed':
      return 'Unsubscribed';
    case 'failed':
      return 'Failed';
    case 'sending':
      return 'Sending';
    case 'queued':
      return 'Queued';
    case 'sent':
      return 'Sent';
    default:
      return event || 'Unknown';
  }
}

function formatDeliveryLabel(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'delivered':
      return 'Delivered';
    case 'bounced':
      return 'Bounced';
    case 'failed':
      return 'Failed';
    case 'pending':
    case 'delayed':
      return 'Pending';
    default:
      return status || 'Unknown';
  }
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

    const body = (await req.json()) as ExportRequest;
    if (!body?.campaignId) {
      return corsJsonResponse({ error: 'campaignId is required' }, { status: 400 });
    }

    const { data: campaign, error: campaignError } = await userClient
      .from('crm_campaigns')
      .select('id, name')
      .eq('id', body.campaignId)
      .single();

    if (campaignError || !campaign) {
      return corsJsonResponse({ error: 'Campaign not found' }, { status: 404 });
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
      console.error('[campaign-recipient-export] Failed to resolve rows', rowsError);
      return corsJsonResponse({ error: 'Failed to resolve recipients' }, { status: 500 });
    }

    const headers = [
      'Customer Name',
      'Email Address',
      'Latest Event',
      'Event Timestamp',
      'Delivery Status',
      'All Events',
    ];

    const csvRows = (rows || []).map((row: any) => [
      row.customer_name || '',
      row.customer_email,
      formatEventLabel(row.latest_event),
      row.latest_event_at || '',
      formatDeliveryLabel(row.delivery_status),
      Array.isArray(row.all_events) ? row.all_events.map((event: string) => formatEventLabel(event)).join(', ') : '',
    ]);

    const csvContent = [
      headers.map(toCsvValue).join(','),
      ...csvRows.map((row) => row.map(toCsvValue).join(',')),
    ].join('\n');

    const dateStamp = new Date().toISOString().split('T')[0];
    const fileName = `${String(campaign.name || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}-recipients-export-${dateStamp}.csv`;

    return corsJsonResponse({
      ok: true,
      csvContent,
      fileName,
      rowCount: rows?.length || 0,
    });
  } catch (error) {
    console.error('[campaign-recipient-export] Error', error);
    return corsJsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
});
