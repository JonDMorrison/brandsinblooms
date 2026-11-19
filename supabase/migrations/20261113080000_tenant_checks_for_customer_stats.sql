-- Central login milestone 53 (Wave 6): the three tenant customer-stats functions answer only a caller who may read
-- that tenant's customers (50/R-03). All three are live today; this file stands alone (no central-login dependency).
-- Forward-only; no earlier migration is edited.
--
-- public.get_tenant_lifecycle_stats, get_tenant_risk_stats and get_tenant_content_intent_stats are SECURITY DEFINER
-- and granted to authenticated, and answered any signed-in caller for any company (50/R-03 proof: tenant A's admin
-- read tenant B's aggregates). Each now starts with the 47/R-04 check (20261112180000): public.has_tenant_permission
-- with 'customer.read', the check the crm_customers policies use; anyone else gets 42501. Service-role callers keep
-- working (has_tenant_permission returns true for them). The bodies are the hosted ones (from the schema dump, equal
-- to the local stack), unchanged apart from the check; same names, arguments, results, search_path and grants.

-- 50/R-03: get_tenant_lifecycle_stats
CREATE OR REPLACE FUNCTION public.get_tenant_lifecycle_stats(p_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.read', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT json_build_object(
    'lifecycle_stage_breakdown', json_build_object(
      'new', COUNT(*) FILTER (WHERE lifecycle_stage = 'new'),
      'engaged', COUNT(*) FILTER (WHERE lifecycle_stage = 'engaged'),
      'active_buyer', COUNT(*) FILTER (WHERE lifecycle_stage = 'active_buyer'),
      'loyal', COUNT(*) FILTER (WHERE lifecycle_stage = 'loyal'),
      'at_risk', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
      'dormant', COUNT(*) FILTER (WHERE lifecycle_stage = 'dormant'),
      'churned', COUNT(*) FILTER (WHERE lifecycle_stage = 'churned')
    ),
    'avg_days_since_signup', COALESCE(AVG(days_since_signup), 0),
    'avg_days_since_last_purchase', COALESCE(AVG(days_since_last_purchase), 0),
    'avg_days_since_last_engagement', COALESCE(AVG(days_since_last_engagement), 0),
    'avg_days_since_last_automation', COALESCE(AVG(days_since_last_automation), 0),
    'overall_churn_rate', CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE is_churned)::NUMERIC / COUNT(*)) * 100 
      ELSE 0 END,
    'overall_reactivation_success_rate', COALESCE(AVG(reactivation_success_rate), 0),
    'avg_time_to_churn_days', AVG(time_to_churn_days),
    'avg_time_to_reactivation_days', AVG(time_to_reactivation_days),
    'at_risk_customer_count', COUNT(*) FILTER (WHERE lifecycle_stage = 'at_risk'),
    'customers_churned_last_30d', COUNT(*) FILTER (WHERE churned_at > NOW() - INTERVAL '30 days'),
    'customers_reactivated_last_30d', COUNT(*) FILTER (WHERE reactivated_at > NOW() - INTERVAL '30 days')
  ) INTO v_result
  FROM customer_lifecycle_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_result;
END;
$function$;

-- 50/R-03: get_tenant_risk_stats
CREATE OR REPLACE FUNCTION public.get_tenant_risk_stats(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.read', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'risk_level_breakdown', jsonb_build_object(
      'minimal', COUNT(*) FILTER (WHERE risk_level = 'minimal'),
      'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
      'moderate', COUNT(*) FILTER (WHERE risk_level = 'moderate'),
      'high', COUNT(*) FILTER (WHERE risk_level = 'high'),
      'critical', COUNT(*) FILTER (WHERE risk_level = 'critical')
    ),
    'avg_overall_risk_score', ROUND(AVG(overall_risk_score)::NUMERIC, 1),
    'rapid_opt_out_count', COUNT(*) FILTER (WHERE is_rapid_opt_out = TRUE),
    'avg_ignore_streak', ROUND(AVG(current_ignore_streak)::NUMERIC, 1),
    'coupon_dependent_count', COUNT(*) FILTER (WHERE is_coupon_dependent = TRUE),
    'long_term_dormant_count', COUNT(*) FILTER (WHERE is_long_term_dormant = TRUE),
    'hard_bounce_count', COUNT(*) FILTER (WHERE total_hard_bounces > 0),
    'suppressed_count', COUNT(*) FILTER (WHERE should_suppress = TRUE),
    'risk_trend_distribution', jsonb_build_object(
      'improving', COUNT(*) FILTER (WHERE risk_trend = 'improving'),
      'stable', COUNT(*) FILTER (WHERE risk_trend = 'stable'),
      'worsening', COUNT(*) FILTER (WHERE risk_trend = 'worsening')
    )
  ) INTO v_result
  FROM customer_risk_signals
  WHERE tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$function$;

-- 50/R-03: get_tenant_content_intent_stats
CREATE OR REPLACE FUNCTION public.get_tenant_content_intent_stats(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stats JSONB;
BEGIN
  IF p_tenant_id IS NULL OR NOT public.has_tenant_permission(p_tenant_id, 'customer.read', NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total_customers', COUNT(*),
    'avg_intent_score', ROUND(AVG(intent_score), 2),
    'intent_level_breakdown', jsonb_build_object(
      'high', COUNT(*) FILTER (WHERE intent_level = 'high'),
      'medium', COUNT(*) FILTER (WHERE intent_level = 'medium'),
      'low', COUNT(*) FILTER (WHERE intent_level = 'low'),
      'unknown', COUNT(*) FILTER (WHERE intent_level = 'unknown')
    ),
    'avg_engagement_depth_score', ROUND(AVG(engagement_depth_score), 2),
    'avg_click_pattern_consistency', ROUND(AVG(click_pattern_consistency_score), 2),
    'avg_message_relevance_score', ROUND(AVG(message_relevance_score), 2),
    'content_type_performance', jsonb_build_object(
      'story_avg_engagement', ROUND(AVG(story_engagement_rate), 2),
      'offer_avg_engagement', ROUND(AVG(offer_engagement_rate), 2)
    ),
    'edu_vs_promo_preference', jsonb_build_object(
      'educational_preferred', COUNT(*) FILTER (WHERE content_preference = 'educational'),
      'promotional_preferred', COUNT(*) FILTER (WHERE content_preference = 'promotional'),
      'balanced', COUNT(*) FILTER (WHERE content_preference = 'balanced')
    ),
    'avg_cta_click_rate', ROUND(AVG(cta_click_rate), 2),
    'avg_brand_story_open_rate', ROUND(AVG(brand_story_open_rate), 2)
  ) INTO v_stats
  FROM customer_content_intent_metrics
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_stats;
END;
$function$;
