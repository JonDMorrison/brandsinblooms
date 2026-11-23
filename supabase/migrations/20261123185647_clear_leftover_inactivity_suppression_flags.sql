-- Clears crm_customers.suppressed flags left over from the retired
-- engagement-based suppression (Milestone 4, 20260222130500).
--
-- The nightly inactivity job kept setting "No email opens in 180 days" until
-- 2026-02-28, after the Milestone 4 cleanup had already run, so those rows
-- were never cleared. Sending has ignored this flag since Milestone 5
-- (suppression_list is canonical), so this changes no send; it only stops
-- other screens showing these contacts as suppressed.
--
-- Same criteria as 20260222130500. Rows when written: 96,483
-- (13b62ff0-…: 96,083; 36bd97b6-…: 399; 502fca55-…: 1).
-- Other suppression reasons (e.g. demo_synthetic_data) are untouched.

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
