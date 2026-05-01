-- FB-010: support aggregate rejected filtering in the submissions admin page

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

  IF v_sort_column NOT IN ('submitted_at', 'name', 'email', 'result', 'source') THEN
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
    WHERE (
        v_result_filter IS NULL
        OR (v_result_filter = 'rejected' AND fs.result <> 'accepted')
        OR fs.result = v_result_filter
      )
      AND (p_date_from IS NULL OR fs.submitted_at >= p_date_from)
      AND (p_date_to IS NULL OR fs.submitted_at <= p_date_to)
      AND (
        v_search IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_each_text(COALESCE(fs.data, '{}'::jsonb)) AS search_entry(key, value)
          WHERE search_entry.key !~ '^_'
            AND search_entry.value ILIKE '%' || v_search || '%'
        )
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
    WHERE (
        v_result_filter IS NULL
        OR (v_result_filter = 'rejected' AND fs.result <> 'accepted')
        OR fs.result = v_result_filter
      )
      AND (p_date_from IS NULL OR fs.submitted_at >= p_date_from)
      AND (p_date_to IS NULL OR fs.submitted_at <= p_date_to)
      AND (
        v_search IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_each_text(COALESCE(fs.data, '{}'::jsonb)) AS search_entry(key, value)
          WHERE search_entry.key !~ '^_'
            AND search_entry.value ILIKE '%' || v_search || '%'
        )
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
      CASE
        WHEN v_sort_column = 'submitted_at' AND v_sort_direction = 'asc'
        THEN fs.submitted_at
      END ASC NULLS LAST,
      CASE
        WHEN v_sort_column = 'submitted_at' AND v_sort_direction = 'desc'
        THEN fs.submitted_at
      END DESC NULLS LAST,
      CASE
        WHEN v_sort_column = 'email' AND v_sort_direction = 'asc'
        THEN LOWER(COALESCE(NULLIF(fs.data->>'email', ''), NULLIF(fs.data->>'Email', ''), ''))
      END ASC NULLS LAST,
      CASE
        WHEN v_sort_column = 'email' AND v_sort_direction = 'desc'
        THEN LOWER(COALESCE(NULLIF(fs.data->>'email', ''), NULLIF(fs.data->>'Email', ''), ''))
      END DESC NULLS LAST,
      CASE
        WHEN v_sort_column = 'result' AND v_sort_direction = 'asc'
        THEN LOWER(COALESCE(fs.result, ''))
      END ASC NULLS LAST,
      CASE
        WHEN v_sort_column = 'result' AND v_sort_direction = 'desc'
        THEN LOWER(COALESCE(fs.result, ''))
      END DESC NULLS LAST,
      CASE
        WHEN v_sort_column = 'name' AND v_sort_direction = 'asc'
        THEN LOWER(
          COALESCE(
            NULLIF(fs.data->>'full_name', ''),
            NULLIF(fs.data->>'name', ''),
            NULLIF(CONCAT_WS(' ', NULLIF(fs.data->>'first_name', ''), NULLIF(fs.data->>'last_name', '')), ''),
            ''
          )
        )
      END ASC NULLS LAST,
      CASE
        WHEN v_sort_column = 'name' AND v_sort_direction = 'desc'
        THEN LOWER(
          COALESCE(
            NULLIF(fs.data->>'full_name', ''),
            NULLIF(fs.data->>'name', ''),
            NULLIF(CONCAT_WS(' ', NULLIF(fs.data->>'first_name', ''), NULLIF(fs.data->>'last_name', '')), ''),
            ''
          )
        )
      END DESC NULLS LAST,
      CASE
        WHEN v_sort_column = 'source' AND v_sort_direction = 'asc'
        THEN LOWER(
          COALESCE(
            NULLIF(fs.metadata->>'utm_source', ''),
            NULLIF(fs.metadata->>'referrer', ''),
            NULLIF(fs.metadata->>'page_url', ''),
            'direct'
          )
        )
      END ASC NULLS LAST,
      CASE
        WHEN v_sort_column = 'source' AND v_sort_direction = 'desc'
        THEN LOWER(
          COALESCE(
            NULLIF(fs.metadata->>'utm_source', ''),
            NULLIF(fs.metadata->>'referrer', ''),
            NULLIF(fs.metadata->>'page_url', ''),
            'direct'
          )
        )
      END DESC NULLS LAST,
      fs.submitted_at DESC
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