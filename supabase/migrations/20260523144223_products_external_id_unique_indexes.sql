-- Add unique composite indexes for external-source idempotency.
-- Required for safe upsert behavior when importing products from Shopify,
-- Lightspeed, Square, Stripe, or manual import sources.
-- Without these, ON CONFLICT clauses cannot target external_id correctly
-- and reruns of importers will create duplicate rows.

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_source_external
  ON public.products(tenant_id, source, external_id)
  WHERE external_id IS NOT NULL AND source != 'platform';

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variations_product_external
  ON public.product_variations(product_id, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON INDEX idx_products_tenant_source_external IS
  'Idempotency key for external-source product imports (shopify, lightspeed, square, etc). Required for ON CONFLICT upserts.';

COMMENT ON INDEX idx_product_variations_product_external IS
  'Idempotency key for external-source variant imports. Required for ON CONFLICT upserts.';
