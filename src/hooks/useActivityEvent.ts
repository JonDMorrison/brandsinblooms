import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityEvent } from '@/types/activity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEvent(row: any): ActivityEvent {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    customer_id: row.customer_id ?? null,
    actor_type: row.actor_type ?? 'system',
    actor_id: row.actor_id ?? null,
    source: row.source ?? 'sync',
    integration_name: row.integration_name ?? null,
    activity_type: row.activity_type ?? 'unknown',
    status: row.status ?? 'success',
    title: row.title ?? '',
    description: (row.description ?? { parts: [] }) as any,
    metadata: (row.metadata ?? {}) as any,
    related_entities: (row.related_entities ?? {}) as any,
    links: (row.links ?? []) as any,
    error_message: row.error_message ?? null,
  };
}

export function useActivityEvent(eventId?: string) {
  return useQuery({
    queryKey: ['activity-event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return null;
      const [prefix, rawId] = eventId.split(':');
      if (!rawId) return null;

      if (prefix === 'ev' && UUID_RE.test(rawId)) {
        const { data: eventRow, error: eventError } = await supabase
          .from('crm_activity_events')
          .select('*')
          .eq('id', rawId)
          .maybeSingle();
        if (eventError) throw eventError;
        if (!eventRow) return null;
        return normalizeEvent({ id: `ev:${eventRow.id}`, ...eventRow });
      }

      if (prefix === 'lte' && UUID_RE.test(rawId)) {
        const { data: legacyRow, error: legacyError } = await supabase
          .from('customer_timeline_events')
          .select('id, event_date, customer_id, event_type, title, description, metadata')
          .eq('id', rawId)
          .maybeSingle();
        if (legacyError) throw legacyError;
        if (!legacyRow) return null;
        return normalizeEvent({
          id: `lte:${legacyRow.id}`,
          timestamp: legacyRow.event_date,
          customer_id: legacyRow.customer_id,
          actor_type: 'system',
          actor_id: null,
          source: 'sync',
          integration_name: null,
          activity_type: legacyRow.event_type,
          status: 'success',
          title: legacyRow.title,
          description: {
            parts: legacyRow.description
              ? [{ type: 'text', text: legacyRow.description }]
              : [],
          },
          metadata: legacyRow.metadata ?? {},
          related_entities: { customer_id: legacyRow.customer_id },
          links: [
            {
              type: 'customer',
              href: `/crm/customers/${legacyRow.customer_id}`,
            },
          ],
          error_message: null,
        });
      }

      if (prefix === 'lt' && UUID_RE.test(rawId)) {
        const { data: legacyRow, error: legacyError } = await supabase
          .from('customer_timeline')
          .select('id, created_at, customer_id, activity_type, campaign_id, campaign_name, metadata')
          .eq('id', rawId)
          .maybeSingle();
        if (legacyError) throw legacyError;
        if (!legacyRow) return null;
        const title = legacyRow.campaign_name || legacyRow.activity_type;
        return normalizeEvent({
          id: `lt:${legacyRow.id}`,
          timestamp: legacyRow.created_at,
          customer_id: legacyRow.customer_id,
          actor_type: 'system',
          actor_id: null,
          source: 'sync',
          integration_name: null,
          activity_type: legacyRow.activity_type,
          status: 'success',
          title,
          description: {
            parts: title ? [{ type: 'text', text: title }] : [],
          },
          metadata: legacyRow.metadata ?? {},
          related_entities: {
            customer_id: legacyRow.customer_id,
            campaign_id: legacyRow.campaign_id,
          },
          links: [
            {
              type: 'customer',
              href: `/crm/customers/${legacyRow.customer_id}`,
            },
          ],
          error_message: null,
        });
      }

      // Unknown prefix - return null
      return null;
    },
  });
}
