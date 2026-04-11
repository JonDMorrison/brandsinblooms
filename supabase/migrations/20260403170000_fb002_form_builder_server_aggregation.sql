-- FB-002: Form Builder server-side aggregation, pagination, and N+1 elimination

CREATE OR REPLACE FUNCTION public.get_forms_with_stats(
  p_tenant_id UUID,
  p_stats_days INTEGER DEFAULT 7
) RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  name TEXT,
  status TEXT,
  embed_key TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  fields_json JSONB,
  settings_json JSONB,
  compliance_json JSONB,
  audience_json JSONB,
  total_submissions BIGINT,
  recent_submissions BIGINT,
  recent_accepted BIGINT,
  recent_rejected BIGINT,
  last_submission_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats_days INTEGER := GREATEST(COALESCE(p_stats_days, 7), 1);
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.tenant_id,
    f.name,
    f.status,
    f.embed_key,
    f.created_at,
    f.updated_at,
    f.fields_json,
    f.settings_json,
    f.compliance_json,
    f.audience_json,
    COALESCE(s.total_submissions, 0) AS total_submissions,
    COALESCE(s.recent_submissions, 0) AS recent_submissions,
    COALESCE(s.recent_accepted, 0) AS recent_accepted,
    COALESCE(s.recent_rejected, 0) AS recent_rejected,
    s.last_submission_at
  FROM public.forms f
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::BIGINT AS total_submissions,
      COUNT(*) FILTER (
        WHERE fs.submitted_at >= now() - make_interval(days => v_stats_days)
      )::BIGINT AS recent_submissions,
      COUNT(*) FILTER (
        WHERE fs.submitted_at >= now() - make_interval(days => v_stats_days)
          AND fs.result = 'accepted'
      )::BIGINT AS recent_accepted,
      COUNT(*) FILTER (
        WHERE fs.submitted_at >= now() - make_interval(days => v_stats_days)
          AND fs.result <> 'accepted'
      )::BIGINT AS recent_rejected,
      MAX(fs.submitted_at) AS last_submission_at
    FROM public.form_submissions fs
    WHERE fs.form_id = f.id
      AND fs.tenant_id = f.tenant_id
  ) s ON TRUE
  WHERE f.tenant_id = p_tenant_id
  ORDER BY f.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forms_with_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forms_with_stats(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.get_form_submissions_page(
  p_tenant_id UUID,
  p_form_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25,
  p_result_filter TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_column TEXT DEFAULT 'submitted_at',
  p_sort_direction TEXT DEFAULT 'desc',
  p_hide_test BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 500);
  v_offset INTEGER;
  v_result_filter TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_result_filter), ''), 'all'));
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_sort_column TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_column), ''), 'submitted_at'));
  v_sort_direction TEXT := LOWER(COALESCE(NULLIF(BTRIM(p_sort_direction), ''), 'desc'));
  v_rows JSONB;
  v_summary JSONB;
  v_filtered_total BIGINT := 0;
  v_unfiltered_total BIGINT := 0;
  v_total_pages INTEGER := 0;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  IF v_result_filter = 'all' THEN
    v_result_filter := NULL;
  END IF;

  IF v_sort_column <> 'submitted_at' THEN
    v_sort_column := 'submitted_at';
  END IF;

  IF v_sort_direction NOT IN ('asc', 'desc') THEN
    v_sort_direction := 'desc';
  END IF;

  WITH base AS (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND (
        NOT COALESCE(p_hide_test, TRUE)
        OR COALESCE(fs.metadata->>'is_test', 'false') <> 'true'
      )
  )
  SELECT COUNT(*)::BIGINT
  INTO v_unfiltered_total
  FROM base;

  WITH base AS (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND (
        NOT COALESCE(p_hide_test, TRUE)
        OR COALESCE(fs.metadata->>'is_test', 'false') <> 'true'
      )
  ),
  filtered AS (
    SELECT fs.*
    FROM base fs
    WHERE (v_result_filter IS NULL OR fs.result = v_result_filter)
      AND (p_date_from IS NULL OR fs.submitted_at >= p_date_from)
      AND (p_date_to IS NULL OR fs.submitted_at <= p_date_to)
      AND (
        v_search IS NULL
        OR COALESCE(fs.data->>'email', fs.data->>'Email', '') ILIKE '%' || v_search || '%'
      )
  )
  SELECT COUNT(*)::BIGINT
  INTO v_filtered_total
  FROM filtered;

  v_total_pages := CASE
    WHEN v_filtered_total = 0 THEN 0
    ELSE CEIL(v_filtered_total::NUMERIC / v_page_size)::INTEGER
  END;

  WITH base AS (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND (
        NOT COALESCE(p_hide_test, TRUE)
        OR COALESCE(fs.metadata->>'is_test', 'false') <> 'true'
      )
  )
  SELECT jsonb_build_object(
    'total', COUNT(*)::BIGINT,
    'accepted', COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT,
    'rejected', COUNT(*) FILTER (WHERE result <> 'accepted')::BIGINT,
    'accept_rate', CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE result = 'accepted'))::NUMERIC
        / COUNT(*)::NUMERIC
        * 100
      )::INTEGER
    END,
    'last_7_days', COUNT(*) FILTER (
      WHERE submitted_at >= now() - interval '7 days'
    )::BIGINT,
    'previous_7_days', COUNT(*) FILTER (
      WHERE submitted_at >= now() - interval '14 days'
        AND submitted_at < now() - interval '7 days'
    )::BIGINT,
    'trend', CASE
      WHEN COUNT(*) FILTER (
        WHERE submitted_at >= now() - interval '14 days'
          AND submitted_at < now() - interval '7 days'
      ) = 0 THEN CASE
        WHEN COUNT(*) FILTER (
          WHERE submitted_at >= now() - interval '7 days'
        ) > 0 THEN 100
        ELSE 0
      END
      ELSE ROUND((
        (
          COUNT(*) FILTER (
            WHERE submitted_at >= now() - interval '7 days'
          )
          -
          COUNT(*) FILTER (
            WHERE submitted_at >= now() - interval '14 days'
              AND submitted_at < now() - interval '7 days'
          )
        )::NUMERIC
        /
        (COUNT(*) FILTER (
          WHERE submitted_at >= now() - interval '14 days'
            AND submitted_at < now() - interval '7 days'
        ))::NUMERIC
      ) * 100)::INTEGER
    END,
    'rejection_breakdown', jsonb_build_object(
      'invalid', COUNT(*) FILTER (WHERE result = 'rejected_invalid')::BIGINT,
      'rate_limited', COUNT(*) FILTER (WHERE result = 'rejected_rate_limited')::BIGINT,
      'spam', COUNT(*) FILTER (WHERE result = 'rejected_spam')::BIGINT
    )
  )
  INTO v_summary
  FROM base;

  WITH base AS (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND (
        NOT COALESCE(p_hide_test, TRUE)
        OR COALESCE(fs.metadata->>'is_test', 'false') <> 'true'
      )
  ),
  filtered AS (
    SELECT fs.*
    FROM base fs
    WHERE (v_result_filter IS NULL OR fs.result = v_result_filter)
      AND (p_date_from IS NULL OR fs.submitted_at >= p_date_from)
      AND (p_date_to IS NULL OR fs.submitted_at <= p_date_to)
      AND (
        v_search IS NULL
        OR COALESCE(fs.data->>'email', fs.data->>'Email', '') ILIKE '%' || v_search || '%'
      )
  )
  SELECT jsonb_agg(row_to_json(sub))
  INTO v_rows
  FROM (
    SELECT
      fs.id,
      fs.tenant_id,
      fs.form_id,
      fs.customer_id,
      fs.data,
      fs.metadata,
      fs.ip_hash,
      fs.result,
      fs.reason,
      fs.submitted_at
    FROM filtered fs
    ORDER BY
      CASE WHEN v_sort_direction = 'asc' THEN fs.submitted_at END ASC,
      CASE WHEN v_sort_direction = 'desc' THEN fs.submitted_at END DESC
    LIMIT v_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'summary', COALESCE(v_summary, jsonb_build_object(
      'total', 0,
      'accepted', 0,
      'rejected', 0,
      'accept_rate', 0,
      'last_7_days', 0,
      'previous_7_days', 0,
      'trend', 0,
      'rejection_breakdown', jsonb_build_object(
        'invalid', 0,
        'rate_limited', 0,
        'spam', 0
      )
    )),
    'filtered_total', v_filtered_total,
    'unfiltered_total', v_unfiltered_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', v_total_pages
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_submissions_page(UUID, UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_form_submissions_page(UUID, UUID, INTEGER, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.get_form_analytics(
  p_tenant_id UUID,
  p_form_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER := GREATEST(COALESCE(p_days, 30), 1);
  v_result JSONB;
BEGIN
  WITH source AS (
    SELECT *
    FROM public.form_submissions
    WHERE tenant_id = p_tenant_id
      AND form_id = p_form_id
      AND submitted_at >= now() - make_interval(days => v_days)
  ),
  daily AS (
    SELECT
      DATE(submitted_at) AS day,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT AS accepted,
      COUNT(*) FILTER (WHERE result <> 'accepted')::BIGINT AS rejected
    FROM source
    GROUP BY DATE(submitted_at)
    ORDER BY day
  ),
  referrers AS (
    SELECT
      COALESCE(
        NULLIF(metadata->>'referrer', ''),
        NULLIF(metadata->>'page_url', ''),
        'Direct'
      ) AS referrer,
      COUNT(*)::BIGINT AS count
    FROM source
    GROUP BY 1
    ORDER BY count DESC, referrer ASC
    LIMIT 10
  ),
  totals AS (
    SELECT
      COUNT(*)::BIGINT AS total_submissions,
      COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT AS total_accepted,
      COUNT(*) FILTER (WHERE result = 'rejected_invalid')::BIGINT AS total_invalid,
      COUNT(*) FILTER (WHERE result = 'rejected_rate_limited')::BIGINT AS total_rate_limited,
      COUNT(*) FILTER (WHERE result = 'rejected_spam')::BIGINT AS total_spam,
      MAX(submitted_at) AS last_submission_at
    FROM source
  )
  SELECT jsonb_build_object(
    'daily', COALESCE((SELECT jsonb_agg(row_to_json(d)) FROM daily d), '[]'::jsonb),
    'top_referrers', COALESCE((SELECT jsonb_agg(row_to_json(r)) FROM referrers r), '[]'::jsonb),
    'totals', (SELECT row_to_json(t) FROM totals t),
    'last_submission_at', (SELECT last_submission_at FROM totals)
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'daily', '[]'::jsonb,
    'top_referrers', '[]'::jsonb,
    'totals', jsonb_build_object(
      'total_submissions', 0,
      'total_accepted', 0,
      'total_invalid', 0,
      'total_rate_limited', 0,
      'total_spam', 0,
      'last_submission_at', null
    ),
    'last_submission_at', null
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_analytics(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_form_analytics(UUID, UUID, INTEGER) TO service_role;