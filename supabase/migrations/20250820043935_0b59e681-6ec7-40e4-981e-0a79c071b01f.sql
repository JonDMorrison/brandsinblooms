
-- Add persona targeting fields to SMS campaigns
ALTER TABLE public.crm_sms_campaigns
ADD COLUMN IF NOT EXISTS targeting_persona_ids uuid[] DEFAULT '{}'::uuid[],
ADD COLUMN IF NOT EXISTS targeting_persona_names text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS targeting_logic text DEFAULT 'any';

COMMENT ON COLUMN public.crm_sms_campaigns.targeting_persona_ids IS 'Selected persona IDs used for targeting/filtering.';
COMMENT ON COLUMN public.crm_sms_campaigns.targeting_persona_names IS 'Selected persona names (for readability/auditing).';
COMMENT ON COLUMN public.crm_sms_campaigns.targeting_logic IS 'How persona targeting is applied: "any" (default) or "all" intersection.';
