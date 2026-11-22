-- New enrollment events only. Provider balance snapshots and historical rows
-- are intentionally not backfilled into automations.
-- Parent deletion removes the binding alongside existing cascades. Individual
-- run/event deletion remains blocked at commit so a retry cannot lose identity.
CREATE TABLE public.loyalty_automation_event_runs (
  event_id uuid PRIMARY KEY REFERENCES public.automation_trigger_events(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  run_id uuid NOT NULL UNIQUE REFERENCES public.automation_runs(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  workflow_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_automation_event_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_automation_event_runs FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.require_claimed_loyalty_event(p_event_id uuid,p_worker_id text)
RETURNS public.automation_trigger_events LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.automation_trigger_events;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO e FROM public.automation_trigger_events WHERE id=p_event_id FOR UPDATE;
  IF e.id IS NULL OR e.event_type NOT IN ('loyalty_join','loyalty.signup')
     OR e.processed_at IS NOT NULL OR nullif(btrim(p_worker_id),'') IS NULL
     OR e.claimed_by IS DISTINCT FROM p_worker_id OR e.claimed_at IS NULL
     OR e.claimed_at <= clock_timestamp()-interval '15 minutes'
     OR NOT EXISTS (SELECT 1 FROM public.crm_automations a
       WHERE a.id=e.automation_id AND a.tenant_id=e.tenant_id
       AND a.trigger_type IN ('loyalty_join','loyalty.signup') AND a.is_active)
     OR NOT EXISTS (SELECT 1 FROM public.crm_customers c
       WHERE c.id=e.customer_id AND c.tenant_id=e.tenant_id
       AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL)
  THEN RAISE EXCEPTION 'Loyalty event claim or scope invalid' USING ERRCODE='42501'; END IF;
  RETURN e;
END;
$$;
REVOKE ALL ON FUNCTION public.require_claimed_loyalty_event(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.begin_loyalty_automation_run(
  p_event_id uuid,p_worker_id text,p_total_steps integer,
  p_trigger_data jsonb DEFAULT '{}'::jsonb,p_metadata jsonb DEFAULT '{}'::jsonb,
  p_channel_availability jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.automation_trigger_events; r public.automation_runs; result jsonb; message_status text; current_workflow jsonb; saved_workflow jsonb;
BEGIN
  e:=public.require_claimed_loyalty_event(p_event_id,p_worker_id);
  IF p_total_steps IS NULL OR p_total_steps NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid loyalty workflow step count' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(a.workflow_steps,'null'::jsonb) INTO current_workflow FROM public.crm_automations a
    WHERE a.id=e.automation_id AND a.tenant_id=e.tenant_id FOR SHARE;
  SELECT b.workflow_snapshot INTO saved_workflow FROM public.loyalty_automation_event_runs b WHERE b.event_id=e.id;
  SELECT ar.* INTO r FROM public.loyalty_automation_event_runs b
    JOIN public.automation_runs ar ON ar.id=b.run_id WHERE b.event_id=e.id FOR UPDATE OF ar;
  IF r.id IS NOT NULL THEN
    IF r.tenant_id<>e.tenant_id OR r.customer_id<>e.customer_id OR r.automation_id<>e.automation_id THEN
      RAISE EXCEPTION 'Loyalty run scope invalid' USING ERRCODE='42501';
    END IF;
    SELECT o.status INTO message_status FROM public.crm_outbox o
      WHERE o.automation_run_id=r.id AND o.step_index=r.current_step_index
      ORDER BY o.created_at,o.id LIMIT 1;
    IF r.status='active' AND r.current_step_index<r.total_steps
       AND (message_status IS NULL OR message_status='skipped') THEN
      IF saved_workflow IS DISTINCT FROM current_workflow OR p_total_steps<>r.total_steps THEN
        RAISE EXCEPTION 'Loyalty workflow changed before retry; review required' USING ERRCODE='22023';
      END IF;
      RETURN jsonb_build_object('decision','resumed','run_id',r.id,'run_sequence',r.run_sequence,'step_index',r.current_step_index,'step_status',message_status);
    END IF;
    RETURN jsonb_build_object('decision','ignored','reason','already_started','run_id',r.id,'step_index',r.current_step_index,'step_status',message_status);
  END IF;
  result:=public.begin_automation_run(e.automation_id,e.customer_id,p_total_steps,
    coalesce(p_trigger_data,'{}'::jsonb)||jsonb_build_object('loyalty_trigger_event_id',e.id),
    p_metadata,p_channel_availability,1440);
  IF result->>'decision'='started' THEN
    INSERT INTO public.loyalty_automation_event_runs(event_id,run_id,tenant_id,customer_id,automation_id,workflow_snapshot)
      VALUES(e.id,(result->>'run_id')::uuid,e.tenant_id,e.customer_id,e.automation_id,current_workflow);
    result:=result||jsonb_build_object('step_index',0);
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_loyalty_automation_run(uuid,text,integer,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_loyalty_automation_run(uuid,text,integer,jsonb,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_loyalty_automation_step(
  p_event_id uuid,p_worker_id text,p_run_id uuid,p_step_index integer,p_message jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.automation_trigger_events; r public.automation_runs; message_id uuid; message_status text; channel text; send_at timestamptz; weight integer;
BEGIN
  e:=public.require_claimed_loyalty_event(p_event_id,p_worker_id);
  SELECT ar.* INTO r FROM public.loyalty_automation_event_runs b
    JOIN public.automation_runs ar ON ar.id=b.run_id
    WHERE b.event_id=e.id AND b.run_id=p_run_id FOR UPDATE OF ar;
  IF r.id IS NULL OR r.tenant_id<>e.tenant_id OR r.customer_id<>e.customer_id OR r.automation_id<>e.automation_id
     OR p_step_index IS NULL OR p_step_index<0 OR p_step_index>=r.total_steps THEN
    RAISE EXCEPTION 'Loyalty run or step scope invalid' USING ERRCODE='42501';
  END IF;
  -- Do not revive failed/sent/skipped deliveries; preserve the provider key.
  SELECT id INTO message_id FROM public.crm_outbox
    WHERE automation_run_id=r.id AND step_index=p_step_index ORDER BY created_at,id LIMIT 1;
  IF message_id IS NOT NULL THEN RETURN jsonb_build_object('outbox_id',message_id,'existing',true); END IF;
  IF r.status<>'active' OR p_step_index<>r.current_step_index THEN
    RAISE EXCEPTION 'Loyalty run is not at this step' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_message) IS DISTINCT FROM 'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_message) k WHERE k NOT IN
    ('message_type','recipient','content','subject','template_data','scheduled_at','status','skip_reason','priority','automation_node_id')) THEN
    RAISE EXCEPTION 'Invalid loyalty message fields' USING ERRCODE='22023';
  END IF;
  channel:=p_message->>'message_type'; message_status:=p_message->>'status';
  IF channel IS NULL OR channel NOT IN ('email','sms') OR message_status IS NULL OR message_status NOT IN ('queued','skipped')
     OR jsonb_typeof(p_message->'recipient') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_message->'content') IS DISTINCT FROM 'string'
     OR (p_message ? 'template_data' AND jsonb_typeof(p_message->'template_data') IS DISTINCT FROM 'object')
     OR (message_status='queued' AND nullif(btrim(p_message->>'recipient'),'') IS NULL)
     OR (message_status='skipped' AND nullif(btrim(p_message->>'skip_reason'),'') IS NULL) THEN
    RAISE EXCEPTION 'Invalid loyalty message' USING ERRCODE='22023';
  END IF;
  send_at:=(p_message->>'scheduled_at')::timestamptz;
  weight:=coalesce((p_message->>'priority')::integer,100);
  IF send_at IS NULL OR NOT isfinite(send_at) OR weight NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Invalid loyalty schedule' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.crm_outbox(tenant_id,automation_id,automation_run_id,customer_id,step_index,
    message_type,recipient,content,subject,template_data,scheduled_at,status,skip_reason,skipped_at,priority,automation_node_id)
  VALUES(r.tenant_id,r.automation_id,r.id,r.customer_id,p_step_index,channel,p_message->>'recipient',p_message->>'content',
    p_message->>'subject',coalesce(p_message->'template_data','{}'::jsonb),send_at,message_status,p_message->>'skip_reason',
    CASE WHEN message_status='skipped' THEN now() ELSE NULL END,weight,p_message->>'automation_node_id')
  RETURNING id INTO message_id;
  IF message_status='queued' THEN
    UPDATE public.automation_runs SET next_step_scheduled_at=send_at,updated_at=now() WHERE id=r.id;
  END IF;
  RETURN jsonb_build_object('outbox_id',message_id,'existing',false);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_loyalty_automation_step(uuid,text,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_loyalty_automation_step(uuid,text,uuid,integer,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_native_loyalty_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.crm_customers c WHERE c.id=NEW.customer_id AND c.tenant_id=NEW.tenant_id
    AND c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL) THEN
    RAISE EXCEPTION 'Enrollment customer scope invalid' USING ERRCODE='42501';
  END IF;
  IF NEW.event_type='enrolled' AND NEW.created_at>=statement_timestamp()-interval '5 minutes' THEN
    INSERT INTO public.automation_trigger_events(automation_id,customer_id,tenant_id,event_type,source_event_key,metadata)
    SELECT a.id,NEW.customer_id,NEW.tenant_id,a.trigger_type,'native-loyalty:'||NEW.id::text,
      jsonb_build_object('source','native_loyalty_enrollment','enrollment_id',NEW.id,'enrolled_at',NEW.created_at,'enrollment_source',NEW.enrollment_source)
    FROM public.crm_automations a WHERE a.tenant_id=NEW.tenant_id AND a.is_active
      AND a.trigger_type IN ('loyalty_join','loyalty.signup')
    ON CONFLICT(tenant_id,automation_id,source_event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_native_loyalty_enrollment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER queue_native_loyalty_enrollment AFTER INSERT ON public.perks_enrollment_events
  FOR EACH ROW EXECUTE FUNCTION public.queue_native_loyalty_enrollment();

CREATE OR REPLACE FUNCTION public.track_loyalty_enrollment(p_customer_id uuid,p_tenant_id uuid,p_enrollment_source text DEFAULT 'signup')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.crm_customers; m public.customer_loyalty_metrics; event_id uuid; joined_days integer;
BEGIN
  IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.crm_customers WHERE id=p_customer_id AND tenant_id=p_tenant_id
    AND deleted_at IS NULL AND merged_into_customer_id IS NULL FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Enrollment customer scope invalid' USING ERRCODE='42501'; END IF;
  SELECT * INTO m FROM public.customer_loyalty_metrics WHERE customer_id=c.id FOR UPDATE;
  IF m.customer_id IS NOT NULL AND m.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Enrollment metrics scope invalid' USING ERRCODE='42501';
  END IF;
  IF coalesce(c.loyalty_member,false) OR coalesce(m.is_perks_member,false)
    OR EXISTS(SELECT 1 FROM public.loyalty_provider_accounts a WHERE a.tenant_id=p_tenant_id AND a.customer_id=c.id AND a.status='active') THEN
    SELECT id INTO event_id FROM public.perks_enrollment_events
      WHERE tenant_id=p_tenant_id AND customer_id=c.id AND event_type='enrolled' ORDER BY created_at DESC,id DESC LIMIT 1;
    RETURN event_id;
  END IF;
  joined_days:=greatest(0,extract(day FROM(now()-coalesce(c.created_at,now())))::integer);
  INSERT INTO public.customer_loyalty_metrics(customer_id,tenant_id,is_perks_member,perks_enrolled_at,customer_created_at,time_to_join_perks_days,current_loyalty_tier)
    VALUES(c.id,p_tenant_id,true,now(),c.created_at,joined_days,'bronze')
    ON CONFLICT(customer_id) DO UPDATE SET is_perks_member=true,perks_enrolled_at=now(),
      time_to_join_perks_days=joined_days,updated_at=now();
  UPDATE public.crm_customers SET loyalty_member=true,updated_at=now() WHERE id=c.id AND tenant_id=p_tenant_id;
  INSERT INTO public.perks_enrollment_events(tenant_id,customer_id,event_type,new_tier,enrollment_source)
    VALUES(p_tenant_id,c.id,'enrolled','bronze',p_enrollment_source) RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.track_loyalty_enrollment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.track_loyalty_enrollment(uuid,uuid,text) TO service_role;

-- Advancing a skipped step is part of the same lease boundary as enqueue.
CREATE OR REPLACE FUNCTION public.advance_loyalty_automation_step(
  p_event_id uuid,p_worker_id text,p_run_id uuid,p_step_index integer,
  p_next_scheduled_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.automation_trigger_events; r public.automation_runs; next_index integer;
BEGIN
  e:=public.require_claimed_loyalty_event(p_event_id,p_worker_id);
  SELECT ar.* INTO r FROM public.loyalty_automation_event_runs b
    JOIN public.automation_runs ar ON ar.id=b.run_id
    WHERE b.event_id=e.id AND b.run_id=p_run_id FOR UPDATE OF ar;
  IF r.id IS NULL OR r.tenant_id<>e.tenant_id OR r.customer_id<>e.customer_id OR r.automation_id<>e.automation_id
     OR r.status<>'active' OR p_step_index IS NULL OR p_step_index<>r.current_step_index OR p_step_index>=r.total_steps
     OR NOT EXISTS (SELECT 1 FROM public.crm_outbox o WHERE o.automation_run_id=r.id
       AND o.step_index=p_step_index AND o.status='skipped') THEN
    RAISE EXCEPTION 'Loyalty skipped step or run scope invalid' USING ERRCODE='42501';
  END IF;
  IF p_next_scheduled_at IS NOT NULL AND NOT isfinite(p_next_scheduled_at) THEN
    RAISE EXCEPTION 'Invalid loyalty schedule' USING ERRCODE='22023';
  END IF;
  next_index:=r.current_step_index+1;
  UPDATE public.automation_runs SET current_step_index=next_index,
    status=CASE WHEN next_index>=r.total_steps THEN 'completed' ELSE 'active' END,
    next_step_scheduled_at=CASE WHEN next_index>=r.total_steps THEN NULL ELSE p_next_scheduled_at END,
    completed_at=CASE WHEN next_index>=r.total_steps THEN now() ELSE NULL END,updated_at=now()
  WHERE id=r.id;
  RETURN jsonb_build_object('run_id',r.id,'step_index',next_index,'completed',next_index>=r.total_steps,
    'status',CASE WHEN next_index>=r.total_steps THEN 'completed' ELSE 'active' END);
END;
$$;
REVOKE ALL ON FUNCTION public.advance_loyalty_automation_step(uuid,text,uuid,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_loyalty_automation_step(uuid,text,uuid,integer,timestamptz) TO service_role;
