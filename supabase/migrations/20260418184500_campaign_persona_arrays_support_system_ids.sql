-- Allow system persona string identifiers alongside custom persona UUIDs.

ALTER TABLE public.crm_campaigns
  ALTER COLUMN persona_ids TYPE text[]
  USING COALESCE(persona_ids::text[], '{}'::text[]),
  ALTER COLUMN persona_ids SET DEFAULT '{}'::text[];

COMMENT ON COLUMN public.crm_campaigns.persona_ids IS
  'Unified persona identifiers for campaign targeting. Supports custom persona UUIDs and system persona string ids.';

ALTER TABLE public.crm_sms_campaigns
  ALTER COLUMN targeting_persona_ids TYPE text[]
  USING COALESCE(targeting_persona_ids::text[], '{}'::text[]),
  ALTER COLUMN targeting_persona_ids SET DEFAULT '{}'::text[];

COMMENT ON COLUMN public.crm_sms_campaigns.targeting_persona_ids IS
  'Unified persona identifiers for SMS targeting. Supports custom persona UUIDs and system persona string ids.';