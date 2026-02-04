-- Reset the stuck campaign to allow retry
UPDATE crm_campaigns 
SET status = 'scheduled', 
    sent_at = NULL, 
    send_blocked_reason = NULL
WHERE id = '0745c22f-6396-47e5-b66f-904d334a4aeb';