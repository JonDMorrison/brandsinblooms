-- Locked templates (Newsletter Builder 2.0, Milestone D).
--
-- A designer can lock a saved template. An email started from a locked
-- template keeps that design: people without the design permission can
-- change words, photos, prices, dates and links, and nothing else. The rule
-- is enforced here, in the database, so autosave, direct API calls and
-- service-role writers are all held to it.
--
-- Existing templates stay open. Nothing changes until a template is locked.

ALTER TABLE public.saved_campaign_templates
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- The design an email is held to: a snapshot taken when the email was
-- started, so later changes to the template never alter existing emails.
CREATE TABLE IF NOT EXISTS public.crm_campaign_template_locks (
  campaign_id uuid PRIMARY KEY REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  template_id uuid,
  template_name text,
  layout jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_campaign_template_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_campaign_template_locks FROM PUBLIC, anon, authenticated;

-- Does the current caller hold the design permission? False for anyone
-- without a signed-in CRM role, which includes service-role writers.
CREATE OR REPLACE FUNCTION public.current_user_can_design()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN coalesce(public.get_current_crm_access()->'permissions' ? 'content.design', false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.current_user_can_design() FROM PUBLIC, anon, authenticated;

-- A block with its editable content removed. What is left is the design.
CREATE OR REPLACE FUNCTION public.campaign_block_design(p_block jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_block - ARRAY[
    'headline', 'subheading', 'body', 'tagLabel', 'tagline', 'dateLabel', 'caption', 'label',
    'imageUrl', 'imageAlt', 'linkUrl', 'buttonText', 'buttonUrl', 'videoUrl',
    'productName', 'productSubtitle', 'productPrice', 'originalPrice', 'productDescription', 'badgeText',
    'quoteText', 'authorName', 'authorTitle', 'authorImageUrl', 'authorAvatarUrl',
    'eventDate', 'eventStartDate', 'eventStartTime', 'eventLocation', 'eventFeeType', 'eventFeeAmount',
    'couponOffer', 'couponAmount', 'couponPrice', 'couponRegularPrice', 'couponBundlePrice',
    'couponConditions', 'couponExpiry', 'couponBarcode', 'couponBarcodeImageUrl', 'couponBarcodeFormat',
    'careLight', 'careWater', 'careSoil', 'careHardiness', 'careSeason', 'careTips', 'careSource',
    'tableCaption', 'tableHeaders', 'tableRows', 'chartData', 'chartDataText', 'chartUnit',
    'textColumns', 'links', 'images', 'products', 'badges', 'socialLinks',
    'connectedContent', 'connectedContentSource'
  ];
$$;

-- Same blocks, same order, same design. Only content may differ.
CREATE OR REPLACE FUNCTION public.campaign_blocks_match_locked_layout(p_blocks jsonb, p_layout jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_blocks) = 'array'
    AND jsonb_typeof(p_layout) = 'array'
    AND jsonb_array_length(p_blocks) = jsonb_array_length(p_layout)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS b(block, pos)
      JOIN jsonb_array_elements(p_layout) WITH ORDINALITY AS l(block, pos) USING (pos)
      WHERE public.campaign_block_design(b.block) IS DISTINCT FROM public.campaign_block_design(l.block)
    );
$$;
REVOKE ALL ON FUNCTION public.campaign_block_design(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.campaign_blocks_match_locked_layout(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- Emails: take the lock when an email is started from a locked template,
-- then hold every later save to it.
CREATE OR REPLACE FUNCTION public.enforce_campaign_template_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lock public.crm_campaign_template_locks;
  v_template public.saved_campaign_templates;
  v_template_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT l.* INTO v_lock FROM public.crm_campaign_template_locks l WHERE l.campaign_id = NEW.id;
  END IF;

  IF v_lock.campaign_id IS NULL THEN
    -- Not locked yet. Lock it if it names a locked template of this tenant.
    IF NEW.metadata IS NULL OR NOT (NEW.metadata ? 'lockedTemplateId') THEN
      RETURN NEW;
    END IF;
    BEGIN
      v_template_id := (NEW.metadata->>'lockedTemplateId')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
    SELECT t.* INTO v_template FROM public.saved_campaign_templates t
    WHERE t.id = v_template_id AND t.tenant_id = NEW.tenant_id AND t.is_locked;
    IF v_template.id IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
      -- The row does not exist yet; the AFTER INSERT trigger records the lock.
      RETURN NEW;
    END IF;
    INSERT INTO public.crm_campaign_template_locks (campaign_id, tenant_id, template_id, template_name, layout, created_by)
    VALUES (NEW.id, NEW.tenant_id, v_template.id, v_template.name, v_template.layout_json, auth.uid())
    ON CONFLICT (campaign_id) DO NOTHING;
    SELECT l.* INTO v_lock FROM public.crm_campaign_template_locks l WHERE l.campaign_id = NEW.id;
  END IF;

  -- Locked. A save that does not touch the blocks is never held up, so
  -- status, metrics and sending updates always pass.
  IF TG_OP = 'UPDATE'
     AND NEW.metadata->'contentBlocks' IS NOT DISTINCT FROM OLD.metadata->'contentBlocks' THEN
    RETURN NEW;
  END IF;
  IF public.campaign_blocks_match_locked_layout(coalesce(NEW.metadata->'contentBlocks', '[]'::jsonb), v_lock.layout) THEN
    RETURN NEW;
  END IF;
  -- The design changed. A designer may do that, and their design becomes
  -- the one this email is held to. Everyone else is refused.
  IF public.current_user_can_design() THEN
    UPDATE public.crm_campaign_template_locks
       SET layout = coalesce(NEW.metadata->'contentBlocks', '[]'::jsonb)
     WHERE campaign_id = NEW.id;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This email uses a locked design'
    USING ERRCODE = '23514',
          HINT = 'You can change words, photos, prices, dates and links. Ask a designer to change the layout or styling.';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_campaign_template_lock() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_campaign_template_lock_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_template public.saved_campaign_templates;
  v_template_id uuid;
BEGIN
  IF NEW.metadata IS NULL OR NOT (NEW.metadata ? 'lockedTemplateId') THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_template_id := (NEW.metadata->>'lockedTemplateId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  SELECT t.* INTO v_template FROM public.saved_campaign_templates t
  WHERE t.id = v_template_id AND t.tenant_id = NEW.tenant_id AND t.is_locked;
  IF v_template.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.current_user_can_design()
     AND NOT public.campaign_blocks_match_locked_layout(coalesce(NEW.metadata->'contentBlocks', '[]'::jsonb), v_template.layout_json) THEN
    RAISE EXCEPTION 'This email uses a locked design'
      USING ERRCODE = '23514',
            HINT = 'You can change words, photos, prices, dates and links. Ask a designer to change the layout or styling.';
  END IF;
  INSERT INTO public.crm_campaign_template_locks (campaign_id, tenant_id, template_id, template_name, layout, created_by)
  VALUES (NEW.id, NEW.tenant_id, v_template.id, v_template.name, v_template.layout_json, auth.uid())
  ON CONFLICT (campaign_id) DO NOTHING;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_campaign_template_lock_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_campaigns_template_lock ON public.crm_campaigns;
CREATE TRIGGER crm_campaigns_template_lock
  BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_template_lock();

DROP TRIGGER IF EXISTS crm_campaigns_template_lock_insert ON public.crm_campaigns;
CREATE TRIGGER crm_campaigns_template_lock_insert
  AFTER INSERT ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.record_campaign_template_lock_on_insert();

-- Templates: only someone with the design permission may lock or unlock a
-- template, or change the design of a locked one.
CREATE OR REPLACE FUNCTION public.protect_locked_campaign_template()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_locked AND NOT public.current_user_can_design() THEN
      RAISE EXCEPTION 'Only a designer can lock a template' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked AND NOT public.current_user_can_design() THEN
      RAISE EXCEPTION 'Only a designer can delete a locked template' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW.is_locked IS DISTINCT FROM OLD.is_locked
      OR (OLD.is_locked AND NEW.layout_json IS DISTINCT FROM OLD.layout_json))
     AND NOT public.current_user_can_design() THEN
    RAISE EXCEPTION 'Only a designer can change a locked template' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_locked_campaign_template() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS saved_campaign_templates_lock_guard ON public.saved_campaign_templates;
CREATE TRIGGER saved_campaign_templates_lock_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.saved_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION public.protect_locked_campaign_template();

-- What the app asks: is this email held to a locked design, and may I change it?
CREATE OR REPLACE FUNCTION public.get_campaign_template_lock(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
  v_lock public.crm_campaign_template_locks;
BEGIN
  IF NOT coalesce(v_access->'permissions' ? 'campaigns.read', false) THEN
    RAISE EXCEPTION 'Campaign permission required' USING ERRCODE = '42501';
  END IF;
  SELECT l.* INTO v_lock FROM public.crm_campaign_template_locks l
  WHERE l.campaign_id = p_campaign_id AND l.tenant_id = v_tenant;
  RETURN jsonb_build_object(
    'locked', v_lock.campaign_id IS NOT NULL,
    'templateName', v_lock.template_name,
    'canDesign', coalesce(v_access->'permissions' ? 'content.design', false)
  );
END;
$$;

-- A designer can release one email from its locked design.
CREATE OR REPLACE FUNCTION public.release_campaign_template_lock(p_campaign_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_access jsonb := public.get_current_crm_access();
  v_tenant uuid := (v_access->>'tenantId')::uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(v_access->'permissions' ? 'content.design', false) THEN
    RAISE EXCEPTION 'Only a designer can unlock this email' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.crm_campaign_template_locks l
  WHERE l.campaign_id = p_campaign_id AND l.tenant_id = v_tenant;
  UPDATE public.crm_campaigns c SET metadata = c.metadata - 'lockedTemplateId'
  WHERE c.id = p_campaign_id AND c.tenant_id = v_tenant AND c.metadata ? 'lockedTemplateId';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_campaign_template_lock(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_campaign_template_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_template_lock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_campaign_template_lock(uuid) TO authenticated;
