-- Durable, user-owned membership snapshots. Clients cannot forge the server's results.
CREATE TABLE public.bloom_customer_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.bloom_conversations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.bloom_customer_sets(id) ON DELETE SET NULL,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 180),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bloom_customer_sets_conversation_idx ON public.bloom_customer_sets(tenant_id,user_id,conversation_id,created_at DESC);
ALTER TABLE public.bloom_customer_sets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bloom_customer_sets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bloom_customer_sets TO authenticated;
GRANT ALL ON public.bloom_customer_sets TO service_role;
CREATE POLICY bloom_customer_sets_read ON public.bloom_customer_sets FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND public.has_tenant_permission(tenant_id,'reports.read',NULL) AND public.has_tenant_permission(tenant_id,'customers.read',NULL));
COMMENT ON TABLE public.bloom_customer_sets IS 'Exact customer sets for conversational analysis. Immutable to clients; never an email-send queue. Cascade-deleted with the owning conversation.';
ALTER TABLE public.crm_segments ADD COLUMN IF NOT EXISTS analysis_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Earlier intelligence policies used customer.read, but the CRM permission is plural.
ALTER POLICY customer_purchase_line_items_select ON public.customer_purchase_line_items
USING (public.has_tenant_permission(tenant_id,'customers.read',NULL));
ALTER POLICY customer_intelligence_source_events_select ON public.customer_intelligence_source_events
USING (public.has_tenant_permission(tenant_id,'customers.read',NULL));
ALTER POLICY customer_intelligence_sources_select ON public.customer_intelligence_sources
USING (public.has_tenant_permission(tenant_id,'integrations.manage',NULL) OR public.has_tenant_permission(tenant_id,'reports.read',NULL));
