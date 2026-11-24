-- #6: teammates can see each other's saved newsletter templates.
--
-- STATUS: applied 2026-11-24 with Jon's approval (recorded version
-- 20261124133026), together with closing the cross-tenant public read below.
-- Verified: a user from another business sees 0 templates; the author still
-- sees their own.
--
-- What changes
--   Adds one SELECT policy. Anyone with campaign.read or campaign.write on a
--   business can read that business's saved templates (tenant_id set), using
--   the same check as care_guide_designs / campaign_groups.
--
-- What does not change
--   - Insert, rename and archive/delete stay owner-only (the existing
--     "Users can manage their own saved templates" policy: auth.uid() =
--     user_id). Teammates can use a template, not edit or remove it.
--   - Templates saved without a business (tenant_id NULL) stay private to
--     their author.
--   - No rows are modified.
--
-- App side (already merged): useSavedTemplates reads the business's templates
-- from any author plus your own legacy ones, marks each with isOwn, and hides
-- Rename/Archive on teammates' templates. 
--
-- Data when written (2026-11-24): 3 templates, 3 authors, 3 businesses; no
-- business has templates from more than one person yet.

CREATE POLICY "Team members can view their business's saved templates"
  ON public.saved_campaign_templates
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND (
      public.has_tenant_permission(tenant_id, 'campaign.read'::text, NULL::uuid)
      OR public.has_tenant_permission(tenant_id, 'campaign.write'::text, NULL::uuid)
    )
  );

-- Closes a cross-tenant read: the old policy let ANY signed-in user, at any
-- business, read templates with is_public = true (0 rows used it). Templates
-- are now visible only to their author and their business's team.
DROP POLICY "Users can view public templates" ON public.saved_campaign_templates;
