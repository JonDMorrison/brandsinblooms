ALTER TABLE public.provider_artifacts
  DROP CONSTRAINT IF EXISTS provider_artifacts_provider_check;

ALTER TABLE public.provider_artifacts
  ADD CONSTRAINT provider_artifacts_provider_check
  CHECK (
    provider IN ('mailchimp', 'klaviyo', 'constant_contact')
  );