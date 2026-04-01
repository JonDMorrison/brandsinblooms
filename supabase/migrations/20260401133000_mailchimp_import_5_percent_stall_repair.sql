DO $$
BEGIN
  IF to_regclass('public.crm_segments') IS NOT NULL THEN
    ALTER TABLE public.crm_segments
      ADD COLUMN IF NOT EXISTS source TEXT,
      ADD COLUMN IF NOT EXISTS source_id TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_segments_tenant_source_source_id
      ON public.crm_segments (tenant_id, source, source_id)
      WHERE source IS NOT NULL AND source_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.customer_segments') IS NULL THEN
    CREATE TABLE public.customer_segments (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      customer_id UUID NOT NULL,
      segment_id UUID NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      assigned_by_user_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(customer_id, segment_id)
    );
  END IF;

  IF to_regclass('public.customer_segments') IS NOT NULL THEN
    ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'customer_segments'
        AND policyname = 'Users can manage customer segments for their tenant'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Users can manage customer segments for their tenant"
        ON public.customer_segments
        FOR ALL
        USING (
          EXISTS (
            SELECT 1
            FROM public.crm_customers c
            JOIN public.users u ON u.tenant_id = c.tenant_id
            WHERE c.id = customer_segments.customer_id
              AND u.id = auth.uid()
          )
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.customer_segments'::regclass
        AND conname = 'fk_customer_segments_customer'
    ) THEN
      ALTER TABLE public.customer_segments
        ADD CONSTRAINT fk_customer_segments_customer
        FOREIGN KEY (customer_id)
        REFERENCES public.crm_customers(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.customer_segments'::regclass
        AND conname = 'fk_customer_segments_segment'
    ) THEN
      ALTER TABLE public.customer_segments
        ADD CONSTRAINT fk_customer_segments_segment
        FOREIGN KEY (segment_id)
        REFERENCES public.crm_segments(id)
        ON DELETE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_customer_segments_customer_id
      ON public.customer_segments(customer_id);

    CREATE INDEX IF NOT EXISTS idx_customer_segments_segment_id
      ON public.customer_segments(segment_id);
  END IF;
END $$;

DO $$
DECLARE
  source_type_definition TEXT;
BEGIN
  IF to_regclass('public.customer_sources') IS NOT NULL THEN
    SELECT pg_get_constraintdef(c.oid)
    INTO source_type_definition
    FROM pg_constraint c
    WHERE c.conrelid = 'public.customer_sources'::regclass
      AND c.conname = 'customer_sources_source_type_check';

    IF source_type_definition IS NULL
       OR source_type_definition NOT ILIKE '%mailchimp%'
       OR source_type_definition NOT ILIKE '%klaviyo%'
       OR source_type_definition NOT ILIKE '%constant_contact%'
       OR source_type_definition NOT ILIKE '%csv%'
       OR source_type_definition NOT ILIKE '%manual%'
       OR source_type_definition NOT ILIKE '%pos%'
       OR source_type_definition NOT ILIKE '%api%'
    THEN
      ALTER TABLE public.customer_sources
        DROP CONSTRAINT IF EXISTS customer_sources_source_type_check;

      ALTER TABLE public.customer_sources
        ADD CONSTRAINT customer_sources_source_type_check
        CHECK (
          source_type = ANY (
            ARRAY[
              'mailchimp'::text,
              'klaviyo'::text,
              'constant_contact'::text,
              'csv'::text,
              'manual'::text,
              'pos'::text,
              'api'::text
            ]
          )
        );
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.suppression_list') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY tenant_id, email, channel, suppression_type
          ORDER BY suppressed_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS row_number
      FROM public.suppression_list
      WHERE email IS NOT NULL
    )
    DELETE FROM public.suppression_list
    WHERE id IN (
      SELECT id
      FROM ranked
      WHERE row_number > 1
    );

    CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_tenant_email_channel_type_unique
      ON public.suppression_list (tenant_id, email, channel, suppression_type);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.customer_consents') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY customer_id, channel
          ORDER BY updated_at DESC NULLS LAST, consent_timestamp DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS row_number
      FROM public.customer_consents
    )
    DELETE FROM public.customer_consents
    WHERE id IN (
      SELECT id
      FROM ranked
      WHERE row_number > 1
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.customer_consents'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) = 'UNIQUE (customer_id, channel)'
    ) THEN
      ALTER TABLE public.customer_consents
        ADD CONSTRAINT customer_consents_customer_id_channel_unique
        UNIQUE (customer_id, channel);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_import_batch_error(
  p_job_id UUID,
  p_batch_number INTEGER,
  p_error_message TEXT,
  p_failed_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.import_jobs
  SET
    error_details = COALESCE(error_details, '[]'::jsonb) || jsonb_build_object(
      'batch', p_batch_number,
      'error', p_error_message,
      'failed_items', p_failed_items,
      'timestamp', now()
    ),
    batch_stats = jsonb_set(
      COALESCE(batch_stats, '{}'::jsonb),
      '{failed_batches}',
      to_jsonb(COALESCE((COALESCE(batch_stats, '{}'::jsonb)->>'failed_batches')::integer, 0) + 1),
      true
    ),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_contact_import_event(
  p_tenant_id UUID,
  p_source TEXT,
  p_contact_count INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  tenant_id UUID,
  source TEXT,
  contact_count INTEGER,
  rolling_24h_total INTEGER,
  occurred_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_rolling_24h_total INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  IF COALESCE(p_contact_count, 0) <= 0 THEN
    RAISE EXCEPTION 'p_contact_count must be > 0';
  END IF;

  INSERT INTO public.email_governance_contact_import_events (
    tenant_id,
    source,
    contact_count,
    metadata,
    occurred_at
  ) VALUES (
    p_tenant_id,
    COALESCE(NULLIF(trim(p_source), ''), 'unknown'),
    p_contact_count,
    COALESCE(p_metadata, '{}'::jsonb),
    v_now
  );

  SELECT COALESCE(SUM(e.contact_count), 0)::INTEGER
  INTO v_rolling_24h_total
  FROM public.email_governance_contact_import_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.occurred_at >= v_now - INTERVAL '24 hours'
    AND e.occurred_at <= v_now;

  tenant_id := p_tenant_id;
  source := COALESCE(NULLIF(trim(p_source), ''), 'unknown');
  contact_count := p_contact_count;
  rolling_24h_total := v_rolling_24h_total;
  occurred_at := v_now;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_contact_import_event(UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_contact_import_event(UUID, TEXT, INTEGER, JSONB) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;