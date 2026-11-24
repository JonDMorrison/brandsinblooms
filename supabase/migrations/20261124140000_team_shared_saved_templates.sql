-- #6: teammates can see each other's saved newsletter templates.
--
-- STATUS: written for review, NOT applied. Apply with Supabase MCP
-- apply_migration once approved, then rename this file to the recorded
-- version. Merging to main does not apply it (only *bloom_support* files
-- auto-apply).
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
-- Rename/Archive on teammates' templates. Until this policy is applied, RLS
-- still returns only your own templates, so the app works either way.
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

-- Separate finding, deliberately NOT changed here (needs its own decision):
-- the existing "Users can view public templates" policy lets ANY signed-in
-- user, at any business, read templates with is_public = true. 0 rows use it
-- today, but CampaignTemplatesModal exposes an is_public switch. Proposed
-- follow-up if you want it closed:
--
--   DROP POLICY "Users can view public templates" ON public.saved_campaign_templates;
