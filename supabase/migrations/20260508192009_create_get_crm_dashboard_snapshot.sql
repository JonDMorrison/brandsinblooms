DROP FUNCTION IF EXISTS public.get_crm_dashboard_snapshot(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_crm_dashboard_snapshot(
	p_tenant_id UUID DEFAULT NULL,
	p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
	v_actor_user_id UUID;
	v_actor_tenant_id UUID;
	v_result JSON;
BEGIN
	v_actor_user_id := auth.uid();

	IF v_actor_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication required'
			USING ERRCODE = '28000';
	END IF;

	IF p_tenant_id IS NULL AND p_user_id IS NULL THEN
		RAISE EXCEPTION 'A tenant or user scope is required'
			USING ERRCODE = '22023';
	END IF;

	IF p_tenant_id IS NOT NULL THEN
		SELECT u.tenant_id
		INTO v_actor_tenant_id
		FROM public.users u
		WHERE u.id = v_actor_user_id;

		IF v_actor_tenant_id IS DISTINCT FROM p_tenant_id THEN
			RAISE EXCEPTION 'Not authorized for tenant dashboard stats'
				USING ERRCODE = '42501';
		END IF;
	ELSIF p_user_id IS DISTINCT FROM v_actor_user_id THEN
		RAISE EXCEPTION 'Not authorized for user dashboard stats'
			USING ERRCODE = '42501';
	END IF;

	WITH bounds AS (
		SELECT
			date_trunc('month', NOW()) AS current_month_start,
			date_trunc('month', NOW()) - INTERVAL '1 month' AS previous_month_start
	),
	scoped_customers AS (
		SELECT
			c.id,
			c.created_at,
			c.deleted_at,
			c.last_purchase_date,
			c.order_history,
			c.persona,
			c.persona_id,
			c.tags,
			c.total_spent,
			c.user_id,
			c.tenant_id
		FROM public.crm_customers c
		WHERE (
			p_tenant_id IS NOT NULL
			AND c.tenant_id = p_tenant_id
		)
		OR (
			p_tenant_id IS NULL
			AND p_user_id IS NOT NULL
			AND c.user_id = p_user_id
		)
	),
	scoped_persona_customers AS (
		SELECT *
		FROM scoped_customers
		WHERE deleted_at IS NULL
	),
	customer_summary AS (
		SELECT
			COUNT(*)::BIGINT AS total_customers,
			COUNT(*) FILTER (
				WHERE created_at >= NOW() - INTERVAL '30 days'
			)::BIGINT AS recent_customers_30d,
			COALESCE(SUM(COALESCE(total_spent, 0)), 0)::NUMERIC AS total_customer_revenue,
			COUNT(*) FILTER (
				WHERE created_at >= bounds.current_month_start
			)::BIGINT AS current_month_customers,
			COUNT(*) FILTER (
				WHERE created_at >= bounds.previous_month_start
					AND created_at < bounds.current_month_start
			)::BIGINT AS previous_month_customers,
			COALESCE(
				SUM(COALESCE(total_spent, 0)) FILTER (
					WHERE created_at >= bounds.current_month_start
				),
				0
			)::NUMERIC AS current_month_customer_revenue,
			COALESCE(
				SUM(COALESCE(total_spent, 0)) FILTER (
					WHERE created_at >= bounds.previous_month_start
						AND created_at < bounds.current_month_start
				),
				0
			)::NUMERIC AS previous_month_customer_revenue
		FROM scoped_customers
		CROSS JOIN bounds
	),
	campaign_base AS (
		SELECT
			c.id,
			c.click_rate,
			c.created_at,
			c.open_rate,
			c.status,
			COALESCE(
				CASE
					WHEN jsonb_typeof(c.metrics -> 'sent') = 'number' THEN (c.metrics ->> 'sent')::NUMERIC
					WHEN jsonb_typeof(c.metrics -> 'sent') = 'string'
						AND BTRIM(c.metrics ->> 'sent') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN BTRIM(c.metrics ->> 'sent')::NUMERIC
					ELSE NULL
				END,
				c.total_sent::NUMERIC,
				c.messages_sent::NUMERIC,
				0
			) AS sent_count,
			COALESCE(
				CASE
					WHEN jsonb_typeof(c.metrics -> 'opened') = 'number' THEN (c.metrics ->> 'opened')::NUMERIC
					WHEN jsonb_typeof(c.metrics -> 'opened') = 'string'
						AND BTRIM(c.metrics ->> 'opened') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN BTRIM(c.metrics ->> 'opened')::NUMERIC
					ELSE NULL
				END,
				c.total_opens::NUMERIC,
				0
			) AS opened_count,
			COALESCE(
				CASE
					WHEN jsonb_typeof(c.metrics -> 'clicked') = 'number' THEN (c.metrics ->> 'clicked')::NUMERIC
					WHEN jsonb_typeof(c.metrics -> 'clicked') = 'string'
						AND BTRIM(c.metrics ->> 'clicked') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN BTRIM(c.metrics ->> 'clicked')::NUMERIC
					ELSE NULL
				END,
				CASE
					WHEN jsonb_typeof(c.metrics -> 'clicks') = 'number' THEN (c.metrics ->> 'clicks')::NUMERIC
					WHEN jsonb_typeof(c.metrics -> 'clicks') = 'string'
						AND BTRIM(c.metrics ->> 'clicks') ~ '^-?[0-9]+(\.[0-9]+)?$'
						THEN BTRIM(c.metrics ->> 'clicks')::NUMERIC
					ELSE NULL
				END,
				c.total_clicks::NUMERIC,
				0
			) AS clicked_count
		FROM public.crm_campaigns c
		WHERE (
			p_tenant_id IS NOT NULL
			AND c.tenant_id = p_tenant_id
		)
		OR (
			p_tenant_id IS NULL
			AND p_user_id IS NOT NULL
			AND c.user_id = p_user_id
		)
	),
	campaign_summary AS (
		SELECT
			COUNT(*)::BIGINT AS total_campaigns,
			COUNT(*) FILTER (
				WHERE status IN ('active', 'sent')
			)::BIGINT AS active_campaigns,
			COUNT(*) FILTER (
				WHERE created_at >= bounds.current_month_start
			)::BIGINT AS current_month_campaigns,
			COUNT(*) FILTER (
				WHERE created_at >= bounds.previous_month_start
					AND created_at < bounds.current_month_start
			)::BIGINT AS previous_month_campaigns,
			COALESCE(
				AVG(
					COALESCE(
						open_rate,
						CASE
							WHEN sent_count > 0 THEN (opened_count / sent_count) * 100
							ELSE NULL
						END
					)
				),
				0
			)::NUMERIC AS avg_open_rate,
			COALESCE(
				AVG(
					COALESCE(
						click_rate,
						CASE
							WHEN sent_count > 0 THEN (clicked_count / sent_count) * 100
							ELSE NULL
						END
					)
				),
				0
			)::NUMERIC AS avg_click_rate,
			COALESCE(
				(
					SUM(opened_count) FILTER (WHERE sent_count > 0)
					/ NULLIF(SUM(sent_count) FILTER (WHERE sent_count > 0), 0)
				) * 100,
				0
			)::NUMERIC AS overall_conversion_rate,
			COALESCE(
				(
					SUM(opened_count) FILTER (
						WHERE created_at >= bounds.current_month_start
							AND sent_count > 0
					)
					/ NULLIF(
						SUM(sent_count) FILTER (
							WHERE created_at >= bounds.current_month_start
								AND sent_count > 0
						),
						0
					)
				) * 100,
				0
			)::NUMERIC AS current_month_conversion_rate,
			COALESCE(
				(
					SUM(opened_count) FILTER (
						WHERE created_at >= bounds.previous_month_start
							AND created_at < bounds.current_month_start
							AND sent_count > 0
					)
					/ NULLIF(
						SUM(sent_count) FILTER (
							WHERE created_at >= bounds.previous_month_start
								AND created_at < bounds.current_month_start
								AND sent_count > 0
						),
						0
					)
				) * 100,
				0
			)::NUMERIC AS previous_month_conversion_rate
		FROM campaign_base
		CROSS JOIN bounds
	),
	automatic_segments AS (
		SELECT sc.id AS customer_id, 'perks-members'::TEXT AS segment_key
		FROM scoped_customers sc
		JOIN public.customer_loyalty_metrics clm ON clm.customer_id = sc.id
		WHERE clm.is_perks_member IS TRUE

		UNION

		SELECT sc.id AS customer_id, 'loyalty-members'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE EXISTS (
			SELECT 1
			FROM unnest(COALESCE(sc.tags, ARRAY[]::TEXT[])) AS tag_name
			WHERE LOWER(tag_name) = 'loyalty'
		)

		UNION

		SELECT sc.id AS customer_id, 'high-value'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE COALESCE(sc.total_spent, 0) > 500

		UNION

		SELECT sc.id AS customer_id, 'new-customers'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE sc.created_at >= NOW() - INTERVAL '30 days'

		UNION

		SELECT sc.id AS customer_id, 'lapsed-customers'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE sc.last_purchase_date < NOW() - INTERVAL '90 days'

		UNION

		SELECT sc.id AS customer_id, 'seasonal-shoppers'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE EXISTS (
			SELECT 1
			FROM unnest(COALESCE(sc.tags, ARRAY[]::TEXT[])) AS tag_name
			WHERE LOWER(tag_name) IN (
				'seasonal',
				'holiday',
				'christmas',
				'valentine',
				'easter',
				'summer',
				'winter'
			)
		)

		UNION

		SELECT sc.id AS customer_id, 'frequent-buyers'::TEXT AS segment_key
		FROM scoped_customers sc
		WHERE jsonb_typeof(sc.order_history) = 'array'
			AND jsonb_array_length(sc.order_history) >= 3
	),
	manual_segments AS (
		SELECT
			cs.customer_id,
			CASE s.name
				WHEN 'Perks Members' THEN 'perks-members'
				WHEN 'Loyalty Members' THEN 'loyalty-members'
				WHEN 'High-Value Customers' THEN 'high-value'
				WHEN 'New Customers' THEN 'new-customers'
				WHEN 'Lapsed Customers' THEN 'lapsed-customers'
				WHEN 'Seasonal Shoppers' THEN 'seasonal-shoppers'
				WHEN 'Frequent Buyers' THEN 'frequent-buyers'
				ELSE NULL
			END AS segment_key
		FROM public.customer_segments cs
		JOIN public.crm_segments s ON s.id = cs.segment_id
		JOIN scoped_customers sc ON sc.id = cs.customer_id
		WHERE s.name IN (
			'Perks Members',
			'Loyalty Members',
			'High-Value Customers',
			'New Customers',
			'Lapsed Customers',
			'Seasonal Shoppers',
			'Frequent Buyers'
		)
	),
	combined_segments AS (
		SELECT customer_id, segment_key
		FROM automatic_segments

		UNION

		SELECT customer_id, segment_key
		FROM manual_segments
		WHERE segment_key IS NOT NULL
	),
	segment_counts_json AS (
		SELECT jsonb_build_object(
			'perks-members', COUNT(*) FILTER (WHERE segment_key = 'perks-members'),
			'loyalty-members', COUNT(*) FILTER (WHERE segment_key = 'loyalty-members'),
			'high-value', COUNT(*) FILTER (WHERE segment_key = 'high-value'),
			'new-customers', COUNT(*) FILTER (WHERE segment_key = 'new-customers'),
			'lapsed-customers', COUNT(*) FILTER (WHERE segment_key = 'lapsed-customers'),
			'seasonal-shoppers', COUNT(*) FILTER (WHERE segment_key = 'seasonal-shoppers'),
			'frequent-buyers', COUNT(*) FILTER (WHERE segment_key = 'frequent-buyers')
		) AS segment_counts
		FROM combined_segments
	),
	system_personas AS (
		SELECT *
		FROM (
			VALUES
				('plant-killer-pam'::TEXT, 'Plant-Killer Pam'::TEXT, ARRAY['Plant Killer Pam']::TEXT[]),
				('pet-friendly-hannah'::TEXT, 'Pet-Friendly Hannah'::TEXT, ARRAY[]::TEXT[]),
				('vegetable-garden-veronica'::TEXT, 'Vegetable Garden Veronica'::TEXT, ARRAY[]::TEXT[]),
				('sustainable-susie'::TEXT, 'Sustainable Susie'::TEXT, ARRAY[]::TEXT[]),
				('patio-gardener-gail'::TEXT, 'Patio Gardener Gail'::TEXT, ARRAY[]::TEXT[]),
				('pollinator-paula'::TEXT, 'Pollinator Paula'::TEXT, ARRAY[]::TEXT[]),
				('curb-appeal-ashley'::TEXT, 'Curb Appeal Ashley'::TEXT, ARRAY[]::TEXT[]),
				('diy-dana'::TEXT, 'DIY Dana'::TEXT, ARRAY[]::TEXT[]),
				('wellness-whitney'::TEXT, 'Wellness Whitney'::TEXT, ARRAY[]::TEXT[])
		) AS personas(id, persona_name, legacy_aliases)
	),
	custom_personas AS (
		SELECT
			cp.id::TEXT AS id,
			cp.persona_name,
			ARRAY[]::TEXT[] AS legacy_aliases
		FROM public.crm_personas cp
		WHERE (
			p_tenant_id IS NOT NULL
			AND cp.tenant_id = p_tenant_id
		)
		OR (
			p_tenant_id IS NULL
			AND p_user_id IS NOT NULL
			AND cp.user_id = p_user_id
		)
	),
	all_personas AS (
		SELECT id, persona_name, legacy_aliases
		FROM system_personas

		UNION ALL

		SELECT id, persona_name, legacy_aliases
		FROM custom_personas
	),
	persona_lookup AS (
		SELECT ap.id, LOWER(BTRIM(ap.persona_name)) AS lookup_value
		FROM all_personas ap

		UNION ALL

		SELECT ap.id, LOWER(BTRIM(alias_value)) AS lookup_value
		FROM all_personas ap,
			unnest(ap.legacy_aliases) AS alias_value
	),
	persona_assignments AS (
		SELECT DISTINCT assignment.customer_id, assignment.persona_id
		FROM (
			SELECT spc.id AS customer_id, ap.id AS persona_id
			FROM scoped_persona_customers spc
			JOIN public.customer_personas cp ON cp.customer_id = spc.id
			JOIN all_personas ap ON ap.id = COALESCE(cp.persona_id, cp.predefined_persona_id)

			UNION ALL

			SELECT spc.id AS customer_id, ap.id AS persona_id
			FROM scoped_persona_customers spc
			JOIN all_personas ap ON ap.id = spc.persona_id

			UNION ALL

			SELECT spc.id AS customer_id, pl.id AS persona_id
			FROM scoped_persona_customers spc
			JOIN persona_lookup pl ON pl.lookup_value = LOWER(BTRIM(spc.persona))
			WHERE spc.persona IS NOT NULL
				AND BTRIM(spc.persona) <> ''
		) AS assignment
	),
	persona_counts_json AS (
		SELECT COALESCE(
			jsonb_object_agg(persona_id, customer_count),
			'{}'::JSONB
		) AS persona_counts
		FROM (
			SELECT
				persona_id,
				COUNT(*)::BIGINT AS customer_count
			FROM persona_assignments
			GROUP BY persona_id
		) AS counts
	)
	SELECT json_build_object(
		'total_customers', COALESCE(customer_summary.total_customers, 0),
		'recent_customers_30d', COALESCE(customer_summary.recent_customers_30d, 0),
		'total_customer_revenue', COALESCE(customer_summary.total_customer_revenue, 0),
		'current_month_customers', COALESCE(customer_summary.current_month_customers, 0),
		'previous_month_customers', COALESCE(customer_summary.previous_month_customers, 0),
		'current_month_customer_revenue', COALESCE(customer_summary.current_month_customer_revenue, 0),
		'previous_month_customer_revenue', COALESCE(customer_summary.previous_month_customer_revenue, 0),
		'total_campaigns', COALESCE(campaign_summary.total_campaigns, 0),
		'active_campaigns', COALESCE(campaign_summary.active_campaigns, 0),
		'current_month_campaigns', COALESCE(campaign_summary.current_month_campaigns, 0),
		'previous_month_campaigns', COALESCE(campaign_summary.previous_month_campaigns, 0),
		'avg_open_rate', COALESCE(campaign_summary.avg_open_rate, 0),
		'avg_click_rate', COALESCE(campaign_summary.avg_click_rate, 0),
		'overall_conversion_rate', COALESCE(campaign_summary.overall_conversion_rate, 0),
		'current_month_conversion_rate', COALESCE(campaign_summary.current_month_conversion_rate, 0),
		'previous_month_conversion_rate', COALESCE(campaign_summary.previous_month_conversion_rate, 0),
		'segment_counts', COALESCE(
			segment_counts_json.segment_counts,
			jsonb_build_object(
				'perks-members', 0,
				'loyalty-members', 0,
				'high-value', 0,
				'new-customers', 0,
				'lapsed-customers', 0,
				'seasonal-shoppers', 0,
				'frequent-buyers', 0
			)
		),
		'persona_counts', COALESCE(persona_counts_json.persona_counts, '{}'::JSONB)
	)
	INTO v_result
	FROM customer_summary
	CROSS JOIN campaign_summary
	CROSS JOIN segment_counts_json
	CROSS JOIN persona_counts_json;

	RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_dashboard_snapshot(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_dashboard_snapshot(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
