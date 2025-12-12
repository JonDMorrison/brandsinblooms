-- Backfill total_sent for campaigns that were sent but have 0 total_sent
UPDATE crm_campaigns c
SET 
  total_sent = subquery.total_emails,
  sent_at = COALESCE(c.sent_at, NOW())
FROM (
  SELECT 
    campaign_id,
    SUM(emails_sent) as total_emails
  FROM email_send_jobs
  GROUP BY campaign_id
) subquery
WHERE c.id = subquery.campaign_id
AND c.status IN ('sent', 'sent_with_errors')
AND (c.total_sent IS NULL OR c.total_sent = 0);