-- Milestone 4: Remove engagement-based suppression
-- Objective: customers must not remain suppressed due to inactivity / no opens.
-- This migration clears suppression flags only for records whose suppressed_reason indicates engagement inactivity.

UPDATE public.crm_customers
SET
  suppressed = false,
  suppressed_at = NULL,
  suppressed_reason = NULL
WHERE
  suppressed = true
  AND suppressed_reason IS NOT NULL
  AND (
    suppressed_reason ILIKE '%no email opens%'
    OR suppressed_reason ILIKE '%inactivity%'
    OR suppressed_reason ILIKE '%engagement%'
    OR suppressed_reason ILIKE '%180 days%'
  );

NOTIFY pgrst, 'reload schema';
