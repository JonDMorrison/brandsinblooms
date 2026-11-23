BEGIN;
-- Weekly themes get images so a newsletter can start from "this week's theme
-- and images". master_campaign_templates.theme_images is the curated global
-- set; campaigns.theme_images is the tenant's own set for that week (filled
-- once, then shared by everyone in the tenant so drafts stay consistent).
-- Each entry: {"url": "https://...", "alt": "...", "credit": "..."}.
ALTER TABLE public.master_campaign_templates
  ADD COLUMN IF NOT EXISTS theme_images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS theme_images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.master_campaign_templates DROP CONSTRAINT IF EXISTS master_campaign_templates_theme_images_array;
ALTER TABLE public.master_campaign_templates ADD CONSTRAINT master_campaign_templates_theme_images_array
  CHECK (jsonb_typeof(theme_images) = 'array' AND jsonb_array_length(theme_images) <= 12);
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_theme_images_array;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_theme_images_array
  CHECK (jsonb_typeof(theme_images) = 'array' AND jsonb_array_length(theme_images) <= 12);

-- Tenant members may record images for their own tenant's weekly theme even
-- when another member created the row (campaigns UPDATE RLS is owner-only).
-- First write wins, so every member sees the same images for the week.
CREATE OR REPLACE FUNCTION public.set_weekly_theme_images(p_campaign_id uuid, p_images jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.campaigns;
  v_clean jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.campaigns c WHERE c.id = p_campaign_id AND c.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Weekly theme not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_row.tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = v_row.tenant_id))
    OR (v_row.tenant_id IS NULL AND v_row.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not allowed for this weekly theme' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(v_row.theme_images) > 0 THEN
    RETURN v_row.theme_images;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'url', e->>'url',
           'alt', left(coalesce(e->>'alt', ''), 300),
           'credit', left(coalesce(e->>'credit', ''), 200))), '[]'::jsonb)
    INTO v_clean
    FROM (
      SELECT e FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_images) = 'array' THEN p_images ELSE '[]'::jsonb END) e
      WHERE jsonb_typeof(e) = 'object'
        AND (e->>'url') ~ '^https://[^\s"''<>]{4,1500}$'
      LIMIT 6
    ) s;

  UPDATE public.campaigns SET theme_images = v_clean WHERE id = p_campaign_id;
  RETURN v_clean;
END $$;

REVOKE ALL ON FUNCTION public.set_weekly_theme_images(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_weekly_theme_images(uuid, jsonb) TO authenticated;

-- auto-generate-weekly-campaigns ran every Monday and created no campaigns
-- (no crm_campaigns row has ever had synced_from or metadata.auto_generated).
-- If it had worked it would have created empty drafts with no content.
-- Weekly themes now start a newsletter from the studio instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-weekly-campaigns') THEN
    PERFORM cron.unschedule('auto-generate-weekly-campaigns');
  END IF;
END $$;
COMMIT;
