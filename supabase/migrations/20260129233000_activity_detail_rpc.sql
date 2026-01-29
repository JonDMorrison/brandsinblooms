-- Activity detail RPC for fetching a single event by id (supports legacy sources)

CREATE OR REPLACE FUNCTION public.get_activity_event(
  p_event_id TEXT
)
RETURNS TABLE(
  id TEXT,
  "timestamp" TIMESTAMPTZ,
  customer_id UUID,
  actor_type TEXT,
  actor_id UUID,
  source TEXT,
  integration_name TEXT,
  activity_type TEXT,
  status TEXT,
  title TEXT,
  description JSONB,
  metadata JSONB,
  related_entities JSONB,
  links JSONB,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT u.tenant_id
    INTO v_tenant_id
  FROM public.users u
  WHERE u.id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH new_events AS (
    SELECT
      ('ev:' || e.id::text) AS id,
      e.timestamp,
      e.customer_id,
      e.actor_type,
      e.actor_id,
      e.source,
      e.integration_name,
      e.activity_type,
      e.status,
      e.title,
      e.description,
      e.metadata,
      e.related_entities,
      e.links,
      e.error_message
    FROM public.crm_activity_events e
    WHERE e.tenant_id = v_tenant_id
  ),
  legacy_timeline_events AS (
    SELECT
      ('lte:' || l.id::text) AS id,
      l.event_date AS timestamp,
      l.customer_id,
      'system'::text AS actor_type,
      NULL::uuid AS actor_id,
      'sync'::text AS source,
      NULL::text AS integration_name,
      l.event_type AS activity_type,
      'success'::text AS status,
      l.title,
      jsonb_build_object(
        'parts',
        CASE
          WHEN l.description IS NULL OR l.description = '' THEN '[]'::jsonb
          ELSE jsonb_build_array(jsonb_build_object('type','text','text',l.description))
        END
      ) AS description,
      COALESCE(l.metadata, '{}'::jsonb) AS metadata,
      jsonb_build_object('customer_id', l.customer_id) AS related_entities,
      jsonb_build_array(
        jsonb_build_object('type','customer','href',('/crm/customers/' || l.customer_id::text))
      ) AS links,
      NULL::text AS error_message
    FROM public.customer_timeline_events l
    JOIN public.crm_customers c ON c.id = l.customer_id
    WHERE c.tenant_id = v_tenant_id
  ),
  legacy_timeline AS (
    SELECT
      ('lt:' || t.id::text) AS id,
      t.created_at AS timestamp,
      t.customer_id,
      'system'::text AS actor_type,
      NULL::uuid AS actor_id,
      'sync'::text AS source,
      NULL::text AS integration_name,
      t.event_type AS activity_type,
      'success'::text AS status,
      t.title,
      jsonb_build_object(
        'parts',
        CASE
          WHEN t.description IS NULL OR t.description = '' THEN '[]'::jsonb
          ELSE jsonb_build_array(jsonb_build_object('type','text','text',t.description))
        END
      ) AS description,
      COALESCE(t.metadata, '{}'::jsonb) AS metadata,
      jsonb_build_object('customer_id', t.customer_id) AS related_entities,
      jsonb_build_array(
        jsonb_build_object('type','customer','href',('/crm/customers/' || t.customer_id::text))
      ) AS links,
      NULL::text AS error_message
    FROM public.customer_timeline t
    JOIN public.crm_customers c ON c.id = t.customer_id
    WHERE c.tenant_id = v_tenant_id
  ),
  combined AS (
    SELECT * FROM new_events
    UNION ALL
    SELECT * FROM legacy_timeline_events
    UNION ALL
    SELECT * FROM legacy_timeline
  )
  SELECT * FROM combined WHERE id = p_event_id LIMIT 1;
END;
$$;
