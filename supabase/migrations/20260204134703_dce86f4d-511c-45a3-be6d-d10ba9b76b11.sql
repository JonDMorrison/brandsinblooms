-- Create RPC to get overdue campaigns count by tenant
CREATE OR REPLACE FUNCTION public.get_overdue_campaigns(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  overdue_count BIGINT,
  oldest_scheduled_at TIMESTAMPTZ,
  campaign_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.tenant_id,
    t.name AS tenant_name,
    COUNT(*)::BIGINT AS overdue_count,
    MIN(c.scheduled_at) AS oldest_scheduled_at,
    ARRAY_AGG(c.id) AS campaign_ids
  FROM crm_campaigns c
  LEFT JOIN tenants t ON t.id = c.tenant_id
  WHERE c.status = 'scheduled'
    AND c.scheduled_at IS NOT NULL
    AND c.scheduled_at < NOW() - INTERVAL '10 minutes'
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  GROUP BY c.tenant_id, t.name
  ORDER BY MIN(c.scheduled_at) ASC;
END;
$function$;

-- Create a simpler version for single-tenant use
CREATE OR REPLACE FUNCTION public.get_my_overdue_campaigns()
RETURNS TABLE (
  overdue_count BIGINT,
  oldest_scheduled_at TIMESTAMPTZ,
  campaigns JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the caller's tenant_id from their profile
  SELECT cp.id INTO v_tenant_id
  FROM company_profiles cp
  WHERE cp.user_id = auth.uid();
  
  -- If no tenant found, try tenant_users
  IF v_tenant_id IS NULL THEN
    SELECT tu.tenant_id INTO v_tenant_id
    FROM tenant_users tu
    WHERE tu.user_id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS overdue_count,
    MIN(c.scheduled_at) AS oldest_scheduled_at,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', c.id,
          'name', c.name,
          'scheduled_at', c.scheduled_at,
          'send_attempts', COALESCE(c.send_attempts, 0)
        )
        ORDER BY c.scheduled_at ASC
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::JSON
    ) AS campaigns
  FROM crm_campaigns c
  WHERE c.status = 'scheduled'
    AND c.scheduled_at IS NOT NULL
    AND c.scheduled_at < NOW() - INTERVAL '10 minutes'
    AND c.tenant_id = v_tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.get_overdue_campaigns IS 
'Returns overdue campaigns (scheduled > 10 min ago) grouped by tenant. Pass NULL for all tenants (admin use).';

COMMENT ON FUNCTION public.get_my_overdue_campaigns IS 
'Returns overdue campaigns for the current user''s tenant.';

-- Add index for efficient overdue queries
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_overdue 
ON crm_campaigns (tenant_id, scheduled_at) 
WHERE status = 'scheduled';