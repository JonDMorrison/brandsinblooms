#!/usr/bin/env bash
# Runs every Bloom Support check against disposable local databases:
#   1. SQL contract test (authorization, state machine, jobs, email ledger)
#   2. Deno unit tests (policy, sanitization, signatures)
#   3. End-to-end harness (real Edge Function handlers + Postgres; external services stubbed)
# Requires: psql/createdb pointing at a disposable Postgres (PG* env vars), deno.
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --if-exists bloom_support_test && createdb --template=template0 --encoding=UTF8 bloom_support_test
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-db.sql > /tmp/bloom-support-db.log 2>&1 || { cat /tmp/bloom-support-db.log | tail -30; exit 1; }
grep -q "all assertions passed" /tmp/bloom-support-db.log && echo "SQL contract: passed"
(cd supabase/functions && deno test -A _shared/bloom-support/policy_test.ts _shared/bloom-support/engineering_test.ts _shared/bloom-support/dkim_test.ts _shared/bloom-support/support_emails_test.ts _shared/bloom-support/support_emails_brand_test.ts _shared/bloom-support/needs_you_test.ts _shared/bloom-support/vision_test.ts _shared/bloom-support/attachments_test.ts _shared/bloom-support/slack_test.ts _shared/bloom-support/actionable-alerts_test.ts _shared/bloom-support/slack-questions_test.ts _shared/bloom-support/ticket-slack_test.ts _shared/bloom-support/slack-ticket-migration_test.ts _shared/bloom-support/slack-question_test.ts _shared/bloom-support/github-events_test.ts _shared/bloom-support/integration-diagnostics_test.ts _shared/bloom-support/slack-language_test.ts _shared/bloom-support/release-notes_test.ts _shared/bloom-support/finance_test.ts _shared/bloom-support/webhook-auth_test.ts)
# Chat spending cap: contract test, then 30 parallel reservations against a 25 USD cap
# (1 USD each) must admit exactly 25 — the row lock keeps parallel calls from overshooting.
dropdb --if-exists bloom_support_spend_test && createdb --template=template0 --encoding=UTF8 bloom_support_spend_test
psql -q -v ON_ERROR_STOP=1 -d bloom_support_spend_test -f scripts/tests/bloom-support-chat-spend.sql > /tmp/bloom-support-spend.log 2>&1 || { tail -30 /tmp/bloom-support-spend.log; exit 1; }
grep -q "all assertions passed" /tmp/bloom-support-spend.log && echo "Chat spend contract: passed"
for _ in $(seq 1 30); do
  psql -qAt -d bloom_support_spend_test -c "SELECT public.bloom_chat_spend_reserve('30000000-0000-4000-8000-000000000002', NULL, 'chat', 'gpt-4o', 1000000)->>'allowed'" &
done > /tmp/bloom-support-spend-parallel.log
wait
allowed=$(grep -c '^true$' /tmp/bloom-support-spend-parallel.log || true)
[ "$allowed" = "25" ] || { echo "Chat spend concurrency: expected 25 allowed, got $allowed"; cat /tmp/bloom-support-spend-parallel.log; exit 1; }
echo "Chat spend concurrency: passed (25 of 30 admitted)"
dropdb --if-exists bloom_support_e2e && createdb --template=template0 --encoding=UTF8 bloom_support_e2e
psql -q -v ON_ERROR_STOP=1 -d bloom_support_e2e -f scripts/tests/bloom-support-e2e-setup.sql > /dev/null
E2E_URL="postgres://${PGUSER:-postgres}@${PGHOSTADDR:-127.0.0.1}:${PGPORT:-5432}/bloom_support_e2e"
(cd supabase/functions && BLOOM_E2E_DATABASE_URL="$E2E_URL" deno test -A _shared/bloom-support/e2e_test.ts)
