-- VMX POS API integration schema additions

-- Indexes on pos_connections for VMX queries
CREATE INDEX IF NOT EXISTS idx_pos_connections_tenant_platform
  ON public.pos_connections (tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_pos_connections_tenant_active
  ON public.pos_connections (tenant_id, is_active);

-- pos_receipts: stores individual POS receipts with line items
CREATE TABLE IF NOT EXISTS public.pos_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pos_connection_id uuid NOT NULL REFERENCES public.pos_connections(id) ON DELETE CASCADE,
  external_receipt_id text NOT NULL,
  external_customer_id text,
  post_date timestamptz,
  subtotal numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2) GENERATED ALWAYS AS (COALESCE(subtotal,0) + COALESCE(tax,0)) STORED,
  division_id text,
  line_items jsonb,
  raw_payload jsonb,
  imported_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, pos_connection_id, external_receipt_id)
);

ALTER TABLE public.pos_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_receipts_tenant_isolation ON public.pos_receipts
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_pos_receipts_tenant_date
  ON public.pos_receipts (tenant_id, post_date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_tenant_customer
  ON public.pos_receipts (tenant_id, external_customer_id);

-- Ensure crm_customers has columns needed for POS sync
ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS pos_source text,
  ADD COLUMN IF NOT EXISTS total_spent numeric(12,2),
  ADD COLUMN IF NOT EXISTS last_visit_date timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent boolean,
  ADD COLUMN IF NOT EXISTS email_consent boolean;

-- Unique partial index for POS customer deduplication
CREATE UNIQUE INDEX IF NOT EXISTS crm_customers_tenant_external_id_idx
  ON public.crm_customers (tenant_id, pos_source, external_id)
  WHERE external_id IS NOT NULL;
