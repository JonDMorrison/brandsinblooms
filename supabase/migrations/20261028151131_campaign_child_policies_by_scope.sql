-- Align newsletter child records with the parent campaign's tenant permissions.
-- The old policy joined public.users and rejected authorized master-admin edits
-- to a different garden centre, causing saves to fail after the campaign insert.
-- Reads use campaign.read; writes use campaign.write. Both are tenant checked.

ALTER TABLE public.campaign_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage blocks for their tenant campaigns" ON public.campaign_blocks;
DROP POLICY IF EXISTS "campaign_blocks_authorized_select" ON public.campaign_blocks;
CREATE POLICY "campaign_blocks_authorized_select" ON public.campaign_blocks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_blocks.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.read', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_blocks_authorized_insert" ON public.campaign_blocks;
CREATE POLICY "campaign_blocks_authorized_insert" ON public.campaign_blocks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_blocks.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_blocks_authorized_update" ON public.campaign_blocks;
CREATE POLICY "campaign_blocks_authorized_update" ON public.campaign_blocks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_blocks.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_blocks.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_blocks_authorized_delete" ON public.campaign_blocks;
CREATE POLICY "campaign_blocks_authorized_delete" ON public.campaign_blocks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_blocks.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));

ALTER TABLE public.campaign_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage campaign segments for their tenant campaigns" ON public.campaign_segments;
DROP POLICY IF EXISTS "campaign_segments_authorized_select" ON public.campaign_segments;
CREATE POLICY "campaign_segments_authorized_select" ON public.campaign_segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_segments.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.read', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_segments_authorized_insert" ON public.campaign_segments;
CREATE POLICY "campaign_segments_authorized_insert" ON public.campaign_segments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_segments.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_segments_authorized_update" ON public.campaign_segments;
CREATE POLICY "campaign_segments_authorized_update" ON public.campaign_segments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_segments.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_segments.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_segments_authorized_delete" ON public.campaign_segments;
CREATE POLICY "campaign_segments_authorized_delete" ON public.campaign_segments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_segments.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));

ALTER TABLE public.campaign_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage campaign personas for their tenant campaigns" ON public.campaign_personas;
DROP POLICY IF EXISTS "campaign_personas_authorized_select" ON public.campaign_personas;
CREATE POLICY "campaign_personas_authorized_select" ON public.campaign_personas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_personas.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.read', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_personas_authorized_insert" ON public.campaign_personas;
CREATE POLICY "campaign_personas_authorized_insert" ON public.campaign_personas FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_personas.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_personas_authorized_update" ON public.campaign_personas;
CREATE POLICY "campaign_personas_authorized_update" ON public.campaign_personas FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_personas.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_personas.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));
DROP POLICY IF EXISTS "campaign_personas_authorized_delete" ON public.campaign_personas;
CREATE POLICY "campaign_personas_authorized_delete" ON public.campaign_personas FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.crm_campaigns AS campaign WHERE campaign.id = campaign_personas.campaign_id AND public.has_tenant_permission(campaign.tenant_id, 'campaign.write', campaign.primary_location_id)));

