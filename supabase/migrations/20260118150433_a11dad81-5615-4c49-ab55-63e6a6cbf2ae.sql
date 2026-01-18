-- Mark queued outbox messages as failed to stop them from being sent
UPDATE crm_outbox 
SET status = 'failed', updated_at = NOW()
WHERE id IN (
  '90aa7e5e-c152-4d3e-94ec-7611b1bc6199',
  'a309098d-a63d-415d-acf1-e31d83ddbc19',
  '24591eda-29e3-4e2a-8cc5-1795e70c8d85'
);

-- Cancel all active automation runs for this customer
UPDATE automation_runs 
SET status = 'cancelled', updated_at = NOW()
WHERE id IN (
  'a7345424-4cf8-4e5e-ad56-fa87e7ac453c',
  '44a87adf-b67c-4d7c-af2b-75e60c9b1b29',
  'bfc46232-23b6-4e6c-bc62-8f23b211da93'
);