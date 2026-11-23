BEGIN;
-- Where a newsletter started: blank, a weekly theme, a template, a duplicate,
-- the website, AI, the calendar or an automation. Written once at insert and
-- never changed afterwards, so "start from our theme" and "start from scratch"
-- can be measured. Format: '<kind>' or '<kind>:<reference>'.
ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS origin text;

ALTER TABLE public.crm_campaigns DROP CONSTRAINT IF EXISTS crm_campaigns_origin_format_check;
ALTER TABLE public.crm_campaigns ADD CONSTRAINT crm_campaigns_origin_format_check CHECK (
  origin IS NULL OR origin ~ '^(blank|weekly_theme|saved_template|starter_template|holiday|persona|duplicate|review|website_import|ai|calendar|automation)(:[A-Za-z0-9_.:-]{1,200})?$'
);

COMMENT ON COLUMN public.crm_campaigns.origin IS
  'How the campaign was started, set once at insert: blank | weekly_theme:<campaigns.id or master:<week>> | saved_template:<id> | starter_template:<id> | holiday:<id> | persona:<id> | duplicate:<crm_campaigns.id> | review:<crm_campaigns.id> | website_import[:<item>] | ai[:<detail>] | calendar | automation. NULL = created before origin tracking.';

CREATE INDEX IF NOT EXISTS crm_campaigns_origin_kind_idx
  ON public.crm_campaigns (tenant_id, (split_part(origin, ':', 1)))
  WHERE origin IS NOT NULL;

-- Insert defaults and immutability. Inserters that do not pass an origin but
-- carry a provable parent (clone paths, the website review RPC) get one here,
-- so every copy path is covered without each caller remembering to set it.
-- Email rows also always get a plain-text SMS draft key, so the editor never
-- has to fall back to `content` (the rendered HTML) for it.
CREATE OR REPLACE FUNCTION public.crm_campaigns_origin_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.origin IS NULL THEN
      IF nullif(NEW.metadata->>'reviewedFromCampaignId', '') IS NOT NULL THEN
        NEW.origin := 'review:' || (NEW.metadata->>'reviewedFromCampaignId');
      ELSIF NEW.source_campaign_id IS NOT NULL THEN
        NEW.origin := 'duplicate:' || NEW.source_campaign_id::text;
      END IF;
    END IF;
    IF coalesce(NEW.metadata->>'campaignType', 'email') = 'email'
       AND NEW.metadata IS NOT NULL
       AND jsonb_typeof(NEW.metadata) = 'object'
       AND (NOT (NEW.metadata ? 'smsMessage')
            OR coalesce(NEW.metadata->>'smsMessage', '') ~* '^\s*<(!doctype|html|head|body|table|div)\M') THEN
      NEW.metadata := NEW.metadata || jsonb_build_object('smsMessage', '');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: origin is permanent once set.
  IF OLD.origin IS NOT NULL THEN
    NEW.origin := OLD.origin;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.crm_campaigns_origin_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_campaigns_origin_guard ON public.crm_campaigns;
CREATE TRIGGER crm_campaigns_origin_guard
  BEFORE INSERT OR UPDATE OF origin ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.crm_campaigns_origin_guard();

-- Backfill only what is provable from existing columns.
UPDATE public.crm_campaigns
   SET origin = 'review:' || (metadata->>'reviewedFromCampaignId')
 WHERE origin IS NULL
   AND nullif(metadata->>'reviewedFromCampaignId', '') IS NOT NULL;

UPDATE public.crm_campaigns
   SET origin = 'duplicate:' || source_campaign_id::text
 WHERE origin IS NULL
   AND source_campaign_id IS NOT NULL;

UPDATE public.crm_campaigns
   SET origin = 'duplicate:' || (metadata->>'cloned_from')
 WHERE origin IS NULL
   AND (metadata->>'cloned_from') ~ '^[0-9a-f-]{36}$';

-- Five email drafts had their rendered HTML copied into metadata.smsMessage by
-- an editor fallback (fixed in campaignEditor.extractSmsMessage). None was
-- sent and the SMS sender never reads this field; clear the bad copies.
-- Reviewed originals are skipped: their metadata is locked by trigger, and
-- smsMessage is not a protected field, but we avoid touching them at all.
UPDATE public.crm_campaigns
   SET metadata = metadata || jsonb_build_object('smsMessage', '')
 WHERE coalesce(metadata->>'campaignType', 'email') = 'email'
   AND coalesce(metadata->>'smsMessage', '') ~* '^\s*<(!doctype|html|head|body|table|div)\M'
   AND send_blocked_reason IS DISTINCT FROM 'connected_content_review'
   AND nullif(metadata->>'contentReviewReplacementId', '') IS NULL;
COMMIT;
