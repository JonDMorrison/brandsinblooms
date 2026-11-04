-- Bloom chat: clients may read their own company's website and point of sale data.
--
-- Decision (Jon, 2026-11-04): "Yes, clients should see their website and
-- point-of-sale data inside Bloom chat."
--
-- Staff keep their existing ops.site.read / ops.pos.read permissions and path.
-- This adds a separate, read-only client path that runRead uses only when the
-- staff permission check fails:
--   * client.site.read  : site.read, site.pages, event.list, site.preview_link
--   * client.pos.read   : pos.products, pos.inventory
--   * client.pos.sales  : pos.sales_summary, pos.price_history, and only for
--                         the company's CRM owner/admin users (public.users.role
--                         'owner' or 'admin' in that tenant). The POS limits
--                         sales figures to managers; this keeps them away from
--                         marketing, store_manager and staff CRM users.
-- No write permission is granted. Clients keep tickets.create / tickets.read_own.
--
-- Isolation: the principal must be an active CRM 'client' principal, a verified
-- member of the account, and currently a CRM user of the account's tenant
-- (checked live in public.users, so moving a user out of a tenant revokes it).

INSERT INTO bloom_support.role_permissions(role, permission) VALUES
  ('client', 'client.site.read'),
  ('client', 'client.pos.read'),
  ('client', 'client.pos.sales')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.bloom_support_client_suite_read(p_actor uuid, p_account uuid, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_permission text;
  v_principal bloom_support.principals;
  v_tenant uuid;
  v_crm_role text;
  v_reason text;
BEGIN
  v_permission := CASE p_kind
    WHEN 'site.read' THEN 'client.site.read'
    WHEN 'site.pages' THEN 'client.site.read'
    WHEN 'event.list' THEN 'client.site.read'
    WHEN 'site.preview_link' THEN 'client.site.read'
    WHEN 'pos.products' THEN 'client.pos.read'
    WHEN 'pos.inventory' THEN 'client.pos.read'
    WHEN 'pos.sales_summary' THEN 'client.pos.sales'
    WHEN 'pos.price_history' THEN 'client.pos.sales'
    ELSE NULL
  END;

  SELECT * INTO v_principal FROM bloom_support.principals WHERE id = p_actor AND active;
  SELECT a.crm_tenant_id INTO v_tenant FROM bloom_support.accounts a WHERE a.id = p_account;

  IF v_permission IS NULL THEN
    v_reason := 'not_client_readable';
  ELSIF v_principal.id IS NULL OR v_principal.role <> 'client' OR v_principal.auth_user_id IS NULL THEN
    v_reason := 'not_client';
  ELSIF NOT bloom_support.has_permission(p_actor, v_permission) THEN
    v_reason := 'no_permission';
  ELSIF v_tenant IS NULL OR NOT EXISTS (
    SELECT 1 FROM bloom_support.account_members m
    WHERE m.account_id = p_account AND m.principal_id = p_actor AND m.verified) THEN
    v_reason := 'account';
  ELSE
    SELECT u.role INTO v_crm_role FROM public.users u
    WHERE u.id = v_principal.auth_user_id AND u.tenant_id = v_tenant;
    IF v_crm_role IS NULL THEN
      v_reason := 'account';
    ELSIF v_permission = 'client.pos.sales' AND v_crm_role NOT IN ('owner', 'admin') THEN
      v_reason := 'owner_or_admin_only';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    -- Only record refusals against an account the person really belongs to.
    IF v_reason = 'owner_or_admin_only' THEN
      PERFORM bloom_support.log(NULL, p_account, p_actor, 'operation.read_denied',
        jsonb_build_object('kind', p_kind, 'access', 'client', 'reason', v_reason));
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', v_reason);
  END IF;

  -- The read is audited here: the generic audit route needs tickets.internal,
  -- which clients do not hold.
  PERFORM bloom_support.log(NULL, p_account, p_actor, 'operation.read',
    jsonb_build_object('kind', p_kind, 'access', 'client', 'crm_role', v_crm_role));
  RETURN jsonb_build_object('allowed', true, 'permission', v_permission, 'crm_role', v_crm_role);
END $$;

REVOKE ALL ON FUNCTION public.bloom_support_client_suite_read(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_client_suite_read(uuid, uuid, text) TO service_role;
