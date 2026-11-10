-- Map the existing Slack staff identities to the existing Bloom Support principals.
-- No new account, elevated permission, or third-party scope is created.
-- Only service-role code may resolve this map after verifying Slack HMAC, team,
-- channel, Slack user ID allowlist, and the per-user support permission.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

CREATE TABLE IF NOT EXISTS bloom_support.slack_staff_principals (
  slack_user_id text PRIMARY KEY CHECK (slack_user_id ~ '^[UW][A-Z0-9]{8,24}$'),
  principal_id uuid NOT NULL REFERENCES bloom_support.principals(id),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bloom_support.slack_staff_principals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE bloom_support.slack_staff_principals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE bloom_support.slack_staff_principals TO service_role;

-- Slack users and CRM identities were independently verified before this migration.
-- Match established staff roles and emails, not hard-coded generated principal IDs.
INSERT INTO bloom_support.slack_staff_principals (slack_user_id, principal_id)
SELECT 'U06VD9ZGA4U', id FROM bloom_support.principals
WHERE lower(email) = 'jon@getclear.ca' AND role = 'platform_admin' AND active = true
ON CONFLICT (slack_user_id) DO NOTHING;

INSERT INTO bloom_support.slack_staff_principals (slack_user_id, principal_id)
SELECT 'U06V7U9LWSZ', id FROM bloom_support.principals
WHERE lower(email) = 'jeff@brandsinblooms.com' AND role = 'platform_operator' AND active = true
ON CONFLICT (slack_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bloom_support_slack_staff_actor(p_slack_user_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object('principal_id', pr.id, 'role', pr.role)
  FROM bloom_support.slack_staff_principals link
  JOIN bloom_support.principals pr ON pr.id = link.principal_id
  WHERE link.slack_user_id = p_slack_user_id
    AND link.enabled
    AND pr.active
    AND pr.role IN ('platform_admin', 'platform_operator')
    AND bloom_support.has_permission(pr.id, 'ops.site.read')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bloom_support_slack_staff_actor(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bloom_support_slack_staff_actor(text)
  TO service_role;
