-- Reset stuck automation run from before the delay parsing fix
UPDATE public.automation_runs 
SET status = 'failed', 
    error_message = 'Reset: Invalid time value bug from previous code version', 
    completed_at = now()
WHERE id = '09986211-5f9e-4047-89c0-a7668ebfb076'
  AND status = 'active';