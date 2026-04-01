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
  IF to_regclass('public.provider_artifacts') IS NOT NULL THEN
    WITH ranked_artifacts AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY tenant_id, provider, artifact_type, external_id
          ORDER BY created_at DESC, id DESC
        ) AS row_number
      FROM public.provider_artifacts
    )
    DELETE FROM public.provider_artifacts
    WHERE id IN (
      SELECT id
      FROM ranked_artifacts
      WHERE row_number > 1
    );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.provider_artifacts'::regclass
        AND conname = 'provider_artifacts_unique_artifact'
    ) THEN
      ALTER TABLE public.provider_artifacts
        ADD CONSTRAINT provider_artifacts_unique_artifact
        UNIQUE (tenant_id, provider, artifact_type, external_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;