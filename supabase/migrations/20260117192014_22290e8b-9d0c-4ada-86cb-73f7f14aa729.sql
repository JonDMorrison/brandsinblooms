-- Remove all automation data for customer furqanhameedjutt.311@gmail.com
-- Customer ID: 5ac20588-ed15-42ee-87ab-bfedac0ad269

-- Step 1: Delete all outbox entries (emails and SMS)
DELETE FROM crm_outbox
WHERE customer_id = '5ac20588-ed15-42ee-87ab-bfedac0ad269';

-- Step 2: Delete all automation runs
DELETE FROM automation_runs
WHERE customer_id = '5ac20588-ed15-42ee-87ab-bfedac0ad269';