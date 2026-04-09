-- Idempotency log (prevents duplicate webhook processing)
CREATE TABLE IF NOT EXISTS idempotency_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key text UNIQUE NOT NULL,
  function_name text NOT NULL,
  result jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + INTERVAL '72 hours'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_log(expires_at);

-- Edge function error log
CREATE TABLE IF NOT EXISTS edge_function_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  error_message text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_function_errors_created ON edge_function_errors(created_at DESC);

-- Stripe vs Notion reconciliation log
CREATE TABLE IF NOT EXISTS reconciliation_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_customer_id text,
  customer_email text,
  stripe_status text,
  notion_stage text,
  mismatch_type text,
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_resolved ON reconciliation_log(resolved_at) WHERE resolved_at IS NULL;

-- Health score history
CREATE TABLE IF NOT EXISTS health_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  score integer NOT NULL,
  status text NOT NULL,
  breakdown jsonb,
  calculated_at timestamptz DEFAULT now()
);
