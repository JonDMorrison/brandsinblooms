-- =====================================================
-- FormSubmitted Event Emitter
-- Phase 3: Automation Integration for Form Builder
-- =====================================================

-- Add form_id column to automation_trigger_events if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_trigger_events' 
    AND column_name = 'form_id'
  ) THEN
    ALTER TABLE public.automation_trigger_events 
    ADD COLUMN form_id uuid REFERENCES public.forms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add submission_id column to automation_trigger_events if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_trigger_events' 
    AND column_name = 'submission_id'
  ) THEN
    ALTER TABLE public.automation_trigger_events 
    ADD COLUMN submission_id uuid REFERENCES public.form_submissions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add metadata column if not exists (for consent snapshot and extra payload)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'automation_trigger_events' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.automation_trigger_events 
    ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for form-based event lookups
CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_form_id 
ON public.automation_trigger_events(form_id) 
WHERE form_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_trigger_events_submission_id 
ON public.automation_trigger_events(submission_id) 
WHERE submission_id IS NOT NULL;

-- =====================================================
-- Trigger Function: emit_form_submitted_event
-- 
-- Fires AFTER INSERT on form_submissions
-- Only emits for accepted submissions
-- Async and non-blocking (simple INSERT, no external calls)
-- Wrapped in exception handler - failures are logged, not propagated
-- =====================================================

CREATE OR REPLACE FUNCTION public.emit_form_submitted_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent_snapshot jsonb;
BEGIN
  -- Only emit for accepted submissions
  IF NEW.result != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Build consent snapshot from metadata
  v_consent_snapshot := jsonb_build_object(
    'email_consent', COALESCE((NEW.metadata->>'email_consent')::boolean, false),
    'email_consent_text', NEW.metadata->>'email_consent_text',
    'email_consent_at', NEW.metadata->>'email_consent_at',
    'sms_consent', COALESCE((NEW.metadata->>'sms_consent')::boolean, false),
    'sms_consent_text', NEW.metadata->>'sms_consent_text',
    'sms_consent_at', NEW.metadata->>'sms_consent_at'
  );

  -- Insert trigger event (async - picked up by existing process-trigger-events worker)
  -- Wrapped in exception block to ensure submission succeeds even if event emission fails
  BEGIN
    INSERT INTO public.automation_trigger_events (
      tenant_id,
      customer_id,
      event_type,
      form_id,
      submission_id,
      metadata,
      created_at
    ) VALUES (
      NEW.tenant_id,
      NEW.customer_id,
      'form_submitted',
      NEW.form_id,
      NEW.id,
      jsonb_build_object(
        'form_id', NEW.form_id,
        'submission_id', NEW.id,
        'customer_id', NEW.customer_id,
        'tenant_id', NEW.tenant_id,
        'timestamp', NEW.submitted_at,
        'consent', v_consent_snapshot,
        'referrer', NEW.metadata->>'referrer',
        'page_url', NEW.metadata->>'page_url'
      ),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but do NOT propagate - submission must succeed
    RAISE WARNING 'FormSubmitted event emission failed for submission %: %', NEW.id, SQLERRM;
  END;

  -- Always return NEW to ensure submission succeeds
  RETURN NEW;
END;
$$;

-- =====================================================
-- Attach Trigger to form_submissions
-- AFTER INSERT ensures submission is already committed
-- =====================================================

DROP TRIGGER IF EXISTS trg_emit_form_submitted_event ON public.form_submissions;

CREATE TRIGGER trg_emit_form_submitted_event
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_form_submitted_event();

-- =====================================================
-- Documentation
-- =====================================================

COMMENT ON FUNCTION public.emit_form_submitted_event() IS 
'Phase 3 Form Builder automation trigger. Emits form_submitted event to automation_trigger_events after successful form submission. Non-blocking: failures are logged but do not affect submission success.';