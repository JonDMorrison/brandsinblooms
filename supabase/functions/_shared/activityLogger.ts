export async function logActivityEvent(
  supabase: { from: (table: string) => any },
  params: {
    tenant_id: string;
    customer_id?: string | null;
    actor_type: 'user' | 'automation' | 'integration' | 'system';
    actor_id?: string | null;
    source: 'ui' | 'automation' | 'webhook' | 'sync';
    activity_type: string;
    status: 'success' | 'failed' | 'pending' | 'warning';
    title: string;
    description?: { parts: Array<{ type: string; text?: string; href?: string; label?: string }> };
    metadata?: Record<string, unknown>;
    related_entities?: Record<string, unknown>;
    links?: Array<{ type?: string; href?: string; label?: string }>;
    integration_name?: string | null;
    error_message?: string | null;
  }
) {
  const { error } = await supabase.from('crm_activity_events').insert({
    tenant_id: params.tenant_id,
    customer_id: params.customer_id ?? null,
    actor_type: params.actor_type,
    actor_id: params.actor_id ?? null,
    source: params.source,
    integration_name: params.integration_name ?? null,
    activity_type: params.activity_type,
    status: params.status,
    title: params.title,
    description: params.description ?? { parts: [] },
    metadata: params.metadata ?? {},
    related_entities: params.related_entities ?? {},
    links: params.links ?? [],
    error_message: params.error_message ?? null,
  });

  if (error) {
    console.error('[logActivityEvent] Failed to log activity event:', error);
  }
}
