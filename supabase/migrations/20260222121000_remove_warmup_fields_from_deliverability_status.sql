-- Milestone 3: Remove warmup/limit counters from deliverability status output

DROP FUNCTION IF EXISTS public.get_deliverability_status(uuid);

CREATE OR REPLACE FUNCTION public.get_deliverability_status(p_domain_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_summary record;
  v_status text := 'healthy';
  v_warnings jsonb := '[]'::jsonb;
  v_trend_declining boolean := false;
BEGIN
  -- Get summary data
  SELECT * INTO v_summary
  FROM deliverability_summary_30d
  WHERE domain_id = p_domain_id;

  IF v_summary IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Domain not found',
      'domain_id', p_domain_id
    );
  END IF;

  -- Analyze bounce rate
  IF v_summary.bounce_rate > 5 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'bounce_rate',
      'severity', 'critical',
      'message', format('Bounce rate is critically high at %s%%. Stop sending and clean your list.', v_summary.bounce_rate),
      'value', v_summary.bounce_rate
    );
  ELSIF v_summary.bounce_rate > 2 THEN
    IF v_status = 'healthy' THEN v_status := 'warning'; END IF;
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'bounce_rate',
      'severity', 'warning',
      'message', format('Bounce rate is elevated at %s%%. Consider reviewing list quality.', v_summary.bounce_rate),
      'value', v_summary.bounce_rate
    );
  END IF;

  -- Analyze complaint rate
  IF v_summary.complaint_rate > 0.2 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'complaint_rate',
      'severity', 'critical',
      'message', format('Complaint rate is critically high at %s%%. Pause sending immediately.', v_summary.complaint_rate),
      'value', v_summary.complaint_rate
    );
  ELSIF v_summary.complaint_rate > 0.1 THEN
    v_status := 'critical';
    v_warnings := v_warnings || jsonb_build_object(
      'type', 'complaint_rate',
      'severity', 'critical',
      'message', format('Complaint rate is concerning at %s%%. Review content and list quality.', v_summary.complaint_rate),
      'value', v_summary.complaint_rate
    );
  END IF;

  -- Check open rate trend (declining 3 campaigns in a row)
  IF v_summary.campaign_1_open_rate IS NOT NULL
     AND v_summary.campaign_2_open_rate IS NOT NULL
     AND v_summary.campaign_3_open_rate IS NOT NULL THEN
    IF v_summary.campaign_1_open_rate < v_summary.campaign_2_open_rate
       AND v_summary.campaign_2_open_rate < v_summary.campaign_3_open_rate THEN
      v_trend_declining := true;
      IF v_status = 'healthy' THEN v_status := 'warning'; END IF;
      v_warnings := v_warnings || jsonb_build_object(
        'type', 'open_rate_trend',
        'severity', 'warning',
        'message', format('Open rates declining: %s%% → %s%% → %s%%. Review subject lines and content.',
          ROUND(v_summary.campaign_3_open_rate::numeric, 1),
          ROUND(v_summary.campaign_2_open_rate::numeric, 1),
          ROUND(v_summary.campaign_1_open_rate::numeric, 1)),
        'trend', jsonb_build_array(
          v_summary.campaign_3_open_rate,
          v_summary.campaign_2_open_rate,
          v_summary.campaign_1_open_rate
        )
      );
    END IF;
  END IF;

  -- Build result (Milestone 3: omit warmup_stage/daily_limit)
  v_result := jsonb_build_object(
    'domain_id', v_summary.domain_id,
    'domain_name', v_summary.domain_name,
    'tenant_id', v_summary.tenant_id,
    'status', v_status,
    'verification_status', v_summary.verification_status,
    'metrics', jsonb_build_object(
      'sent_30d', v_summary.sent_30d,
      'delivered_30d', v_summary.delivered_30d,
      'opened_30d', v_summary.opened_30d,
      'clicked_30d', v_summary.clicked_30d,
      'bounced_30d', v_summary.bounced_30d,
      'complained_30d', v_summary.complained_30d,
      'campaign_count_30d', v_summary.campaign_count_30d
    ),
    'rates', jsonb_build_object(
      'bounce_rate', v_summary.bounce_rate,
      'complaint_rate', v_summary.complaint_rate,
      'open_rate', v_summary.open_rate,
      'click_rate', v_summary.click_rate
    ),
    'trend', jsonb_build_object(
      'declining', v_trend_declining,
      'recent_open_rates', jsonb_build_array(
        v_summary.campaign_1_open_rate,
        v_summary.campaign_2_open_rate,
        v_summary.campaign_3_open_rate
      )
    ),
    'warnings', v_warnings,
    'recommendation', CASE
      WHEN v_status = 'critical' THEN 'Pause sending and address issues immediately'
      WHEN v_status = 'warning' THEN 'Monitor closely and improve list/content quality'
      ELSE 'Continue normal sending'
    END
  );

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
