#!/usr/bin/env bash
set -euo pipefail
if [[ "${PGDATABASE:-}" != "phoenix_guard_test" ]]; then
  echo "Refusing to alter anything outside the disposable phoenix_guard_test database" >&2
  exit 1
fi
psql -Xqv ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF current_database() <> 'phoenix_guard_test' THEN RAISE EXCEPTION 'Wrong test database'; END IF;
END $$;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE TABLE public.customer_purchase_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  source text,external_customer_code text,external_transaction_id text,
  external_line_id text,purchased_at timestamptz,net_amount numeric
);
SQL
psql -Xqv ON_ERROR_STOP=1 -f supabase/migrations/20261015220149_ideal_line_identity_guard.sql >/dev/null
psql -Xqv ON_ERROR_STOP=1 <<'SQL'
CREATE FUNCTION public.assert_blocked(command text, reason text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN check_violation OR unique_violation THEN failed := true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Expected rejection: %', reason; END IF;
END $$;

-- Two source lines from one real dated synthetic receipt are legitimate,
-- and each retains its leading-zero customer code.
INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,external_transaction_id,external_line_id,purchased_at,net_amount)
VALUES
('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-a','line-1','2026-10-15T12:30:00-07:00',9.99),
('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-a','line-2','2026-10-15T12:30:00-07:00',4.95);

SELECT public.assert_blocked($q$
 INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,external_transaction_id,external_line_id,purchased_at,net_amount)
 VALUES ('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-a','line-1','2026-10-15T12:30:00-07:00',9.99)
$q$,'same source sale/line cannot duplicate');

SELECT public.assert_blocked($q$
 INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,external_transaction_id,external_line_id,purchased_at,net_amount)
 VALUES ('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-a','line-1','2026-10-15T12:30:00-07:00',19.99)
$q$,'a corrected price cannot create a second copy');

SELECT public.assert_blocked($q$
 INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,external_transaction_id,external_line_id,purchased_at,net_amount)
 VALUES ('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-b',NULL,'2026-10-15T12:30:00-07:00',19.99)
$q$,'missing line id blocked');

SELECT public.assert_blocked($q$
 INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,external_transaction_id,external_line_id,purchased_at,net_amount)
 VALUES ('10000000-0000-0000-0000-000000000001','ideal','000123','receipt-b','line-1',NULL,19.99)
$q$,'undated grouped report cannot masquerade as purchase');

-- Other providers are deliberately unaffected by the Ideal-specific guard.
INSERT INTO public.customer_purchase_line_items(tenant_id,source,external_customer_code,net_amount)
VALUES('10000000-0000-0000-0000-000000000001','lightspeed','000123',42.50);

DO $$BEGIN
 IF (SELECT count(*) FROM public.customer_purchase_line_items) <> 3 THEN
  RAISE EXCEPTION 'Unexpected purchase line count';
 END IF;
END$$;
SQL
echo 'PASS: Ideal transaction/line identity, corrected re-exports, required dates, and other provider isolation.'
