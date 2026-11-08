-- A deliberately narrow read model for the trusted Slack worker. The private
-- Bloom Support schema is not exposed through PostgREST, and this function
-- returns no evidence, customer, ticket, decision-note, or staff fields.
CREATE OR REPLACE FUNCTION public.bloom_support_slack_feature_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', feature.title,
        'product', feature.product,
        'status', feature.status,
        'updated_at', feature.updated_at
      )
      ORDER BY feature.updated_at DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT title, product, status, updated_at
    FROM bloom_support.feature_requests
    ORDER BY updated_at DESC
    LIMIT 10
  ) AS feature;
$$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_feature_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_feature_summary() TO service_role;
