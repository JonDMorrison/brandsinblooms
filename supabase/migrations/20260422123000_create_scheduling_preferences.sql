BEGIN;

CREATE TABLE IF NOT EXISTS public.scheduling_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  optimal_times TEXT[] NOT NULL DEFAULT ARRAY['12:00', '18:00']::TEXT[],
  frequency TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduling_preferences_platform_check CHECK (
    platform IN ('facebook', 'instagram', 'google_my_business')
  ),
  CONSTRAINT scheduling_preferences_frequency_check CHECK (
    frequency IN ('daily', 'weekly', 'biweekly', 'monthly')
  ),
  CONSTRAINT scheduling_preferences_user_platform_key UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_scheduling_preferences_user_id
  ON public.scheduling_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_scheduling_preferences_created_at
  ON public.scheduling_preferences (created_at);

ALTER TABLE public.scheduling_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scheduling_preferences TO authenticated;
GRANT ALL ON TABLE public.scheduling_preferences TO service_role;

DROP POLICY IF EXISTS "Users can manage their own scheduling preferences"
  ON public.scheduling_preferences;

CREATE POLICY "Users can manage their own scheduling preferences"
  ON public.scheduling_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_scheduling_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_scheduling_preferences_updated_at
  ON public.scheduling_preferences;

CREATE TRIGGER trg_update_scheduling_preferences_updated_at
BEFORE UPDATE ON public.scheduling_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduling_preferences_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;