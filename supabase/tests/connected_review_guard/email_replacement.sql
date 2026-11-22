SELECT set_config('test.uid','00000000-0000-4000-8000-000000000003',false),set_config('test.tenant','00000000-0000-4000-8000-000000000001',false);
INSERT INTO crm_connected_websites VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','active');
INSERT INTO crm_campaigns(id,tenant_id,name,status,send_blocked_reason,updated_at,metadata,include_all_customers,auto_send_enabled) VALUES ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','Review me','paused','connected_content_review','2026-11-22','{"includeAllCustomers":true,"replyTo":"hello@flowers.test"}',true,true);
INSERT INTO email_messages(campaign_id,tenant_id,status,resend_id,claim_token,delivery_reconciliation_required)
SELECT '00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',s,r,c,q FROM (VALUES
 ('queued',null,null::uuid,false),('paused',null,null::uuid,false),('sent','receipt',null::uuid,false),
 ('sending',null,'00000000-0000-4000-8000-000000000099'::uuid,false),
 ('queued',null,'00000000-0000-4000-8000-000000000099'::uuid,false),('failed',null,null::uuid,true)) x(s,r,c,q);
INSERT INTO email_send_jobs(campaign_id,tenant_id,status,claim_token,recipient_message_ids)
SELECT '00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001',s,c,'{}'::uuid[] FROM (VALUES ('pending',null::uuid),('paused',null::uuid),('in_progress','00000000-0000-4000-8000-000000000099'::uuid)) x(s,c);
DO $$ DECLARE replacement uuid; replay uuid; manifest jsonb := '[{"id":"block","type":"image-text","headline":"Current","connectedContent":{"siteId":"00000000-0000-4000-8000-000000000002","itemId":"item","type":"page","updatedAt":"2026-11-22","publicUrl":"https://flowers.test/new"}}]'; BEGIN
 BEGIN
  PERFORM replace_connected_email_draft('00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000010','2026-11-22',manifest,'html');
  RAISE EXCEPTION 'cross tenant accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM replace_connected_email_draft('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','2026-11-21',manifest,'html');
  RAISE EXCEPTION 'stale accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Campaign changed. Refresh the review before continuing' THEN RAISE; END IF; END;
 replacement := replace_connected_email_draft('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','2026-11-22',manifest,'html');
 replay := replace_connected_email_draft('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','2026-11-22',manifest,'html');
 ASSERT replacement=replay, 'replay must reuse replacement';
 ASSERT (SELECT count(*)=2 FROM crm_campaigns), 'one replacement';
 ASSERT (SELECT status='draft' AND scheduled_at IS NULL AND NOT include_all_customers AND NOT auto_send_enabled AND cardinality(additional_customer_ids)=0 AND segment_id IS NULL AND cardinality(persona_ids)=0 AND projected_recipient_count=0 AND metadata->'includeAllCustomers'='false'::jsonb FROM crm_campaigns WHERE id=replacement), 'unscheduled no audience';
 ASSERT (SELECT status='paused' AND NOT auto_send_enabled FROM crm_campaigns WHERE id='00000000-0000-4000-8000-000000000010'), 'old stays paused';
 ASSERT (SELECT count(*)=1 FROM campaign_blocks WHERE campaign_id=replacement AND content->'connectedContent'->>'updatedAt'='2026-11-22'), 'backup manifest preserved';
 ASSERT (SELECT count(*)=2 FROM email_messages WHERE status='skipped' AND dead_lettered_at IS NOT NULL), 'unclaimed unsent stopped';
 ASSERT (SELECT count(*)=1 FROM email_messages WHERE status='sent' AND resend_id='receipt'), 'receipt preserved';
 ASSERT (SELECT count(*)=2 FROM email_messages WHERE claim_token IS NOT NULL), 'live claims preserved';
 ASSERT (SELECT count(*)=1 FROM email_messages WHERE delivery_reconciliation_required), 'uncertain outcome preserved';
 ASSERT (SELECT count(*)=2 FROM email_send_jobs WHERE status='failed'), 'unclaimed jobs stopped';
 ASSERT (SELECT count(*)=1 FROM email_send_jobs WHERE status='in_progress' AND claim_token IS NOT NULL), 'inflight job preserved';
 ASSERT NOT has_function_privilege('anon','replace_connected_email_draft(uuid,uuid,timestamptz,jsonb,text)','execute'), 'anon denied';
 RAISE NOTICE 'Email replacement acceptance passed';
END $$;
