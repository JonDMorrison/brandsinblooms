#!/usr/bin/env bash
# Runs every Bloom Support check against disposable local databases:
#   1. SQL contract test (authorization, state machine, jobs, email ledger)
#   2. Deno unit tests (policy, sanitization, signatures)
#   3. End-to-end harness (real Edge Function handlers + Postgres; external services stubbed)
# Requires: psql/createdb pointing at a disposable Postgres (PG* env vars), deno.
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --if-exists bloom_support_test && createdb bloom_support_test
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-db.sql > /tmp/bloom-support-db.log 2>&1 || { cat /tmp/bloom-support-db.log | tail -30; exit 1; }
grep -q "all assertions passed" /tmp/bloom-support-db.log && echo "SQL contract: passed"
(cd supabase/functions && deno test -A _shared/bloom-support/policy_test.ts)
dropdb --if-exists bloom_support_e2e && createdb bloom_support_e2e
psql -q -v ON_ERROR_STOP=1 -d bloom_support_e2e -f scripts/tests/bloom-support-e2e-setup.sql > /dev/null
E2E_URL="postgres://${PGUSER:-postgres}@${PGHOSTADDR:-127.0.0.1}:${PGPORT:-5432}/bloom_support_e2e"
(cd supabase/functions && BLOOM_E2E_DATABASE_URL="$E2E_URL" deno test -A _shared/bloom-support/e2e_test.ts)
