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

-- Save a frozen audience atomically and idempotently. Only the trusted server
-- can invoke this function, after it has checked current user permissions.
CREATE OR REPLACE FUNCTION public.save_bloom_customer_set_segment(p_set_id uuid,p_user_id uuid,p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_set public.bloom_customer_sets; v_segment uuid; v_expected integer; v_actual integer;
BEGIN
  SELECT * INTO v_set FROM public.bloom_customer_sets WHERE id=p_set_id FOR UPDATE;
  IF NOT FOUND OR p_user_id IS NULL OR v_set.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Customer set is not accessible' USING ERRCODE='42501';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'A segment name is required'; END IF;
  IF jsonb_typeof(v_set.payload->'included_ids') <> 'array' THEN RAISE EXCEPTION 'Invalid audience snapshot'; END IF;
  v_expected := jsonb_array_length(v_set.payload->'included_ids');
  IF v_expected=0 THEN RAISE EXCEPTION 'Cannot save an empty audience'; END IF;
  SELECT id INTO v_segment FROM public.crm_segments
    WHERE tenant_id=v_set.tenant_id AND source='bloom_customer_set' AND source_id=p_set_id::text
      AND lower(name)=lower(btrim(p_name)) AND deleted_at IS NULL LIMIT 1;
  IF v_segment IS NOT NULL THEN
    RETURN jsonb_build_object('id',v_segment,'name',btrim(p_name),'kind','static','reused',true);
  END IF;
  IF EXISTS(SELECT 1 FROM public.crm_segments WHERE tenant_id=v_set.tenant_id AND lower(name)=lower(btrim(p_name)) AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'A segment with this name already exists';
  END IF;
  SELECT count(DISTINCT c.id) INTO v_actual FROM jsonb_array_elements_text(v_set.payload->'included_ids') AS member(value)
    JOIN public.crm_customers c ON c.id=member.value::uuid AND c.tenant_id=v_set.tenant_id
    WHERE c.deleted_at IS NULL AND c.merged_into_customer_id IS NULL;
  IF v_actual<>v_expected THEN RAISE EXCEPTION 'Audience membership changed; create a new reviewed result'; END IF;
  INSERT INTO public.crm_segments(tenant_id,user_id,name,description,conditions,customer_count,auto_update,status,source,source_id,analysis_provenance)
  VALUES(v_set.tenant_id,p_user_id,btrim(p_name),'Static snapshot from Bloom customer analysis. No messages have been sent.','{}'::jsonb,v_actual,false,'active','bloom_customer_set',p_set_id::text,
    jsonb_build_object('set_id',p_set_id,'captured_at',v_set.created_at,'trail',v_set.payload->'trail',
      'original_count',v_expected,'excluded_count',jsonb_array_length(v_set.payload->'excluded_ids'),'unknown_count',jsonb_array_length(v_set.payload->'unknown_ids')))
  RETURNING id INTO v_segment;
  INSERT INTO public.customer_segments(customer_id,segment_id,assigned_by_user_id)
  SELECT member.value::uuid,v_segment,p_user_id FROM jsonb_array_elements_text(v_set.payload->'included_ids') AS member(value);
  RETURN jsonb_build_object('id',v_segment,'name',btrim(p_name),'kind','static','customer_count',v_actual,'source_set_id',p_set_id,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.save_bloom_customer_set_segment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_bloom_customer_set_segment(uuid,uuid,text) TO service_role;
