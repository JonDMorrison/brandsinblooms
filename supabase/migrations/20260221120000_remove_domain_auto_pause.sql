-- Milestone 1: Remove Automatic Domain Auto-Pause
-- Objective: domains must never be auto-paused based on bounce/complaint thresholds.

-- Drop the reputation-based auto-pause trigger/function (created in earlier migrations)
DROP TRIGGER IF EXISTS trigger_check_domain_reputation ON public.email_domains;
DROP FUNCTION IF EXISTS public.check_domain_reputation();

-- Safety cleanup: restore domains that were auto-paused by previous logic
-- Only touch domains that are not manually paused AND have auto-pause notes.
UPDATE public.email_domains
SET
  status = 'active',
  updated_at = now(),
  notes = CASE
    WHEN notes IS NULL THEN NULL
    ELSE regexp_replace(notes, E'\\n\\[[^\\]]+\\] Auto-paused due to reputation issues\\.[^\\n]*', '', 'g')
  END
WHERE
  status = 'paused'
  AND manual_pause = false
  AND (
    notes ILIKE '%Auto-paused%'
    OR notes ILIKE '%AUTO-PAUSED%'
  );
