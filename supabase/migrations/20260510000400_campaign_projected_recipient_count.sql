ALTER TABLE public.crm_campaigns
ADD COLUMN IF NOT EXISTS projected_recipient_count integer;

CREATE OR REPLACE FUNCTION public.compute_campaign_projected_recipient_count(
  p_campaign_id uuid
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH campaign AS (
    SELECT
      c.id,
      c.tenant_id,
      c.segment_id,
      c.persona_ids,
      c.include_all_customers,
      c.additional_customer_ids,
      COALESCE(c.metadata::jsonb, '{}'::jsonb) AS metadata
    FROM public.crm_campaigns c
    WHERE c.id = p_campaign_id
  ),
  audience_expansion AS (
    SELECT
      c.id,
      c.tenant_id,
      COALESCE(
        CASE
          WHEN jsonb_typeof(c.metadata -> 'includeAllCustomers') = 'boolean'
            THEN (c.metadata ->> 'includeAllCustomers')::boolean
          ELSE NULL
        END,
        CASE
          WHEN jsonb_typeof(c.metadata -> 'include_all_customers') = 'boolean'
            THEN (c.metadata ->> 'include_all_customers')::boolean
          ELSE NULL
        END,
        c.include_all_customers,
        false
      ) AS include_all_customers,
      COALESCE(
        NULLIF(
          ARRAY(
            SELECT DISTINCT value::uuid
            FROM jsonb_array_elements_text(
              COALESCE(
                CASE
                  WHEN jsonb_typeof(c.metadata -> 'additionalCustomerIds') = 'array'
                    THEN c.metadata -> 'additionalCustomerIds'
                  ELSE NULL
                END,
                CASE
                  WHEN jsonb_typeof(c.metadata -> 'additional_customer_ids') = 'array'
                    THEN c.metadata -> 'additional_customer_ids'
                  ELSE NULL
                END,
                '[]'::jsonb
              )
            ) AS value
            WHERE value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          ),
          ARRAY[]::uuid[]
        ),
        c.additional_customer_ids,
        ARRAY[]::uuid[]
      ) AS additional_customer_ids
    FROM campaign c
  ),
  segment_sources AS (
    SELECT DISTINCT segment_id::text AS segment_id
    FROM (
      SELECT c.segment_id
      FROM campaign c
      WHERE c.segment_id IS NOT NULL

      UNION ALL

      SELECT cs.segment_id
      FROM public.campaign_segments cs
      JOIN campaign c ON c.id = cs.campaign_id
    ) segment_values
    WHERE segment_id IS NOT NULL
  ),
  custom_segment_ids AS (
    SELECT segment_id::uuid AS segment_id
    FROM segment_sources
    WHERE segment_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  system_segment_ids AS (
    SELECT segment_id
    FROM segment_sources
    WHERE segment_id IN (
      'perks-members',
      'loyalty-members',
      'high-value',
      'new-customers',
      'lapsed-customers',
      'seasonal-shoppers',
      'frequent-buyers'
    )
  ),
  system_segment_name_map AS (
    SELECT *
    FROM (
      VALUES
        ('perks-members', 'Perks Members'),
        ('loyalty-members', 'Loyalty Members'),
        ('high-value', 'High-Value Customers'),
        ('new-customers', 'New Customers'),
        ('lapsed-customers', 'Lapsed Customers'),
        ('seasonal-shoppers', 'Seasonal Shoppers'),
        ('frequent-buyers', 'Frequent Buyers')
    ) AS mapped(segment_id, segment_name)
  ),
  manual_system_segment_customer_ids AS (
    SELECT DISTINCT cs.customer_id
    FROM system_segment_ids ssi
    JOIN system_segment_name_map ssm ON ssm.segment_id = ssi.segment_id
    JOIN campaign c ON TRUE
    JOIN public.crm_segments s
      ON s.tenant_id = c.tenant_id
     AND s.name = ssm.segment_name
    JOIN public.customer_segments cs ON cs.segment_id = s.id
  ),
  automatic_system_segment_customer_ids AS (
    SELECT DISTINCT c.id AS customer_id
    FROM public.crm_customers c
    JOIN campaign cam ON cam.tenant_id = c.tenant_id
    JOIN system_segment_ids ssi ON TRUE
    LEFT JOIN public.customer_loyalty_metrics clm ON clm.customer_id = c.id
    WHERE c.deleted_at IS NULL
      AND (
        (
          ssi.segment_id = 'perks-members'
          AND COALESCE(clm.is_perks_member, false)
        )
        OR (
          ssi.segment_id = 'loyalty-members'
          AND EXISTS (
            SELECT 1
            FROM unnest(COALESCE(c.tags, ARRAY[]::text[])) AS tag
            WHERE lower(tag) = 'loyalty'
          )
        )
        OR (
          ssi.segment_id = 'high-value'
          AND COALESCE(c.total_spent, 0) > 500
        )
        OR (
          ssi.segment_id = 'new-customers'
          AND c.created_at >= now() - interval '30 days'
        )
        OR (
          ssi.segment_id = 'lapsed-customers'
          AND c.last_purchase_date < now() - interval '90 days'
        )
        OR (
          ssi.segment_id = 'seasonal-shoppers'
          AND EXISTS (
            SELECT 1
            FROM unnest(COALESCE(c.tags, ARRAY[]::text[])) AS tag
            WHERE lower(tag) IN (
              'seasonal',
              'holiday',
              'christmas',
              'valentine',
              'easter',
              'summer',
              'winter'
            )
          )
        )
        OR (
          ssi.segment_id = 'frequent-buyers'
          AND jsonb_typeof(COALESCE(c.order_history::jsonb, 'null'::jsonb)) = 'array'
          AND jsonb_array_length(COALESCE(c.order_history::jsonb, '[]'::jsonb)) >= 3
        )
      )
  ),
  segment_customer_ids AS (
    SELECT DISTINCT customer_id
    FROM (
      SELECT cs.customer_id
      FROM public.customer_segments cs
      JOIN custom_segment_ids csi ON csi.segment_id = cs.segment_id

      UNION ALL

      SELECT customer_id
      FROM automatic_system_segment_customer_ids

      UNION ALL

      SELECT customer_id
      FROM manual_system_segment_customer_ids
    ) segment_union
  ),
  persona_sources AS (
    SELECT DISTINCT persona_id
    FROM (
      SELECT unnest(COALESCE(c.persona_ids, ARRAY[]::text[]))::text AS persona_id
      FROM campaign c

      UNION ALL

      SELECT cp.persona_id::text
      FROM public.campaign_personas cp
      JOIN campaign c ON c.id = cp.campaign_id
    ) persona_values
    WHERE persona_id IS NOT NULL
      AND btrim(persona_id) <> ''
  ),
  persona_uuid_ids AS (
    SELECT persona_id::uuid AS persona_id
    FROM persona_sources
    WHERE persona_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  predefined_persona_ids AS (
    SELECT persona_id
    FROM persona_sources
    WHERE NOT (
      persona_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  ),
  persona_customer_ids AS (
    SELECT DISTINCT customer_id
    FROM (
      SELECT cp.customer_id
      FROM public.customer_personas cp
      JOIN persona_uuid_ids pui ON pui.persona_id = cp.persona_id

      UNION ALL

      SELECT c.id AS customer_id
      FROM public.crm_customers c
      JOIN campaign cam ON cam.tenant_id = c.tenant_id
      JOIN persona_uuid_ids pui ON pui.persona_id = c.persona_id
      WHERE c.deleted_at IS NULL

      UNION ALL

      SELECT cp.customer_id
      FROM public.customer_personas cp
      JOIN predefined_persona_ids ppi
        ON ppi.persona_id = cp.predefined_persona_id
    ) persona_union
  ),
  has_segments AS (
    SELECT EXISTS(SELECT 1 FROM segment_sources) AS value
  ),
  has_personas AS (
    SELECT EXISTS(SELECT 1 FROM persona_sources) AS value
  ),
  has_additional_customers AS (
    SELECT COALESCE(cardinality(ae.additional_customer_ids), 0) > 0 AS value
    FROM audience_expansion ae
  ),
  legacy_all_customers AS (
    SELECT
      NOT ae.include_all_customers
      AND NOT hs.value
      AND NOT hp.value
      AND NOT hac.value AS value
    FROM audience_expansion ae
    CROSS JOIN has_segments hs
    CROSS JOIN has_personas hp
    CROSS JOIN has_additional_customers hac
  ),
  base_customer_ids AS (
    SELECT DISTINCT customer_id
    FROM (
      SELECT c.id AS customer_id
      FROM public.crm_customers c
      JOIN campaign cam ON cam.tenant_id = c.tenant_id
      JOIN audience_expansion ae ON TRUE
      WHERE c.deleted_at IS NULL
        AND ae.include_all_customers

      UNION ALL

      SELECT c.id AS customer_id
      FROM public.crm_customers c
      JOIN campaign cam ON cam.tenant_id = c.tenant_id
      JOIN legacy_all_customers lac ON lac.value
      WHERE c.deleted_at IS NULL
        AND c.email IS NOT NULL
        AND btrim(c.email) <> ''
        AND c.email_opt_in IS DISTINCT FROM false

      UNION ALL

      SELECT sc.customer_id
      FROM segment_customer_ids sc
      JOIN has_segments hs ON hs.value
      JOIN has_personas hp ON NOT hp.value

      UNION ALL

      SELECT pc.customer_id
      FROM persona_customer_ids pc
      JOIN has_segments hs ON NOT hs.value
      JOIN has_personas hp ON hp.value

      UNION ALL

      SELECT sc.customer_id
      FROM segment_customer_ids sc
      JOIN has_segments hs ON hs.value
      JOIN has_personas hp ON hp.value
      JOIN persona_customer_ids pc ON pc.customer_id = sc.customer_id
    ) base_union
  ),
  validated_additional_customer_ids AS (
    SELECT DISTINCT c.id AS customer_id
    FROM public.crm_customers c
    JOIN campaign cam ON cam.tenant_id = c.tenant_id
    JOIN audience_expansion ae ON c.id = ANY(ae.additional_customer_ids)
    WHERE c.deleted_at IS NULL
  ),
  resolved_customer_ids AS (
    SELECT customer_id
    FROM base_customer_ids

    UNION

    SELECT customer_id
    FROM validated_additional_customer_ids
  )
  SELECT COALESCE((SELECT COUNT(*) FROM resolved_customer_ids), 0)::integer;
$$;

UPDATE public.crm_campaigns
SET projected_recipient_count = public.compute_campaign_projected_recipient_count(id)
WHERE projected_recipient_count IS NULL;

NOTIFY pgrst, 'reload schema';