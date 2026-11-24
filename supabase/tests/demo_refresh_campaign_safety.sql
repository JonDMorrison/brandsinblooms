-- newsletter-qa2 #1: the Northfield demo refresh must never change campaign
-- status, never bump updated_at, and only roll the rows it seeded
-- (metadata.demo_seed = true). Runs against the demo tenant and rolls back.
BEGIN;
CREATE TEMP TABLE before_c AS
  SELECT id, status, updated_at, sent_at, total_sent, metadata
    FROM public.crm_campaigns
   WHERE tenant_id = '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4';
SELECT intelligence_ops.refresh_greenfield_demo();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM before_c b JOIN public.crm_campaigns c USING (id)
              WHERE c.status IS DISTINCT FROM b.status) THEN
    RAISE EXCEPTION 'FAIL: refresh changed a campaign status';
  END IF;
  IF EXISTS (SELECT 1 FROM before_c b JOIN public.crm_campaigns c USING (id)
              WHERE c.updated_at IS DISTINCT FROM b.updated_at) THEN
    RAISE EXCEPTION 'FAIL: refresh bumped a campaign updated_at';
  END IF;
  IF EXISTS (SELECT 1 FROM before_c b JOIN public.crm_campaigns c USING (id)
              WHERE coalesce(b.metadata->>'demo_seed', '') <> 'true'
                AND (c.sent_at, c.total_sent, c.metadata) IS DISTINCT FROM (b.sent_at, b.total_sent, b.metadata)) THEN
    RAISE EXCEPTION 'FAIL: refresh touched a campaign it did not seed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.products
              WHERE tenant_id = '3eade43c-2e5a-4ad0-80fb-500e3d7afbd4'
                AND (name ILIKE '%greenfield%' OR description ILIKE '%greenfield%')) THEN
    RAISE EXCEPTION 'FAIL: customer-visible Greenfield product copy';
  END IF;
END $$;
ROLLBACK;
