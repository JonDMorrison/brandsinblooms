-- A Crystal grouped total must not masquerade as a dated purchase visit.
-- Provider-specific guard; existing POS/e-commerce providers are unaffected.
ALTER TABLE public.customer_purchase_line_items
  ADD CONSTRAINT ideal_line_requires_source_keys CHECK (
    source IS DISTINCT FROM 'ideal'
    OR (external_customer_code IS NOT NULL AND length(btrim(external_customer_code)) > 0
        AND external_transaction_id IS NOT NULL AND length(btrim(external_transaction_id)) > 0
        AND external_line_id IS NOT NULL AND length(btrim(external_line_id)) > 0
        AND purchased_at IS NOT NULL)
  ) NOT VALID;
ALTER TABLE public.customer_purchase_line_items VALIDATE CONSTRAINT ideal_line_requires_source_keys;

CREATE UNIQUE INDEX IF NOT EXISTS customer_ideal_unique_source_line
  ON public.customer_purchase_line_items
    (tenant_id,external_customer_code,external_transaction_id,external_line_id)
  WHERE source='ideal';
