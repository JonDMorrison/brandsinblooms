-- One tenant is one garden-center company. Locations live beneath that tenant,
-- customers remain shared, and access is granted at company or location scope.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY[
    'owner'::text,
    'admin'::text,
    'marketing'::text,
    'store_manager'::text,
    'staff'::text,
    'team'::text -- legacy role; retains its existing company-wide access
  ]));

CREATE TABLE IF NOT EXISTS public.tenant_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  code text,
  external_location_id text,
  timezone text NOT NULL DEFAULT 'UTC',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, external_location_id)
);

-- Composite parent keys make every location relationship tenant-safe. The
-- entity UUIDs remain globally unique; these additional keys let foreign keys
-- reject a valid entity ID paired with the wrong tenant ID.
ALTER TABLE public.users
  ADD CONSTRAINT users_tenant_id_id_key UNIQUE (tenant_id, id);
ALTER TABLE public.crm_customers
  ADD CONSTRAINT crm_customers_tenant_id_id_key UNIQUE (tenant_id, id);
ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_tenant_id_id_key UNIQUE (tenant_id, id);
ALTER TABLE public.crm_segments
  ADD CONSTRAINT crm_segments_tenant_id_id_key UNIQUE (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.user_location_access (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id),
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_location_access_tenant_location
  ON public.user_location_access(tenant_id, location_id, user_id);

CREATE OR REPLACE FUNCTION public.has_tenant_permission(
  p_tenant_id uuid,
  p_permission text,
  p_location_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_has_location boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_master_admin(v_user_id) THEN
    RETURN true;
  END IF;

  SELECT app_user.role
  INTO v_role
  FROM public.users AS app_user
  WHERE app_user.id = v_user_id
    AND app_user.tenant_id = p_tenant_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF p_location_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_location_access AS access
      WHERE access.user_id = v_user_id
        AND access.tenant_id = p_tenant_id
        AND access.location_id = p_location_id
    ) INTO v_has_location;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_location_access AS access
      WHERE access.user_id = v_user_id
        AND access.tenant_id = p_tenant_id
    ) INTO v_has_location;
  END IF;

  -- Existing admin/team accounts preserve their current access. New roles are
  -- explicit and can be location-bound without changing tenant ownership.
  IF v_role IN ('owner', 'admin', 'team') THEN
    RETURN true;
  END IF;

  CASE lower(coalesce(p_permission, ''))
    WHEN 'location.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND v_has_location);
    WHEN 'location.manage' THEN
      RETURN false;
    WHEN 'user.manage' THEN
      RETURN false;
    WHEN 'customer.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'customer.delete' THEN
      RETURN false;
    WHEN 'campaign.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'campaign.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'segment.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'segment.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'automation.read' THEN
      RETURN v_role = 'marketing';
    WHEN 'automation.write' THEN
      RETURN v_role = 'marketing';
    WHEN 'loyalty.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role IN ('store_manager', 'staff') AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'loyalty.write' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND p_location_id IS NOT NULL AND v_has_location);
    WHEN 'reporting.read' THEN
      RETURN v_role = 'marketing' OR
        (v_role = 'store_manager' AND v_has_location);
    WHEN 'export.customers' THEN
      RETURN false;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.has_tenant_permission(uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid, text, uuid)
  TO authenticated, service_role;

ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS primary_location_id uuid;
ALTER TABLE public.crm_customers
  DROP CONSTRAINT IF EXISTS crm_customers_primary_location_tenant_fkey;
ALTER TABLE public.crm_customers
  ADD CONSTRAINT crm_customers_primary_location_tenant_fkey
  FOREIGN KEY (tenant_id, primary_location_id)
  REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_primary_location
  ON public.crm_customers(tenant_id, primary_location_id)
  WHERE primary_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_location_activity (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  location_id uuid NOT NULL,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  visit_count integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  total_spend numeric(14,2) NOT NULL DEFAULT 0,
  loyalty_points_earned integer NOT NULL DEFAULT 0 CHECK (loyalty_points_earned >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, location_id),
  FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.crm_customers(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_location_activity_location
  ON public.customer_location_activity(tenant_id, location_id, customer_id);

ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS location_scope text NOT NULL DEFAULT 'all_locations',
  ADD COLUMN IF NOT EXISTS primary_location_id uuid;
ALTER TABLE public.crm_campaigns
  DROP CONSTRAINT IF EXISTS crm_campaigns_location_scope_check;
ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_location_scope_check
  CHECK (
    (location_scope = 'one_location' AND primary_location_id IS NOT NULL) OR
    (location_scope IN ('all_locations', 'selected_locations') AND primary_location_id IS NULL)
  );
ALTER TABLE public.crm_campaigns
  DROP CONSTRAINT IF EXISTS crm_campaigns_primary_location_tenant_fkey;
ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_primary_location_tenant_fkey
  FOREIGN KEY (tenant_id, primary_location_id)
  REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.campaign_location_targets (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, location_id),
  FOREIGN KEY (tenant_id, campaign_id)
    REFERENCES public.crm_campaigns(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE public.crm_segments
  ADD COLUMN IF NOT EXISTS location_scope text NOT NULL DEFAULT 'all_locations',
  ADD COLUMN IF NOT EXISTS primary_location_id uuid;
ALTER TABLE public.crm_segments
  DROP CONSTRAINT IF EXISTS crm_segments_location_scope_check;
ALTER TABLE public.crm_segments
  ADD CONSTRAINT crm_segments_location_scope_check
  CHECK (
    (location_scope = 'one_location' AND primary_location_id IS NOT NULL) OR
    (location_scope IN ('all_locations', 'selected_locations') AND primary_location_id IS NULL)
  );
ALTER TABLE public.crm_segments
  DROP CONSTRAINT IF EXISTS crm_segments_primary_location_tenant_fkey;
ALTER TABLE public.crm_segments
  ADD CONSTRAINT crm_segments_primary_location_tenant_fkey
  FOREIGN KEY (tenant_id, primary_location_id)
  REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.segment_location_targets (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, location_id),
  FOREIGN KEY (tenant_id, segment_id)
    REFERENCES public.crm_segments(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_location_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_location_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_location_targets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_locations, public.user_location_access,
  public.customer_location_activity, public.campaign_location_targets,
  public.segment_location_targets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_locations,
  public.user_location_access, public.customer_location_activity,
  public.campaign_location_targets, public.segment_location_targets
  TO authenticated;
GRANT ALL ON TABLE public.tenant_locations, public.user_location_access,
  public.customer_location_activity, public.campaign_location_targets,
  public.segment_location_targets TO service_role;

CREATE POLICY tenant_locations_select ON public.tenant_locations
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'location.read', id));
CREATE POLICY tenant_locations_manage ON public.tenant_locations
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'location.manage', id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'location.manage', id));

CREATE POLICY user_location_access_select ON public.user_location_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_tenant_permission(tenant_id, 'user.manage', location_id)
  );
CREATE POLICY user_location_access_manage ON public.user_location_access
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'user.manage', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'user.manage', location_id));

CREATE POLICY customer_location_activity_select ON public.customer_location_activity
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'customer.read', location_id));
CREATE POLICY customer_location_activity_manage ON public.customer_location_activity
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'customer.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'customer.write', location_id));

CREATE POLICY campaign_location_targets_select ON public.campaign_location_targets
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.read', location_id));
CREATE POLICY campaign_location_targets_manage ON public.campaign_location_targets
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'campaign.write', location_id));

CREATE POLICY segment_location_targets_select ON public.segment_location_targets
  FOR SELECT TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'segment.read', location_id));
CREATE POLICY segment_location_targets_manage ON public.segment_location_targets
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'segment.write', location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'segment.write', location_id));

-- Core CRM policies now understand location-bound roles. Existing admin/team
-- accounts still receive company-wide access through has_tenant_permission.
DROP POLICY IF EXISTS "Users can view customers for their tenant" ON public.crm_customers;
DROP POLICY IF EXISTS "Users can insert customers for their tenant" ON public.crm_customers;
DROP POLICY IF EXISTS "Users can update customers for their tenant" ON public.crm_customers;
DROP POLICY IF EXISTS "Users can delete customers for their tenant" ON public.crm_customers;

CREATE POLICY crm_customers_select_by_scope ON public.crm_customers
  FOR SELECT TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'customer.read', primary_location_id) OR
    EXISTS (
      SELECT 1
      FROM public.customer_location_activity AS activity
      WHERE activity.customer_id = crm_customers.id
        AND activity.tenant_id = crm_customers.tenant_id
        AND public.has_tenant_permission(
          activity.tenant_id,
          'customer.read',
          activity.location_id
        )
    )
  );
CREATE POLICY crm_customers_insert_by_scope ON public.crm_customers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    public.has_tenant_permission(tenant_id, 'customer.write', primary_location_id)
  );
CREATE POLICY crm_customers_update_by_scope ON public.crm_customers
  FOR UPDATE TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'customer.write', primary_location_id) OR
    EXISTS (
      SELECT 1
      FROM public.customer_location_activity AS activity
      WHERE activity.customer_id = crm_customers.id
        AND activity.tenant_id = crm_customers.tenant_id
        AND public.has_tenant_permission(
          activity.tenant_id,
          'customer.write',
          activity.location_id
        )
    )
  )
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'customer.write', primary_location_id) OR
    EXISTS (
      SELECT 1
      FROM public.customer_location_activity AS activity
      WHERE activity.customer_id = crm_customers.id
        AND activity.tenant_id = crm_customers.tenant_id
        AND public.has_tenant_permission(
          activity.tenant_id,
          'customer.write',
          activity.location_id
        )
    )
  );
CREATE POLICY crm_customers_delete_by_scope ON public.crm_customers
  FOR DELETE TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'customer.delete', primary_location_id));

DROP POLICY IF EXISTS "Users can manage campaigns for their tenant" ON public.crm_campaigns;
CREATE POLICY crm_campaigns_select_by_scope ON public.crm_campaigns
  FOR SELECT TO authenticated
  USING (
    (location_scope = 'all_locations' AND
      public.has_tenant_permission(tenant_id, 'campaign.read', NULL)) OR
    (location_scope = 'one_location' AND
      public.has_tenant_permission(tenant_id, 'campaign.read', primary_location_id)) OR
    (location_scope = 'selected_locations' AND EXISTS (
      SELECT 1
      FROM public.campaign_location_targets AS target
      WHERE target.campaign_id = crm_campaigns.id
        AND target.tenant_id = crm_campaigns.tenant_id
        AND public.has_tenant_permission(
          target.tenant_id,
          'campaign.read',
          target.location_id
        )
    ))
  );
CREATE POLICY crm_campaigns_manage_by_scope ON public.crm_campaigns
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'campaign.write', primary_location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'campaign.write', primary_location_id));

DROP POLICY IF EXISTS "Users can manage segments for their tenant" ON public.crm_segments;
CREATE POLICY crm_segments_select_by_scope ON public.crm_segments
  FOR SELECT TO authenticated
  USING (
    (location_scope = 'all_locations' AND
      public.has_tenant_permission(tenant_id, 'segment.read', NULL)) OR
    (location_scope = 'one_location' AND
      public.has_tenant_permission(tenant_id, 'segment.read', primary_location_id)) OR
    (location_scope = 'selected_locations' AND EXISTS (
      SELECT 1
      FROM public.segment_location_targets AS target
      WHERE target.segment_id = crm_segments.id
        AND target.tenant_id = crm_segments.tenant_id
        AND public.has_tenant_permission(
          target.tenant_id,
          'segment.read',
          target.location_id
        )
    ))
  );
CREATE POLICY crm_segments_manage_by_scope ON public.crm_segments
  FOR ALL TO authenticated
  USING (public.has_tenant_permission(tenant_id, 'segment.write', primary_location_id))
  WITH CHECK (public.has_tenant_permission(tenant_id, 'segment.write', primary_location_id));

DROP POLICY IF EXISTS "Users can manage customer segments for their tenant"
  ON public.customer_segments;
CREATE POLICY customer_segments_select_by_scope ON public.customer_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_customers AS customer
      JOIN public.crm_segments AS segment
        ON segment.tenant_id = customer.tenant_id
      WHERE customer.id = customer_segments.customer_id
        AND segment.id = customer_segments.segment_id
    )
  );
CREATE POLICY customer_segments_insert_by_scope ON public.customer_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.crm_customers AS customer
      JOIN public.crm_segments AS segment
        ON segment.tenant_id = customer.tenant_id
      WHERE customer.id = customer_segments.customer_id
        AND segment.id = customer_segments.segment_id
        AND public.has_tenant_permission(
          customer.tenant_id,
          'customer.write',
          customer.primary_location_id
        )
        AND public.has_tenant_permission(
          segment.tenant_id,
          'segment.write',
          segment.primary_location_id
        )
    )
  );
CREATE POLICY customer_segments_delete_by_scope ON public.customer_segments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.crm_customers AS customer
      JOIN public.crm_segments AS segment
        ON segment.tenant_id = customer.tenant_id
      WHERE customer.id = customer_segments.customer_id
        AND segment.id = customer_segments.segment_id
        AND public.has_tenant_permission(
          customer.tenant_id,
          'customer.write',
          customer.primary_location_id
        )
        AND public.has_tenant_permission(
          segment.tenant_id,
          'segment.write',
          segment.primary_location_id
        )
    )
  );

COMMENT ON TABLE public.tenant_locations IS
  'Garden-center store locations beneath one tenant/company.';
COMMENT ON TABLE public.customer_location_activity IS
  'Cross-location customer visit, spend, and loyalty rollup; customer identity remains tenant-wide.';
COMMENT ON FUNCTION public.has_tenant_permission(uuid, text, uuid) IS
  'Central company/location permission decision for owner, admin, marketing, store manager, staff, and legacy team roles.';
