-- Create the customer_360_enriched view
DROP VIEW IF EXISTS public.customer_360_enriched;

CREATE OR REPLACE VIEW public.customer_360_enriched AS
SELECT 
  c.id,
  c.tenant_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.created_at,
  c.updated_at,
  
  -- Identity metrics
  c.created_at AS first_seen_at,
  c.updated_at AS last_seen_at,
  im.signup_source,
  im.signup_campaign,
  im.preferred_channel,
  im.city,
  im.state_region,
  im.postal_code,
  im.country_code,
  im.timezone,
  im.store_id,
  im.store_name,
  
  -- Email metrics
  COALESCE(em.total_sent, 0) AS email_total_sent,
  COALESCE(em.total_delivered, 0) AS email_total_delivered,
  COALESCE(em.total_opened, 0) AS email_total_opened,
  COALESCE(em.total_clicked, 0) AS email_total_clicked,
  COALESCE(em.total_bounced, 0) AS email_total_bounced,
  COALESCE(em.total_unsubscribes, 0) AS email_total_unsubscribes,
  COALESCE(em.open_rate, 0) AS email_open_rate,
  COALESCE(em.click_rate, 0) AS email_click_rate,
  COALESCE(em.bounce_rate, 0) AS email_bounce_rate,
  em.last_sent_at AS email_last_sent_at,
  em.last_opened_at AS email_last_opened_at,
  em.last_clicked_at AS email_last_clicked_at,
  
  -- SMS metrics (enhanced)
  COALESCE(sm.total_sent, 0) AS sms_total_sent,
  COALESCE(sm.total_delivered, 0) AS sms_total_delivered,
  COALESCE(sm.total_clicked, 0) AS sms_total_clicked,
  COALESCE(sm.total_failed, 0) AS sms_total_failed,
  COALESCE(sm.total_replied, 0) AS sms_total_replied,
  COALESCE(sm.total_opt_outs, 0) AS sms_total_opt_outs,
  COALESCE(sm.delivery_rate, 0) AS sms_delivery_rate,
  COALESCE(sm.click_rate, 0) AS sms_click_rate,
  COALESCE(sm.reply_rate, 0) AS sms_reply_rate,
  COALESCE(sm.opt_out_rate, 0) AS sms_opt_out_rate,
  COALESCE(sm.avg_time_to_response_minutes, 0) AS sms_avg_response_time_minutes,
  COALESCE(sm.engagement_score, 0) AS sms_engagement_score,
  sm.last_sent_at AS sms_last_sent_at,
  sm.last_delivered_at AS sms_last_delivered_at,
  sm.last_clicked_at AS sms_last_clicked_at,
  sm.last_replied_at AS sms_last_replied_at,
  sm.last_opt_out_at AS sms_last_opt_out_at,
  
  -- Engagement summary
  COALESCE(es.overall_engagement_score, 0) AS engagement_overall_score,
  COALESCE(es.email_score, 0) AS engagement_email_score,
  COALESCE(es.sms_score, 0) AS engagement_sms_score,
  COALESCE(es.purchase_score, 0) AS engagement_purchase_score,
  es.engagement_tier,
  es.last_calculated_at AS engagement_last_calculated_at
  
FROM public.crm_customers c
LEFT JOIN public.customer_identity_metrics im ON im.customer_id = c.id
LEFT JOIN public.customer_email_metrics em ON em.customer_id = c.id
LEFT JOIN public.customer_sms_metrics sm ON sm.customer_id = c.id
LEFT JOIN public.customer_engagement_summary es ON es.customer_id = c.id;

GRANT SELECT ON public.customer_360_enriched TO authenticated;