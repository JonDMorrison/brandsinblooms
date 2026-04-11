-- FB-010: analytics dashboard contract expansion

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
  v_requested_days INTEGER := COALESCE(p_days, 30);
  v_is_all_time BOOLEAN := COALESCE(p_days, 30) <= 0;
  v_days INTEGER := GREATEST(COALESCE(p_days, 30), 1);
  v_current_start TIMESTAMPTZ := CASE
    WHEN COALESCE(p_days, 30) <= 0 THEN NULL
    ELSE now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1))
  END;
  v_previous_start TIMESTAMPTZ := CASE
    WHEN COALESCE(p_days, 30) <= 0 THEN NULL
    ELSE now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1) * 2)
  END;
  v_previous_end TIMESTAMPTZ := CASE
    WHEN COALESCE(p_days, 30) <= 0 THEN NULL
    ELSE now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1))
  END;
  v_result JSONB;
BEGIN
  WITH form_fields AS MATERIALIZED (
    SELECT
      COALESCE(NULLIF(field.value->>'id', ''), 'field_' || field.ordinality::TEXT) AS field_id,
      COALESCE(
        NULLIF(field.value->>'mapping_key', ''),
        NULLIF(field.value->>'id', ''),
        'field_' || field.ordinality::TEXT
      ) AS field_key,
      COALESCE(
        NULLIF(field.value->>'label', ''),
        INITCAP(
          REPLACE(
            COALESCE(
              NULLIF(field.value->>'mapping_key', ''),
              NULLIF(field.value->>'id', ''),
              'field_' || field.ordinality::TEXT
            ),
            '_',
            ' '
          )
        )
      ) AS label,
      COALESCE(NULLIF(field.value->>'type', ''), 'text') AS field_type,
      COALESCE((field.value->>'required')::BOOLEAN, FALSE) AS required,
      field.ordinality::INTEGER AS field_order
    FROM public.forms f
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(f.fields_json, '[]'::JSONB)
    ) WITH ORDINALITY AS field(value, ordinality)
    WHERE f.tenant_id = p_tenant_id
      AND f.id = p_form_id
      AND COALESCE(NULLIF(field.value->>'type', ''), 'text') <> 'hidden'
  ),
  source AS MATERIALIZED (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND (v_is_all_time OR fs.submitted_at >= v_current_start)
  ),
  previous_source AS MATERIALIZED (
    SELECT fs.*
    FROM public.form_submissions fs
    WHERE fs.tenant_id = p_tenant_id
      AND fs.form_id = p_form_id
      AND NOT v_is_all_time
      AND fs.submitted_at >= v_previous_start
      AND fs.submitted_at < v_previous_end
  ),
  current_summary AS MATERIALIZED (
    SELECT
      COUNT(*)::BIGINT AS total_submissions,
      COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT AS accepted_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_invalid')::BIGINT AS invalid_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_rate_limited')::BIGINT AS rate_limited_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_spam')::BIGINT AS spam_submissions,
      COUNT(*) FILTER (WHERE result <> 'accepted')::BIGINT AS rejected_submissions,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (
            COUNT(*) FILTER (WHERE result = 'accepted')::NUMERIC
            / COUNT(*)::NUMERIC
            * 100
          )
        END,
        1
      ) AS acceptance_rate,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (
            COUNT(*) FILTER (WHERE result <> 'accepted')::NUMERIC
            / COUNT(*)::NUMERIC
            * 100
          )
        END,
        1
      ) AS rejection_rate,
      MAX(submitted_at) AS last_submission_at
    FROM source
  ),
  previous_summary AS MATERIALIZED (
    SELECT
      COUNT(*)::BIGINT AS total_submissions,
      COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT AS accepted_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_invalid')::BIGINT AS invalid_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_rate_limited')::BIGINT AS rate_limited_submissions,
      COUNT(*) FILTER (WHERE result = 'rejected_spam')::BIGINT AS spam_submissions,
      COUNT(*) FILTER (WHERE result <> 'accepted')::BIGINT AS rejected_submissions,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (
            COUNT(*) FILTER (WHERE result = 'accepted')::NUMERIC
            / COUNT(*)::NUMERIC
            * 100
          )
        END,
        1
      ) AS acceptance_rate,
      ROUND(
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (
            COUNT(*) FILTER (WHERE result <> 'accepted')::NUMERIC
            / COUNT(*)::NUMERIC
            * 100
          )
        END,
        1
      ) AS rejection_rate
    FROM previous_source
  ),
  date_series AS (
    SELECT generated.day::DATE AS day
    FROM generate_series(
      CASE
        WHEN v_is_all_time THEN (
          SELECT MIN(date_trunc('day', submitted_at))
          FROM source
        )
        ELSE date_trunc('day', v_current_start)
      END,
      CASE
        WHEN v_is_all_time THEN (
          SELECT MAX(date_trunc('day', submitted_at))
          FROM source
        )
        ELSE date_trunc('day', now())
      END,
      interval '1 day'
    ) AS generated(day)
    WHERE NOT v_is_all_time OR EXISTS (SELECT 1 FROM source)
  ),
  daily_counts AS (
    SELECT
      date_trunc('day', submitted_at)::DATE AS day,
      COUNT(*)::BIGINT AS total,
      COUNT(*) FILTER (WHERE result = 'accepted')::BIGINT AS accepted,
      COUNT(*) FILTER (WHERE result <> 'accepted')::BIGINT AS rejected
    FROM source
    GROUP BY 1
  ),
  daily AS (
    SELECT
      ds.day,
      COALESCE(dc.total, 0) AS total,
      COALESCE(dc.accepted, 0) AS accepted,
      COALESCE(dc.rejected, 0) AS rejected
    FROM date_series ds
    LEFT JOIN daily_counts dc ON dc.day = ds.day
    ORDER BY ds.day
  ),
  rejection_counts AS (
    SELECT
      key,
      label,
      count,
      ROUND(
        CASE
          WHEN cs.rejected_submissions = 0 THEN 0
          ELSE count::NUMERIC / cs.rejected_submissions::NUMERIC * 100
        END,
        1
      ) AS percentage
    FROM current_summary cs
    CROSS JOIN LATERAL (
      VALUES
        ('invalid'::TEXT, 'Invalid'::TEXT, cs.invalid_submissions),
        ('rate_limited'::TEXT, 'Rate Limited'::TEXT, cs.rate_limited_submissions),
        ('spam'::TEXT, 'Spam'::TEXT, cs.spam_submissions)
    ) AS slices(key, label, count)
  ),
  referrer_counts AS (
    SELECT
      CASE
        WHEN source_label = 'Direct' THEN 'Direct'
        WHEN source_label ~* '^[a-z][a-z0-9+.-]*://' THEN LOWER(
          regexp_replace(source_label, '^[a-z][a-z0-9+.-]*://([^/?#]+).*$','\1')
        )
        ELSE source_label
      END AS display_domain,
      source_label,
      COUNT(*)::BIGINT AS count
    FROM (
      SELECT
        COALESCE(
          NULLIF(metadata->>'utm_source', ''),
          NULLIF(metadata->>'referrer', ''),
          NULLIF(metadata->>'page_url', ''),
          'Direct'
        ) AS source_label
      FROM source
    ) ranked_sources
    GROUP BY 1, 2
  ),
  top_referrers AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY rc.count DESC, rc.display_domain ASC, rc.source_label ASC
      )::INTEGER AS rank,
      rc.display_domain,
      rc.source_label,
      rc.count,
      ROUND(
        CASE
          WHEN cs.total_submissions = 0 THEN 0
          ELSE rc.count::NUMERIC / cs.total_submissions::NUMERIC * 100
        END,
        1
      ) AS share_percentage,
      ROUND(
        CASE
          WHEN MAX(rc.count) OVER () = 0 THEN 0
          ELSE rc.count::NUMERIC / MAX(rc.count) OVER ()::NUMERIC * 100
        END,
        1
      ) AS bar_percentage
    FROM referrer_counts rc
    CROSS JOIN current_summary cs
    ORDER BY rc.count DESC, rc.display_domain ASC, rc.source_label ASC
    LIMIT 10
  ),
  field_fill_rates AS (
    SELECT
      ff.field_id,
      ff.field_key,
      ff.label,
      ff.field_type,
      ff.field_order,
      ff.required,
      COALESCE(fill_counts.filled_count, 0) AS filled_count,
      cs.total_submissions,
      ROUND(
        CASE
          WHEN cs.total_submissions = 0 THEN 0
          ELSE COALESCE(fill_counts.filled_count, 0)::NUMERIC
            / cs.total_submissions::NUMERIC
            * 100
        END,
        1
      ) AS fill_rate
    FROM form_fields ff
    CROSS JOIN current_summary cs
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::BIGINT AS filled_count
      FROM source s
      WHERE CASE
        WHEN ff.field_type IN ('checkbox', 'email_consent', 'sms_consent') THEN
          (s.data ? ff.field_key)
          OR (ff.field_id <> ff.field_key AND s.data ? ff.field_id)
        ELSE
          (
            (s.data ? ff.field_key AND NULLIF(BTRIM(COALESCE(s.data->>ff.field_key, '')), '') IS NOT NULL)
            OR (
              ff.field_id <> ff.field_key
              AND s.data ? ff.field_id
              AND NULLIF(BTRIM(COALESCE(s.data->>ff.field_id, '')), '') IS NOT NULL
            )
          )
      END
    ) AS fill_counts ON TRUE
    ORDER BY ff.field_order
  ),
  summary_payload AS (
    SELECT jsonb_build_object(
      'current', jsonb_build_object(
        'total_submissions', cs.total_submissions,
        'accepted_submissions', cs.accepted_submissions,
        'rejected_submissions', cs.rejected_submissions,
        'invalid_submissions', cs.invalid_submissions,
        'rate_limited_submissions', cs.rate_limited_submissions,
        'spam_submissions', cs.spam_submissions,
        'acceptance_rate', cs.acceptance_rate,
        'rejection_rate', cs.rejection_rate
      ),
      'previous', CASE
        WHEN v_is_all_time THEN NULL
        ELSE jsonb_build_object(
          'total_submissions', ps.total_submissions,
          'accepted_submissions', ps.accepted_submissions,
          'rejected_submissions', ps.rejected_submissions,
          'invalid_submissions', ps.invalid_submissions,
          'rate_limited_submissions', ps.rate_limited_submissions,
          'spam_submissions', ps.spam_submissions,
          'acceptance_rate', ps.acceptance_rate,
          'rejection_rate', ps.rejection_rate
        )
      END,
      'metrics', jsonb_build_object(
        'total_submissions', jsonb_build_object(
          'value', cs.total_submissions,
          'previous_value', CASE WHEN v_is_all_time THEN NULL ELSE ps.total_submissions END,
          'trend', jsonb_build_object(
            'has_trend', NOT v_is_all_time,
            'direction', CASE
              WHEN v_is_all_time THEN 'none'
              WHEN cs.total_submissions > ps.total_submissions THEN 'up'
              WHEN cs.total_submissions < ps.total_submissions THEN 'down'
              ELSE 'flat'
            END,
            'sentiment', CASE
              WHEN v_is_all_time THEN 'neutral'
              WHEN cs.total_submissions > ps.total_submissions THEN 'positive'
              WHEN cs.total_submissions < ps.total_submissions THEN 'negative'
              ELSE 'neutral'
            END,
            'change_percentage', CASE
              WHEN v_is_all_time THEN NULL
              WHEN ps.total_submissions = 0 THEN CASE
                WHEN cs.total_submissions > 0 THEN 100
                ELSE 0
              END
              ELSE ROUND(
                (
                  (cs.total_submissions - ps.total_submissions)::NUMERIC
                  / ps.total_submissions::NUMERIC
                ) * 100,
                1
              )
            END,
            'delta_value', CASE
              WHEN v_is_all_time THEN NULL
              ELSE cs.total_submissions - ps.total_submissions
            END
          )
        ),
        'accepted_submissions', jsonb_build_object(
          'value', cs.accepted_submissions,
          'previous_value', CASE WHEN v_is_all_time THEN NULL ELSE ps.accepted_submissions END,
          'trend', jsonb_build_object(
            'has_trend', NOT v_is_all_time,
            'direction', CASE
              WHEN v_is_all_time THEN 'none'
              WHEN cs.accepted_submissions > ps.accepted_submissions THEN 'up'
              WHEN cs.accepted_submissions < ps.accepted_submissions THEN 'down'
              ELSE 'flat'
            END,
            'sentiment', CASE
              WHEN v_is_all_time THEN 'neutral'
              WHEN cs.accepted_submissions > ps.accepted_submissions THEN 'positive'
              WHEN cs.accepted_submissions < ps.accepted_submissions THEN 'negative'
              ELSE 'neutral'
            END,
            'change_percentage', CASE
              WHEN v_is_all_time THEN NULL
              WHEN ps.accepted_submissions = 0 THEN CASE
                WHEN cs.accepted_submissions > 0 THEN 100
                ELSE 0
              END
              ELSE ROUND(
                (
                  (cs.accepted_submissions - ps.accepted_submissions)::NUMERIC
                  / ps.accepted_submissions::NUMERIC
                ) * 100,
                1
              )
            END,
            'delta_value', CASE
              WHEN v_is_all_time THEN NULL
              ELSE cs.accepted_submissions - ps.accepted_submissions
            END
          )
        ),
        'rejected_submissions', jsonb_build_object(
          'value', cs.rejected_submissions,
          'previous_value', CASE WHEN v_is_all_time THEN NULL ELSE ps.rejected_submissions END,
          'trend', jsonb_build_object(
            'has_trend', NOT v_is_all_time,
            'direction', CASE
              WHEN v_is_all_time THEN 'none'
              WHEN cs.rejected_submissions > ps.rejected_submissions THEN 'up'
              WHEN cs.rejected_submissions < ps.rejected_submissions THEN 'down'
              ELSE 'flat'
            END,
            'sentiment', CASE
              WHEN v_is_all_time THEN 'neutral'
              WHEN cs.rejected_submissions > ps.rejected_submissions THEN 'negative'
              WHEN cs.rejected_submissions < ps.rejected_submissions THEN 'positive'
              ELSE 'neutral'
            END,
            'change_percentage', CASE
              WHEN v_is_all_time THEN NULL
              WHEN ps.rejected_submissions = 0 THEN CASE
                WHEN cs.rejected_submissions > 0 THEN 100
                ELSE 0
              END
              ELSE ROUND(
                (
                  (cs.rejected_submissions - ps.rejected_submissions)::NUMERIC
                  / ps.rejected_submissions::NUMERIC
                ) * 100,
                1
              )
            END,
            'delta_value', CASE
              WHEN v_is_all_time THEN NULL
              ELSE cs.rejected_submissions - ps.rejected_submissions
            END
          )
        ),
        'conversion_rate', jsonb_build_object(
          'value', NULL,
          'previous_value', NULL,
          'trend', jsonb_build_object(
            'has_trend', FALSE,
            'direction', 'none',
            'sentiment', 'neutral',
            'change_percentage', NULL,
            'delta_value', NULL
          )
        )
      )
    ) AS payload
    FROM current_summary cs
    CROSS JOIN previous_summary ps
  ),
  rejection_payload AS (
    SELECT jsonb_build_object(
      'total_rejections', cs.rejected_submissions,
      'slices', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'key', rc.key,
              'label', rc.label,
              'count', rc.count,
              'percentage', rc.percentage
            )
            ORDER BY rc.count DESC, rc.label ASC
          )
          FROM rejection_counts rc
        ),
        '[]'::JSONB
      )
    ) AS payload
    FROM current_summary cs
  ),
  conversion_payload AS (
    SELECT jsonb_build_object(
      'available', FALSE,
      'views', NULL,
      'accepted', cs.accepted_submissions,
      'rate', NULL,
      'previous_rate', NULL,
      'note', 'Enable form view tracking for conversion analytics.',
      'trend', jsonb_build_object(
        'has_trend', FALSE,
        'direction', 'none',
        'sentiment', 'neutral',
        'change_percentage', NULL,
        'delta_value', NULL
      )
    ) AS payload
    FROM current_summary cs
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object(
      'days', CASE WHEN v_is_all_time THEN 0 ELSE v_requested_days END,
      'is_all_time', v_is_all_time,
      'comparison_label', CASE
        WHEN v_is_all_time THEN NULL
        ELSE 'vs previous equivalent period'
      END
    ),
    'summary', sp.payload,
    'daily', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'day', d.day,
            'total', d.total,
            'accepted', d.accepted,
            'rejected', d.rejected
          )
          ORDER BY d.day
        )
        FROM daily d
      ),
      '[]'::JSONB
    ),
    'rejection_breakdown', rp.payload,
    'top_referrers', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'rank', tr.rank,
            'display_domain', tr.display_domain,
            'source_label', tr.source_label,
            'count', tr.count,
            'share_percentage', tr.share_percentage,
            'bar_percentage', tr.bar_percentage
          )
          ORDER BY tr.rank
        )
        FROM top_referrers tr
      ),
      '[]'::JSONB
    ),
    'field_fill_rates', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'field_id', ffr.field_id,
            'field_key', ffr.field_key,
            'label', ffr.label,
            'field_type', ffr.field_type,
            'field_order', ffr.field_order,
            'required', ffr.required,
            'filled_count', ffr.filled_count,
            'total_submissions', ffr.total_submissions,
            'fill_rate', ffr.fill_rate
          )
          ORDER BY ffr.field_order
        )
        FROM field_fill_rates ffr
      ),
      '[]'::JSONB
    ),
    'conversion', cp.payload,
    'last_submission_at', cs.last_submission_at
  )
  INTO v_result
  FROM current_summary cs
  CROSS JOIN summary_payload sp
  CROSS JOIN rejection_payload rp
  CROSS JOIN conversion_payload cp;

  RETURN COALESCE(
    v_result,
    jsonb_build_object(
      'range', jsonb_build_object(
        'days', CASE WHEN v_is_all_time THEN 0 ELSE v_requested_days END,
        'is_all_time', v_is_all_time,
        'comparison_label', CASE
          WHEN v_is_all_time THEN NULL
          ELSE 'vs previous equivalent period'
        END
      ),
      'summary', jsonb_build_object(
        'current', jsonb_build_object(
          'total_submissions', 0,
          'accepted_submissions', 0,
          'rejected_submissions', 0,
          'invalid_submissions', 0,
          'rate_limited_submissions', 0,
          'spam_submissions', 0,
          'acceptance_rate', 0,
          'rejection_rate', 0
        ),
        'previous', NULL,
        'metrics', jsonb_build_object(
          'total_submissions', jsonb_build_object(
            'value', 0,
            'previous_value', NULL,
            'trend', jsonb_build_object(
              'has_trend', FALSE,
              'direction', 'none',
              'sentiment', 'neutral',
              'change_percentage', NULL,
              'delta_value', NULL
            )
          ),
          'accepted_submissions', jsonb_build_object(
            'value', 0,
            'previous_value', NULL,
            'trend', jsonb_build_object(
              'has_trend', FALSE,
              'direction', 'none',
              'sentiment', 'neutral',
              'change_percentage', NULL,
              'delta_value', NULL
            )
          ),
          'rejected_submissions', jsonb_build_object(
            'value', 0,
            'previous_value', NULL,
            'trend', jsonb_build_object(
              'has_trend', FALSE,
              'direction', 'none',
              'sentiment', 'neutral',
              'change_percentage', NULL,
              'delta_value', NULL
            )
          ),
          'conversion_rate', jsonb_build_object(
            'value', NULL,
            'previous_value', NULL,
            'trend', jsonb_build_object(
              'has_trend', FALSE,
              'direction', 'none',
              'sentiment', 'neutral',
              'change_percentage', NULL,
              'delta_value', NULL
            )
          )
        )
      ),
      'daily', '[]'::JSONB,
      'rejection_breakdown', jsonb_build_object(
        'total_rejections', 0,
        'slices', '[]'::JSONB
      ),
      'top_referrers', '[]'::JSONB,
      'field_fill_rates', '[]'::JSONB,
      'conversion', jsonb_build_object(
        'available', FALSE,
        'views', NULL,
        'accepted', 0,
        'rate', NULL,
        'previous_rate', NULL,
        'note', 'Enable form view tracking for conversion analytics.',
        'trend', jsonb_build_object(
          'has_trend', FALSE,
          'direction', 'none',
          'sentiment', 'neutral',
          'change_percentage', NULL,
          'delta_value', NULL
        )
      ),
      'last_submission_at', NULL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_form_analytics(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_form_analytics(UUID, UUID, INTEGER) TO service_role;