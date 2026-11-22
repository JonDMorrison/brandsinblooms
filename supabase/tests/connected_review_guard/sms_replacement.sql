SELECT set_config('test.uid','00000000-0000-4000-8000-000000000003',false),set_config('test.tenant','00000000-0000-4000-8000-000000000001',false),set_config('test.role','authenticated',false);
DO $$
DECLARE old public.crm_sms_campaigns; fresh jsonb; again jsonb;
BEGIN
 INSERT INTO public.crm_sms_campaigns(tenant_id,name,message,status,source,metrics,connected_content_sources,audience_confirmed) VALUES ('00000000-0000-4000-8000-000000000001','Original','Saved copy','draft','connected_content','{}','[{"siteId":"00000000-0000-4000-8000-000000000002","itemId":"page","type":"page","updatedAt":"2026-11-22","publicUrl":"https://flowers.test/page"}]',true) RETURNING * INTO old;
 UPDATE public.crm_sms_campaigns SET status='paused',metrics='{"delivered":1,"content_review":{"decision":"review_required","reason":"Website details changed"}}' WHERE id=old.id RETURNING * INTO old;
 INSERT INTO public.sms_messages(tenant_id,campaign_id,status,twilio_sid) VALUES(old.tenant_id,old.id,'sent','accepted'),(old.tenant_id,old.id,'queued',NULL);
 INSERT INTO public.sms_send_jobs(tenant_id,campaign_id,status) VALUES(old.tenant_id,old.id,'completed'),(old.tenant_id,old.id,'pending');
 BEGIN
  PERFORM public.record_sms_content_review(old.tenant_id,old.id,'paused','retry','unavailable');
  RAISE EXCEPTION 'Expected service-only rejection';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 fresh:=public.replace_connected_sms_draft(old.tenant_id,old.id,old.updated_at,'Updated page','Current website details',old.connected_content_sources);
 ASSERT fresh->>'id'<>old.id::text AND fresh->>'status'='draft' AND (fresh->>'audience_confirmed')::boolean=false;
 ASSERT (SELECT count(*) FROM public.sms_messages WHERE status='sent' AND twilio_sid='accepted')=1;
 ASSERT (SELECT count(*) FROM public.sms_messages WHERE status='failed' AND error_code='CONTENT_SUPERSEDED')=1;
 ASSERT (SELECT count(*) FROM public.sms_send_jobs WHERE status='completed')=1;
 ASSERT (SELECT count(*) FROM public.sms_send_jobs WHERE status='failed')=1;
 again:=public.replace_connected_sms_draft(old.tenant_id,old.id,old.updated_at,'duplicate','duplicate',old.connected_content_sources);
 ASSERT again->>'id'=fresh->>'id';
 ASSERT (SELECT count(*) FROM public.crm_sms_campaigns)=2;
 ASSERT (SELECT metrics->>'delivered' FROM public.crm_sms_campaigns WHERE id=old.id)='1';
 RAISE NOTICE 'Passed replacement with no audience, sent history preservation, unsent cancellation, replay idempotency, service-only review rejection';
END $$;
