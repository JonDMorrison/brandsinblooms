#!/usr/bin/env bash
# Runs Bloom Support checks against disposable local databases.
# Requires: psql/createdb pointing at a disposable Postgres (PG* env vars), deno.
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --if-exists bloom_support_test && createdb --template=template0 --encoding=UTF8 bloom_support_test
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-db.sql > /tmp/bloom-support-db.log 2>&1 || { cat /tmp/bloom-support-db.log | tail -30; exit 1; }
grep -q "all assertions passed" /tmp/bloom-support-db.log && echo "SQL contract: passed"
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-reviewed-closure.sql > /tmp/bloom-support-reviewed-closure.log 2>&1 || { tail -30 /tmp/bloom-support-reviewed-closure.log; exit 1; }
grep -q "bloom-support-reviewed-closure: all assertions passed" /tmp/bloom-support-reviewed-closure.log || { cat /tmp/bloom-support-reviewed-closure.log; exit 1; }
echo "Reviewed closure SQL contract: passed"
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-message-closure-race.sql > /tmp/bloom-support-message-closure-race.log 2>&1 || { tail -30 /tmp/bloom-support-message-closure-race.log; exit 1; }
grep -q "bloom-support-message-closure-race: all assertions passed" /tmp/bloom-support-message-closure-race.log || { cat /tmp/bloom-support-message-closure-race.log; exit 1; }
echo "Message closure concurrency: passed"
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-atomic-closure.sql > /tmp/bloom-support-atomic-closure.log 2>&1 || { tail -30 /tmp/bloom-support-atomic-closure.log; exit 1; }
grep -q "bloom-support-atomic-closure: all assertions passed" /tmp/bloom-support-atomic-closure.log || { cat /tmp/bloom-support-atomic-closure.log; exit 1; }
echo "Atomic closure SQL contract: passed"
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-escalation-reconciliation.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-external-response.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-external-response-race.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-internal-tests.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-reminder-concurrency.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-completed-escalations.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-completed-escalations-race.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-email-threads.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-release-links.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-release-links-race.sql
psql -q -v ON_ERROR_STOP=1 -d bloom_support_test -f scripts/tests/bloom-support-slack-release-evidence.sql

(cd supabase/functions && deno test -A _shared/bloom-support/slack-release-evidence_test.ts _shared/bloom-support/external-response_test.ts _shared/bloom-support/trusted-bug-setup_test.ts _shared/bloom-support/trusted-reproduction_test.ts _shared/bloom-support/trusted-live_test.ts _shared/bloom-support/policy_test.ts _shared/bloom-support/engineering_test.ts _shared/bloom-support/calendar-verification_test.ts _shared/bloom-support/engineering-merge_test.ts _shared/bloom-support/engineering-schedule_test.ts _shared/bloom-support/dkim_test.ts _shared/bloom-support/support_emails_test.ts _shared/bloom-support/support_emails_brand_test.ts _shared/bloom-support/needs_you_test.ts _shared/bloom-support/vision_test.ts _shared/bloom-support/attachments_test.ts _shared/bloom-support/slack_test.ts _shared/bloom-support/actionable-alerts_test.ts _shared/bloom-support/slack-questions_test.ts _shared/bloom-support/slack-intake_test.ts _shared/bloom-support/ticket-slack_test.ts _shared/bloom-support/slack-ticket-migration_test.ts _shared/bloom-support/slack-question_test.ts _shared/bloom-support/slack-conversation_test.ts _shared/bloom-support/slack-conversation-migration_test.ts _shared/bloom-support/github-events_test.ts _shared/bloom-support/integration-diagnostics_test.ts _shared/bloom-support/slack-language_test.ts _shared/bloom-support/release-notes_test.ts _shared/bloom-support/finance_test.ts _shared/bloom-support/webhook-auth_test.ts)
# These are executed, not merely included in deno check. Keep this block with
# the operational agent so new security tests cannot silently be typecheck-only.
(cd supabase/functions && deno test -A \
  _shared/bloom-support/slack-agent-core_test.ts \
  _shared/bloom-support/slack-agent_test.ts \
  _shared/bloom-support/slack-revenue_test.ts \
  _shared/bloom-support/slack-privacy-diagnostics_test.ts \
  _shared/bloom-support/approval-delivery_test.ts \
  _shared/bloom-support/gmail-drafts_test.ts \
  _shared/bloom-support/voice_test.ts)
# Chat spending cap: 30 parallel reservations against a 25 USD cap must admit 25.
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
