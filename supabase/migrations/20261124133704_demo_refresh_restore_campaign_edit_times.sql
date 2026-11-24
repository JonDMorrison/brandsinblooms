-- newsletter-qa2 #1 (follow-up to 20261124133624): the first version of the
-- trigger replaced NEW.updated_at with OLD.updated_at in preserve mode, which
-- also discarded the restore in that migration. In preserve mode the trigger now
-- leaves NEW.updated_at as the statement set it (the old value unless the
-- statement sets one), and the restore is re-run.
--
-- Result at the demo tenant: 33 campaigns that carried the 2026-11-24 11:17 UTC
-- refresh timestamp now show their latest recorded block edit (or created_at
-- when no block exists).

CREATE OR REPLACE FUNCTION public.update_crm_campaigns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- A maintenance job can set app.preserve_campaign_updated_at = 'on' (transaction
  -- local) so its writes do not count as edits; the row keeps whatever
  -- updated_at the statement leaves on it (the old value unless it sets one).
  IF coalesce(current_setting('app.preserve_campaign_updated_at', true), '') <> 'on' THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

SELECT set_config('app.preserve_campaign_updated_at', 'on', true);

WITH real_edit AS (
  SELECT c.id,
         greatest(
           c.created_at,
           (SELECT max(b.updated_at) FROM public.campaign_blocks b WHERE b.campaign_id = c.id),
           (SELECT max(v.created_at) FROM public.campaign_block_versions v WHERE v.campaign_id = c.id)
         ) AS edited_at
    FROM public.crm_campaigns c
   WHERE c.tenant_id = '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4'
     AND c.updated_at = '2026-11-24 11:17:00.175009+00'
)
UPDATE public.crm_campaigns c
   SET updated_at = real_edit.edited_at
  FROM real_edit
 WHERE c.id = real_edit.id;

SELECT set_config('app.preserve_campaign_updated_at', 'off', true);
