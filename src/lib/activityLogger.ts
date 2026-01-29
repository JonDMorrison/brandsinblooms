import { supabase } from '@/integrations/supabase/client';

type ActivityDescriptionPart = {
  type: 'text' | 'link' | 'mention';
  text?: string;
  href?: string;
  label?: string;
};

interface LogActivityParams {
  tenantId: string;
  customerId?: string | null;
  actorType: 'user' | 'automation' | 'integration' | 'system';
  actorId?: string | null;
  source: 'ui' | 'automation' | 'webhook' | 'sync';
  activityType: string;
  status: 'success' | 'failed' | 'pending' | 'warning';
  title: string;
  description?: { parts: ActivityDescriptionPart[] };
  metadata?: Record<string, unknown>;
  relatedEntities?: Record<string, unknown>;
  links?: Array<{ type?: string; href?: string; label?: string }>;
  integrationName?: string | null;
  errorMessage?: string | null;
}

export async function logActivity(params: LogActivityParams) {
  const { error } = await supabase.from('crm_activity_events').insert([
    {
      tenant_id: params.tenantId,
      customer_id: params.customerId ?? null,
      actor_type: params.actorType,
      actor_id: params.actorId ?? null,
      source: params.source,
      integration_name: params.integrationName ?? null,
      activity_type: params.activityType,
      status: params.status,
      title: params.title,
      description: params.description ?? { parts: [] },
      metadata: params.metadata ?? {},
      related_entities: params.relatedEntities ?? {},
      links: params.links ?? [],
      error_message: params.errorMessage ?? null,
    } as any,
  ]);

  if (error) {
    console.error('[logActivity] Failed to log activity event:', error);
  }
}
