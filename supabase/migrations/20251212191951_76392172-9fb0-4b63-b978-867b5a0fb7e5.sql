-- Reset Jeff's campaign jobs again for the final test
UPDATE email_send_jobs 
SET status = 'pending', 
    attempts = 0, 
    emails_sent = 0, 
    emails_failed = 0, 
    error_message = NULL,
    updated_at = NOW()
WHERE campaign_id = 'f7f81513-81af-48bc-a83b-87e4c32e58c0';

-- Reset the campaign too
UPDATE crm_campaigns 
SET total_sent = 0, 
    metrics = NULL, 
    status = 'draft'
WHERE id = 'f7f81513-81af-48bc-a83b-87e4c32e58c0';