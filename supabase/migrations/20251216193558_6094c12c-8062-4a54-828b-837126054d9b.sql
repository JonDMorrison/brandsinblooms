-- Email: check if can send
CREATE OR REPLACE FUNCTION public.can_send_emails(p_tenant_id UUID, p_count INTEGER DEFAULT 1)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month DATE := date_trunc('month', CURRENT_DATE)::date; v_budget RECORD; v_counter RECORD;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  IF (v_counter.email_sends_used + p_count) > v_budget.max_email_sends THEN RETURN 'deny'; END IF;
  RETURN 'allow';
END; $$;

-- Email: record sends
CREATE OR REPLACE FUNCTION public.record_email_sends(p_tenant_id UUID, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  UPDATE public.org_usage_counters SET email_sends_used = email_sends_used + p_count, updated_at = now()
  WHERE tenant_id = p_tenant_id AND month = date_trunc('month', CURRENT_DATE)::date;
  RETURN TRUE;
END; $$;

-- SMS: check if can send
CREATE OR REPLACE FUNCTION public.can_send_sms(p_tenant_id UUID, p_count INTEGER DEFAULT 1)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month DATE := date_trunc('month', CURRENT_DATE)::date; v_budget RECORD; v_counter RECORD;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  IF (v_counter.sms_sends_used + p_count) > v_budget.max_sms_sends THEN RETURN 'deny'; END IF;
  RETURN 'allow';
END; $$;

-- SMS: record sends
CREATE OR REPLACE FUNCTION public.record_sms_sends(p_tenant_id UUID, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  UPDATE public.org_usage_counters SET sms_sends_used = sms_sends_used + p_count, updated_at = now()
  WHERE tenant_id = p_tenant_id AND month = date_trunc('month', CURRENT_DATE)::date;
  RETURN TRUE;
END; $$;

-- Get remaining budget (convenience)
CREATE OR REPLACE FUNCTION public.get_remaining_budget(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_month DATE := date_trunc('month', CURRENT_DATE)::date; v_budget RECORD; v_counter RECORD;
BEGIN
  PERFORM public.ensure_org_usage_initialized(p_tenant_id);
  SELECT * INTO v_budget FROM public.org_usage_budgets WHERE tenant_id = p_tenant_id AND month = v_month;
  SELECT * INTO v_counter FROM public.org_usage_counters WHERE tenant_id = p_tenant_id AND month = v_month;
  RETURN jsonb_build_object(
    'month', v_month, 'plan', v_budget.plan,
    'email_sends', jsonb_build_object('used', v_counter.email_sends_used, 'max', v_budget.max_email_sends, 'remaining', v_budget.max_email_sends - v_counter.email_sends_used),
    'sms_sends', jsonb_build_object('used', v_counter.sms_sends_used, 'max', v_budget.max_sms_sends, 'remaining', v_budget.max_sms_sends - v_counter.sms_sends_used),
    'sync_jobs', jsonb_build_object('used', v_counter.sync_jobs_used, 'max', v_budget.max_sync_jobs),
    'automation_runs', jsonb_build_object('used', v_counter.automation_runs_used, 'max', v_budget.max_automation_runs)
  );
END; $$;