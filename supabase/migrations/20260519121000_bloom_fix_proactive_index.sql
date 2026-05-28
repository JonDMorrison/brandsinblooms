-- BLOOM-FIX-02: replace proactive insight expiry indexes with a stable lookup index.
-- Using now() in a partial-index predicate is not reliable for a forward-only schema contract,
-- so keep expiry filtering at query time and index the tenant-scoped recency path instead.

DROP INDEX IF EXISTS public.idx_bloom_proactive_insights_unexpiring;
DROP INDEX IF EXISTS public.idx_bloom_proactive_insights_expiring;

DO $$
BEGIN
  IF to_regclass('public.bloom_proactive_insights') IS NOT NULL THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_bloom_proactive_insights_tenant_created_at
        ON public.bloom_proactive_insights (tenant_id, created_at DESC)
    ';
  END IF;
END $$;