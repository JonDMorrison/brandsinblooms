-- Create update_customer_sms_metrics function
CREATE OR REPLACE FUNCTION public.update_customer_sms_metrics(
  p_customer_id UUID,
  p_event_type TEXT,
  p_message_sent_at TIMESTAMPTZ DEFAULT NULL,
  p_response_at TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_tenant_id UUID;
  v_current_metrics RECORD;
  v_new_avg_response_time NUMERIC;
  v_response_time_minutes NUMERIC;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.crm_customers WHERE id = p_customer_id;
  IF v_tenant_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO public.customer_sms_metrics (customer_id, tenant_id)
  VALUES (p_customer_id, v_tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  
  SELECT * INTO v_current_metrics FROM public.customer_sms_metrics WHERE customer_id = p_customer_id;
  
  CASE p_event_type
    WHEN 'sent' THEN
      UPDATE public.customer_sms_metrics SET
        total_sent = COALESCE(total_sent, 0) + 1,
        last_sent_at = COALESCE(p_message_sent_at, NOW()),
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    WHEN 'delivered' THEN
      UPDATE public.customer_sms_metrics SET
        total_delivered = COALESCE(total_delivered, 0) + 1,
        last_delivered_at = NOW(),
        delivery_rate = CASE WHEN COALESCE(total_sent, 0) > 0 
          THEN ((COALESCE(total_delivered, 0) + 1)::NUMERIC / total_sent * 100) ELSE 0 END,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    WHEN 'clicked' THEN
      UPDATE public.customer_sms_metrics SET
        total_clicked = COALESCE(total_clicked, 0) + 1,
        last_clicked_at = NOW(),
        click_rate = CASE WHEN COALESCE(total_delivered, 0) > 0 
          THEN ((COALESCE(total_clicked, 0) + 1)::NUMERIC / total_delivered * 100) ELSE 0 END,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    WHEN 'replied' THEN
      IF p_message_sent_at IS NOT NULL THEN
        v_response_time_minutes := EXTRACT(EPOCH FROM (COALESCE(p_response_at, NOW()) - p_message_sent_at)) / 60;
        IF v_current_metrics.avg_time_to_response_minutes IS NOT NULL AND v_current_metrics.total_replied > 0 THEN
          v_new_avg_response_time := ((v_current_metrics.avg_time_to_response_minutes * v_current_metrics.total_replied) + v_response_time_minutes) / (v_current_metrics.total_replied + 1);
        ELSE
          v_new_avg_response_time := v_response_time_minutes;
        END IF;
      ELSE
        v_new_avg_response_time := v_current_metrics.avg_time_to_response_minutes;
      END IF;
      UPDATE public.customer_sms_metrics SET
        total_replied = COALESCE(total_replied, 0) + 1,
        last_replied_at = NOW(),
        reply_rate = CASE WHEN COALESCE(total_sent, 0) > 0 
          THEN ((COALESCE(total_replied, 0) + 1)::NUMERIC / total_sent * 100) ELSE 0 END,
        avg_time_to_response_minutes = v_new_avg_response_time,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    WHEN 'opt_out' THEN
      UPDATE public.customer_sms_metrics SET
        total_opt_outs = COALESCE(total_opt_outs, 0) + 1,
        last_opt_out_at = NOW(),
        opt_out_rate = CASE WHEN COALESCE(total_sent, 0) > 0 
          THEN ((COALESCE(total_opt_outs, 0) + 1)::NUMERIC / total_sent * 100) ELSE 0 END,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    WHEN 'failed' THEN
      UPDATE public.customer_sms_metrics SET
        total_failed = COALESCE(total_failed, 0) + 1,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      
    ELSE NULL;
  END CASE;
  
  PERFORM public.recalculate_sms_engagement_score(p_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create recalculate_sms_engagement_score function
CREATE OR REPLACE FUNCTION public.recalculate_sms_engagement_score(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_sms_score NUMERIC;
  v_recency_score NUMERIC;
  v_metrics RECORD;
BEGIN
  SELECT * INTO v_metrics FROM public.customer_sms_metrics WHERE customer_id = p_customer_id;
  IF v_metrics IS NULL THEN RETURN; END IF;
  
  v_recency_score := CASE 
    WHEN v_metrics.last_replied_at > NOW() - INTERVAL '7 days' THEN 100
    WHEN v_metrics.last_clicked_at > NOW() - INTERVAL '14 days' THEN 80
    WHEN v_metrics.last_delivered_at > NOW() - INTERVAL '30 days' THEN 50
    ELSE 20
  END;
  
  v_sms_score := LEAST(
    (COALESCE(v_metrics.delivery_rate, 0) * 0.2) +
    (COALESCE(v_metrics.click_rate, 0) * 0.4) +
    (COALESCE(v_metrics.reply_rate, 0) * 0.3) +
    (v_recency_score * 0.1),
    100
  );
  
  UPDATE public.customer_sms_metrics SET engagement_score = v_sms_score, updated_at = NOW() WHERE customer_id = p_customer_id;
  UPDATE public.customer_engagement_summary SET sms_score = v_sms_score, last_calculated_at = NOW() WHERE customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_customer_sms_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_sms_engagement_score TO authenticated, service_role;