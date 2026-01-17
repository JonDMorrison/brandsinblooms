-- Complete the active automation run (this already succeeded)
UPDATE automation_runs 
SET status = 'completed', 
    completed_at = NOW()
WHERE id = '16e6b3e4-7c94-4ccf-903c-73d895daef8b';

-- Delete the queued outbox entry instead of cancelling
DELETE FROM crm_outbox 
WHERE id = 'fbec53db-7b72-4512-b277-33cb906f1661';