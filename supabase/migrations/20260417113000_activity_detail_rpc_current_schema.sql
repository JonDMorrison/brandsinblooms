-- Refresh activity detail RPC to match the current legacy timeline schema.

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
      COALESCE(e.metadata, '{}'::jsonb) AS metadata,
      COALESCE(e.related_entities, '{}'::jsonb) AS related_entities,
      COALESCE(e.links, '[]'::jsonb) AS links,
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
          ELSE jsonb_build_array(jsonb_build_object('type', 'text', 'text', l.description))
        END
      ) AS description,
      COALESCE(l.metadata, '{}'::jsonb) AS metadata,
      jsonb_strip_nulls(
        jsonb_build_object(
          'customer_id',
          l.customer_id
        )
      ) AS related_entities,
      jsonb_build_array(
        jsonb_build_object('type', 'customer', 'href', ('/crm/customers/' || l.customer_id::text))
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
      t.activity_type,
      'success'::text AS status,
      COALESCE(
        NULLIF(t.campaign_name, ''),
        NULLIF(t.product_name, ''),
        initcap(replace(replace(t.activity_type, '.', ' '), '_', ' '))
      ) AS title,
      jsonb_build_object(
        'parts',
        CASE
          WHEN NULLIF(
            concat_ws(
              ' • ',
              NULLIF(t.campaign_name, ''),
              NULLIF(t.product_name, ''),
              CASE
                WHEN t.purchase_amount IS NOT NULL THEN
                  '$' || trim(to_char(t.purchase_amount, 'FM999999990D00'))
                ELSE NULL
              END
            ),
            ''
          ) IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(
            jsonb_build_object(
              'type',
              'text',
              'text',
              concat_ws(
                ' • ',
                NULLIF(t.campaign_name, ''),
                NULLIF(t.product_name, ''),
                CASE
                  WHEN t.purchase_amount IS NOT NULL THEN
                    '$' || trim(to_char(t.purchase_amount, 'FM999999990D00'))
                  ELSE NULL
                END
              )
            )
          )
        END
      ) AS description,
      COALESCE(t.metadata, '{}'::jsonb) || jsonb_strip_nulls(
        jsonb_build_object(
          'campaign_name', t.campaign_name,
          'product_name', t.product_name,
          'purchase_amount', t.purchase_amount
        )
      ) AS metadata,
      jsonb_strip_nulls(
        jsonb_build_object(
          'customer_id', t.customer_id,
          'campaign_id', t.campaign_id,
          'campaign_name', t.campaign_name
        )
      ) AS related_entities,
      jsonb_build_array(
        jsonb_build_object('type', 'customer', 'href', ('/crm/customers/' || t.customer_id::text))
      ) || CASE
        WHEN t.campaign_id IS NOT NULL THEN
          jsonb_build_array(
            jsonb_build_object(
              'type',
              'campaign',
              'label',
              COALESCE(NULLIF(t.campaign_name, ''), 'Open campaign'),
              'href',
              ('/crm/campaigns/' || t.campaign_id::text)
            )
          )
        ELSE '[]'::jsonb
      END AS links,
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
  SELECT *
  FROM combined
  WHERE combined.id = p_event_id
  LIMIT 1;
END;
$$;