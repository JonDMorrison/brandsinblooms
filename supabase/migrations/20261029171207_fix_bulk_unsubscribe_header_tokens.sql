-- Replace the legacy base64 unsubscribe header with the same opaque token
-- used by the renderer. PostgreSQL base64 output wraps at 76 characters.
CREATE OR REPLACE FUNCTION public.apply_bulk_email_unsubscribe_headers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_headers jsonb;
BEGIN
  IF NEW.payload IS NULL OR jsonb_typeof(NEW.payload) <> 'object' THEN
    RETURN NEW;
  END IF;
  -- Only real recipients can have actionable preference links.
  IF NEW.customer_id IS NULL OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT token INTO v_token
  FROM public.crm_email_preference_tokens
  WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id
    AND purpose = 'manage_preferences' AND expires_at > now() + interval '30 days'
  ORDER BY expires_at DESC LIMIT 1;
  IF v_token IS NULL THEN
    -- This function remains SECURITY INVOKER. Token access retains existing RLS.
    IF NOT EXISTS (
      SELECT 1 FROM public.crm_customers
      WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Email recipient does not belong to the sending account';
    END IF;
    v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
    INSERT INTO public.crm_email_preference_tokens
      (tenant_id,customer_id,email,token,purpose,expires_at)
    VALUES (NEW.tenant_id,NEW.customer_id,NEW.email,v_token,
      'manage_preferences',now() + interval '2 years');
  END IF;
  IF v_token !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid email preference token format';
  END IF;
  v_headers := CASE WHEN jsonb_typeof(NEW.payload->'headers')='object'
    THEN NEW.payload->'headers' ELSE '{}'::jsonb END;
  NEW.payload := jsonb_set(NEW.payload,'{headers}',v_headers || jsonb_build_object(
    'List-Unsubscribe','<https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?token=' || v_token || '>',
    'List-Unsubscribe-Post','List-Unsubscribe=One-Click'),true);
  RETURN NEW;
END;
$$;

-- Repair pending snapshots without changing their status or sending anything.
UPDATE public.email_messages SET payload=payload,updated_at=now()
WHERE resend_id IS NULL AND status IN ('queued','paused')
  AND customer_id IS NOT NULL AND tenant_id IS NOT NULL AND payload IS NOT NULL;
