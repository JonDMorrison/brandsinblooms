-- Drafts that were opened and abandoned: still a draft, never scheduled or
-- sent, no subject, no block with content, and not edited for 24 hours.
-- A block has content when it has any text, image or button (headers,
-- dividers, spacers and the footer never count). Drafts another row points
-- at (copies, push messages) or under website review are always kept.
--
-- Not scheduled: run per tenant by an admin until the automatic schedule
-- is approved. p_dry_run (default true) only lists what would be deleted.
CREATE OR REPLACE FUNCTION public.delete_stale_empty_campaign_drafts(
  p_tenant_id uuid,
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE (draft_id uuid, draft_name text, last_edited_at timestamptz, was_deleted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'A tenant is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT c.id, c.name, c.updated_at
      FROM public.crm_campaigns c
     WHERE c.tenant_id = p_tenant_id
       AND c.status = 'draft'
       AND c.scheduled_at IS NULL
       AND c.sent_at IS NULL
       AND coalesce(trim(c.subject_line), '') = ''
       AND c.updated_at < now() - interval '24 hours'
       AND coalesce(c.send_blocked_reason, '') = ''
       AND nullif(c.metadata->>'contentReviewReplacementId', '') IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.crm_campaigns copy WHERE copy.source_campaign_id = c.id)
       AND NOT EXISTS (SELECT 1 FROM public.crm_push_messages pm WHERE pm.campaign_id = c.id)
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(
                  CASE WHEN jsonb_typeof(c.metadata->'contentBlocks') = 'array'
                       THEN c.metadata->'contentBlocks' ELSE '[]'::jsonb END) b
          WHERE CASE
                  WHEN b->>'type' IN ('footer', 'divider', 'spacer', 'newsletter-header') THEN false
                  WHEN b->>'type' NOT IN ('plain-text', 'text', 'headline', 'quote', 'image', 'full-width-image', 'image-text') THEN true
                  ELSE regexp_replace(
                         coalesce(b->>'body', '') || coalesce(b->>'headline', '') || coalesce(b->>'subheading', '') ||
                         coalesce(b->>'quoteText', '') || coalesce(b->>'imageUrl', '') || coalesce(b->>'buttonText', '') ||
                         coalesce(b->>'content', ''),
                         '<[^>]*>|&nbsp;|\s', '', 'g') <> ''
                END
       )
  ),
  removed_blocks AS (
    DELETE FROM public.campaign_blocks cb
     USING candidates
     WHERE NOT p_dry_run AND cb.campaign_id = candidates.id
    RETURNING cb.campaign_id
  ),
  removed AS (
    DELETE FROM public.crm_campaigns c
     USING candidates
     WHERE NOT p_dry_run AND c.id = candidates.id
    RETURNING c.id
  )
  SELECT candidates.id, candidates.name, candidates.updated_at,
         EXISTS (SELECT 1 FROM removed WHERE removed.id = candidates.id)
    FROM candidates;
END $$;

REVOKE ALL ON FUNCTION public.delete_stale_empty_campaign_drafts(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_stale_empty_campaign_drafts(uuid, boolean) TO service_role;
