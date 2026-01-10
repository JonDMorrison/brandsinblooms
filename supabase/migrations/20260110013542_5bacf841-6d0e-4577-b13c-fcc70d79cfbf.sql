-- Update provider_connections CHECK constraint to include constant_contact
ALTER TABLE public.provider_connections 
DROP CONSTRAINT provider_connections_provider_check;

ALTER TABLE public.provider_connections 
ADD CONSTRAINT provider_connections_provider_check 
CHECK (provider = ANY (ARRAY['mailchimp'::text, 'klaviyo'::text, 'constant_contact'::text]));

-- Also check and update import_jobs if it has a similar constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.import_jobs'::regclass 
    AND conname = 'import_jobs_provider_check'
  ) THEN
    ALTER TABLE public.import_jobs DROP CONSTRAINT import_jobs_provider_check;
    ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_provider_check 
    CHECK (provider = ANY (ARRAY['mailchimp'::text, 'klaviyo'::text, 'constant_contact'::text]));
  END IF;
END $$;

-- Update customer_sources if it has a source_type constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.customer_sources'::regclass 
    AND conname = 'customer_sources_source_type_check'
  ) THEN
    ALTER TABLE public.customer_sources DROP CONSTRAINT customer_sources_source_type_check;
    ALTER TABLE public.customer_sources ADD CONSTRAINT customer_sources_source_type_check 
    CHECK (source_type = ANY (ARRAY['mailchimp'::text, 'klaviyo'::text, 'constant_contact'::text, 'csv'::text, 'manual'::text, 'pos'::text, 'api'::text]));
  END IF;
END $$;