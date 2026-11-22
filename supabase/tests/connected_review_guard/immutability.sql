-- Run after both replacement acceptance scripts in a disposable fixture database.
CREATE FUNCTION pg_temp.must_reject(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN check_violation THEN RETURN; END;
 RAISE EXCEPTION 'Expected review guard rejection: %',statement;
END $$;
DO $$ DECLARE email_id uuid:='00000000-0000-4000-8000-000000000010'; sms_id uuid; new_email uuid; new_sms uuid; state text; statement text; BEGIN
 SELECT id,(metrics->>'replacement_campaign_id')::uuid INTO sms_id,new_sms FROM crm_sms_campaigns WHERE metrics ? 'replacement_campaign_id';
 SELECT (metadata->>'contentReviewReplacementId')::uuid INTO new_email FROM crm_campaigns WHERE id=email_id;
 FOREACH state IN ARRAY ARRAY['draft','scheduled','queued','sending','enqueuing','processing','partially_queued'] LOOP
  PERFORM pg_temp.must_reject(format('UPDATE crm_campaigns SET status=%L WHERE id=%L',state,email_id));
  PERFORM pg_temp.must_reject(format('UPDATE crm_sms_campaigns SET status=%L WHERE id=%L',state,sms_id));
 END LOOP;
 FOREACH statement IN ARRAY ARRAY[
  'send_blocked_reason=NULL','content=''rewritten''','subject_line=''rewritten''','auto_send_enabled=true',
  'metadata=metadata-''contentReviewReplacementId''','metadata=jsonb_set(metadata,''{replyTo}'',''"other@example.test"'')',
  'scheduled_at=now()','include_all_customers=false','tenant_id=gen_random_uuid()'
 ] LOOP PERFORM pg_temp.must_reject(format('UPDATE crm_campaigns SET %s WHERE id=%L',statement,email_id)); END LOOP;
 FOREACH statement IN ARRAY ARRAY[
  'message=''rewritten''','metrics=metrics-''replacement_campaign_id''','metrics=metrics-''content_review''',
  'connected_content_sources=''[]''','audience_confirmed=false','scheduled_at=now()',
  'metrics=jsonb_set(metrics,''{segment_filter}'',''{"type":"all"}'')','tenant_id=gen_random_uuid()'
 ] LOOP PERFORM pg_temp.must_reject(format('UPDATE crm_sms_campaigns SET %s WHERE id=%L',statement,sms_id)); END LOOP;
 PERFORM pg_temp.must_reject(format('INSERT INTO campaign_blocks(campaign_id,content) VALUES(%L,''{}'')',email_id));
 PERFORM pg_temp.must_reject(format('UPDATE campaign_blocks SET campaign_id=%L WHERE campaign_id=%L',email_id,new_email));
 -- Replacement remains editable and old counters/provider results remain writable.
 UPDATE crm_campaigns SET content='Edited reviewed draft' WHERE id=new_email;
 UPDATE crm_sms_campaigns SET message='Edited reviewed draft' WHERE id=new_sms;
 UPDATE crm_sms_campaigns SET metrics=metrics||'{"delivered":2}',updated_at=now() WHERE id=sms_id;
 UPDATE crm_campaigns SET status='sent',updated_at=now() WHERE id=email_id;
 UPDATE email_messages SET status='sent',resend_id='late-reconciled' WHERE claim_token IS NOT NULL;
 ASSERT (SELECT count(*)=2 FROM email_messages WHERE resend_id='late-reconciled'), 'provider reconciliation remains writable';
 ASSERT (SELECT metrics->>'delivered'='2' FROM crm_sms_campaigns WHERE id=sms_id),'counters preserved';
 RAISE NOTICE 'Review guard: 33 rejected changes plus editable replacements, counters and late provider reconciliation passed';
END $$;
-- Existing old blocks cannot be edited/deleted/reparented after a hold begins.
INSERT INTO crm_campaigns(id,tenant_id,status,auto_send_enabled,include_all_customers,metadata) VALUES('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000001','draft',false,false,'{}');
INSERT INTO campaign_blocks(campaign_id,content) VALUES('00000000-0000-4000-8000-000000000020','{}');
UPDATE crm_campaigns SET status='paused',send_blocked_reason='connected_content_review' WHERE id='00000000-0000-4000-8000-000000000020';
SELECT pg_temp.must_reject($q$UPDATE campaign_blocks SET content='{"text":"overwrite"}' WHERE campaign_id='00000000-0000-4000-8000-000000000020'$q$);
SELECT pg_temp.must_reject($q$DELETE FROM campaign_blocks WHERE campaign_id='00000000-0000-4000-8000-000000000020'$q$);
SELECT pg_temp.must_reject($q$UPDATE campaign_blocks SET campaign_id=NULL WHERE campaign_id='00000000-0000-4000-8000-000000000020'$q$);
