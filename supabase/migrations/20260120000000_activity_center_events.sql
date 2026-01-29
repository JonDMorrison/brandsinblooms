-- Activity Center core events table + unified feed RPC

-- 1) Core append-only event store
CREATE TABLE IF NOT EXISTS public.crm_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Core
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id UUID NULL REFERENCES public.crm_customers(id) ON DELETE SET NULL,

  -- Attribution
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'automation', 'integration', 'system')),
  actor_id UUID NULL,

  -- Where did it come from?
  source TEXT NOT NULL CHECK (source IN ('ui', 'automation', 'webhook', 'sync')),
  integration_name TEXT NULL,

  -- What happened?
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'warning')),

  -- Human readable
  title TEXT NOT NULL,

  -- Rich structured description: { parts: [{type:'text'|'link'|'mention', ...}] }
  description JSONB NOT NULL DEFAULT '{"parts": []}'::jsonb,

  -- Extensible payloads
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,

  error_message TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for feed performance
CREATE INDEX IF NOT EXISTS idx_crm_activity_events_tenant_time
  ON public.crm_activity_events (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_events_customer_time
  ON public.crm_activity_events (customer_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_events_type
  ON public.crm_activity_events (tenant_id, activity_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_events_status
  ON public.crm_activity_events (tenant_id, status, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_events_actor
  ON public.crm_activity_events (tenant_id, actor_type, timestamp DESC);

-- 2) RLS: select/insert only (immutable)
ALTER TABLE public.crm_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activity_events_select" ON public.crm_activity_events;
CREATE POLICY "crm_activity_events_select"
  ON public.crm_activity_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_activity_events.tenant_id
    )
  );

DROP POLICY IF EXISTS "crm_activity_events_insert" ON public.crm_activity_events;
CREATE POLICY "crm_activity_events_insert"
  ON public.crm_activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = crm_activity_events.tenant_id
    )
  );

-- No UPDATE/DELETE policies on purpose (append-only)

-- 3) Unified feed RPC
-- Returns a normalized Activity model. Includes legacy sources for now:
-- - crm_activity_events (new)
-- - customer_timeline_events
-- - customer_timeline

CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_customer_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_status TEXT[] DEFAULT NULL,
  p_actor_types TEXT[] DEFAULT NULL,
  p_sources TEXT[] DEFAULT NULL,
  p_activity_types TEXT[] DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_segment_ids UUID[] DEFAULT NULL,
  p_persona_ids UUID[] DEFAULT NULL
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
  WITH base_customers AS (
    SELECT c.id
    FROM public.crm_customers c
    WHERE c.tenant_id = v_tenant_id
      AND (p_customer_id IS NULL OR c.id = p_customer_id)
      AND (
        p_search IS NULL OR p_search = '' OR
        c.email ILIKE ('%' || p_search || '%') OR
        COALESCE(c.first_name, '') ILIKE ('%' || p_search || '%') OR
        COALESCE(c.last_name, '') ILIKE ('%' || p_search || '%')
      )
      AND (
        p_persona_ids IS NULL OR array_length(p_persona_ids, 1) IS NULL OR
        c.persona_id = ANY(p_persona_ids)
      )
      AND (
        p_segment_ids IS NULL OR array_length(p_segment_ids, 1) IS NULL OR
        EXISTS (
          SELECT 1
          FROM public.customer_segments cs
          WHERE cs.customer_id = c.id
            AND cs.segment_id = ANY(p_segment_ids)
        )
      )
  ),
  new_events AS (
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
      AND (p_customer_id IS NULL OR e.customer_id = p_customer_id)
      AND (p_start IS NULL OR e.timestamp >= p_start)
      AND (p_end IS NULL OR e.timestamp <= p_end)
      AND (p_status IS NULL OR array_length(p_status, 1) IS NULL OR e.status = ANY(p_status))
      AND (p_actor_types IS NULL OR array_length(p_actor_types, 1) IS NULL OR e.actor_type = ANY(p_actor_types))
      AND (p_sources IS NULL OR array_length(p_sources, 1) IS NULL OR e.source = ANY(p_sources))
      AND (p_activity_types IS NULL OR array_length(p_activity_types, 1) IS NULL OR e.activity_type = ANY(p_activity_types))
      AND (
        p_search IS NULL OR p_search = '' OR
        e.title ILIKE ('%' || p_search || '%')
      )
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
      AND l.customer_id IN (SELECT id FROM base_customers)
      AND (p_start IS NULL OR l.event_date >= p_start)
      AND (p_end IS NULL OR l.event_date <= p_end)
      AND (p_activity_types IS NULL OR array_length(p_activity_types, 1) IS NULL OR l.event_type = ANY(p_activity_types))
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
      t.activity_type AS activity_type,
      'success'::text AS status,
      COALESCE(t.campaign_name, t.activity_type) AS title,
      jsonb_build_object('parts', jsonb_build_array(
        jsonb_build_object('type','text','text', COALESCE(t.campaign_name, t.activity_type))
      )) AS description,
      COALESCE(t.metadata, '{}'::jsonb) AS metadata,
      jsonb_build_object(
        'customer_id', t.customer_id,
        'campaign_id', t.campaign_id
      ) AS related_entities,
      jsonb_build_array(
        jsonb_build_object('type','customer','href',('/crm/customers/' || t.customer_id::text))
      ) AS links,
      NULL::text AS error_message
    FROM public.customer_timeline t
    JOIN public.crm_customers c ON c.id = t.customer_id
    WHERE c.tenant_id = v_tenant_id
      AND t.customer_id IN (SELECT id FROM base_customers)
      AND (p_start IS NULL OR t.created_at >= p_start)
      AND (p_end IS NULL OR t.created_at <= p_end)
      AND (p_activity_types IS NULL OR array_length(p_activity_types, 1) IS NULL OR t.activity_type = ANY(p_activity_types))
  ),
  merged AS (
    SELECT * FROM new_events
    UNION ALL
    SELECT * FROM legacy_timeline_events
    UNION ALL
    SELECT * FROM legacy_timeline
  )
  SELECT
    m.id,
    m.timestamp,
    m.customer_id,
    m.actor_type,
    m.actor_id,
    m.source,
    m.integration_name,
    m.activity_type,
    m.status,
    m.title,
    m.description,
    m.metadata,
    m.related_entities,
    m.links,
    m.error_message
  FROM merged m
  ORDER BY m.timestamp DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_feed(UUID, INT, INT, TEXT, TEXT[], TEXT[], TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, UUID[], UUID[]) TO authenticated;
