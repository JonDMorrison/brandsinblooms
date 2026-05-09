ALTER TABLE public.crm_segments
ADD COLUMN IF NOT EXISTS include_all_customers boolean NOT NULL DEFAULT false;
