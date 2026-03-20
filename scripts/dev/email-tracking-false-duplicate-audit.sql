-- Milestone 1: Webhook false-duplicate diagnosis for email_tracking_events.
--
-- Usage:
-- 1. Replace the placeholder values in the params CTE.
-- 2. Run each section independently in the Supabase SQL editor.
-- 3. Keep every query tenant-scoped. Do not remove the tenant filters.
--
-- Inputs expected from the failing webhook payload/response:
--   tenant_id
--   provider_message_id         -- payload.data.email_id
--   recipient_email             -- payload.data.to[0]
--   campaign_id                 -- optional but preferred if known
--   event_type                  -- opened or clicked
--   event_ts_provider           -- payload.created_at
--   webhook_delivery_id         -- svix-id / webhook-id / x-request-id / fallback

-- ============================================
-- Section 0: Investigation parameters
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    NULL::uuid AS campaign_id,
    'recipient@example.com'::text AS recipient_email,
    'provider-message-id'::text AS provider_message_id,
    'opened'::text AS event_type,
    '2026-03-20T00:00:00Z'::timestamptz AS event_ts_provider,
    'webhook-delivery-id'::text AS webhook_delivery_id
)
SELECT *
FROM params;

-- ============================================
-- Section 1: Resolve tenant/campaign from email_messages if missing
-- ============================================
WITH params AS (
  SELECT
    'provider-message-id'::text AS provider_message_id
)
SELECT
  em.id AS email_message_id,
  em.tenant_id,
  em.campaign_id,
  em.domain_id,
  em.customer_id,
  em.email,
  em.status,
  em.resend_id,
  em.created_at,
  em.updated_at
FROM email_messages em
JOIN params p
  ON em.resend_id = p.provider_message_id
ORDER BY em.created_at DESC
LIMIT 5;

-- ============================================
-- Section 2: Live index definitions and NULL semantics
-- ============================================
SELECT
  c.relname AS index_name,
  pg_get_indexdef(i.indexrelid) AS index_def,
  i.indisunique AS is_unique,
  i.indnullsnotdistinct AS nulls_not_distinct,
  pg_get_expr(i.indpred, i.indrelid) AS predicate
FROM pg_index i
JOIN pg_class c
  ON c.oid = i.indexrelid
JOIN pg_class t
  ON t.oid = i.indrelid
JOIN pg_namespace n
  ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'email_tracking_events'
  AND c.relname IN (
    'idx_email_tracking_events_webhook_delivery_id',
    'idx_email_tracking_events_idempotency',
    'idx_email_tracking_events_provider_idempotency'
  )
ORDER BY c.relname;

-- ============================================
-- Section 3: Look for unexpected leftover unique indexes
-- ============================================
SELECT
  schemaname,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'email_tracking_events'
  AND indexdef ILIKE 'create unique index%'
ORDER BY indexname;

-- ============================================
-- Section 4: Webhook delivery id collision candidate
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    'webhook-delivery-id'::text AS webhook_delivery_id
)
SELECT
  ete.id,
  ete.tenant_id,
  ete.campaign_id,
  ete.customer_email,
  ete.event_type,
  ete.provider_message_id,
  ete.event_ts_provider,
  ete.webhook_delivery_id,
  ete.created_at,
  ete.ingested_at,
  ete.event_data ->> 'email_id' AS event_data_email_id
FROM email_tracking_events ete
JOIN params p
  ON ete.tenant_id = p.tenant_id
 AND ete.webhook_delivery_id = p.webhook_delivery_id
ORDER BY ete.created_at DESC;

-- ============================================
-- Section 5: Semantic tuple collision candidate
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    NULL::uuid AS campaign_id,
    'recipient@example.com'::text AS recipient_email,
    'opened'::text AS event_type,
    'provider-message-id'::text AS provider_message_id
)
SELECT
  ete.id,
  ete.tenant_id,
  ete.campaign_id,
  ete.customer_email,
  ete.event_type,
  ete.provider_message_id,
  ete.event_ts_provider,
  ete.webhook_delivery_id,
  ete.created_at,
  ete.ingested_at,
  ete.event_data ->> 'email_id' AS event_data_email_id
FROM email_tracking_events ete
JOIN params p
  ON ete.tenant_id = p.tenant_id
 AND ete.customer_email = p.recipient_email
 AND ete.event_type = p.event_type
 AND (p.campaign_id IS NULL OR ete.campaign_id = p.campaign_id)
 AND ete.event_data ->> 'email_id' = p.provider_message_id
ORDER BY ete.created_at DESC;

-- ============================================
-- Section 6: Provider tuple collision candidate
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    'provider-message-id'::text AS provider_message_id,
    'opened'::text AS event_type,
    '2026-03-20T00:00:00Z'::timestamptz AS event_ts_provider
)
SELECT
  ete.id,
  ete.tenant_id,
  ete.campaign_id,
  ete.customer_email,
  ete.event_type,
  ete.provider_message_id,
  ete.event_ts_provider,
  ete.webhook_delivery_id,
  ete.created_at,
  ete.ingested_at,
  ete.event_data ->> 'email_id' AS event_data_email_id
FROM email_tracking_events ete
JOIN params p
  ON ete.tenant_id = p.tenant_id
 AND ete.provider_message_id = p.provider_message_id
 AND ete.event_type = p.event_type
 AND ete.event_ts_provider = p.event_ts_provider
ORDER BY ete.created_at DESC;

-- ============================================
-- Section 7: Compare delivered/opened/clicked for the same message
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    'provider-message-id'::text AS provider_message_id,
    'recipient@example.com'::text AS recipient_email
)
SELECT
  ete.id,
  ete.event_type,
  ete.customer_email,
  ete.provider_message_id,
  ete.event_ts_provider,
  ete.webhook_delivery_id,
  ete.created_at,
  ete.ingested_at,
  ete.event_data ->> 'email_id' AS event_data_email_id,
  ete.event_data ->> 'occurred_at' AS event_data_occurred_at,
  ete.event_data ->> 'open_timestamp' AS open_timestamp,
  ete.event_data ->> 'click_timestamp' AS click_timestamp,
  ete.event_data ->> 'click_link' AS click_link
FROM email_tracking_events ete
JOIN params p
  ON ete.tenant_id = p.tenant_id
 AND ete.provider_message_id = p.provider_message_id
 AND ete.customer_email = p.recipient_email
WHERE ete.event_type IN ('delivered', 'opened', 'clicked')
ORDER BY ete.event_ts_provider NULLS LAST, ete.created_at;

-- ============================================
-- Section 8: Governance table comparison for the same message
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    'provider-message-id'::text AS provider_message_id,
    'recipient@example.com'::text AS recipient_email
)
SELECT
  egee.id,
  egee.event_type,
  egee.email,
  egee.provider_message_id,
  egee.event_ts_provider,
  egee.webhook_delivery_id,
  egee.created_at,
  egee.ingested_at,
  egee.event_data ->> 'email_id' AS event_data_email_id,
  egee.event_data ->> 'occurred_at' AS event_data_occurred_at,
  egee.event_data ->> 'open_timestamp' AS open_timestamp,
  egee.event_data ->> 'click_timestamp' AS click_timestamp,
  egee.event_data ->> 'click_link' AS click_link
FROM email_governance_email_events egee
JOIN params p
  ON egee.tenant_id = p.tenant_id
 AND egee.provider_message_id = p.provider_message_id
 AND egee.email = p.recipient_email
WHERE egee.event_type IN ('delivered', 'opened', 'clicked')
ORDER BY egee.event_ts_provider NULLS LAST, egee.created_at;

-- ============================================
-- Section 9: Webhook delivery records for the suspect event
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    'provider-message-id'::text AS provider_message_id,
    'webhook-delivery-id'::text AS webhook_delivery_id
)
SELECT
  egwd.id,
  egwd.delivery_id,
  egwd.event_type,
  egwd.provider_message_id,
  egwd.processing_status,
  egwd.retry_count,
  egwd.received_at,
  egwd.processed_at,
  egwd.error_message,
  egwd.headers,
  egwd.raw_payload
FROM email_governance_webhook_deliveries egwd
JOIN params p
  ON egwd.tenant_id = p.tenant_id
 AND (
   egwd.provider_message_id = p.provider_message_id
   OR egwd.delivery_id = p.webhook_delivery_id
 )
ORDER BY egwd.received_at DESC;

-- ============================================
-- Section 10: Fast candidate summary by constraint
-- ============================================
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    NULL::uuid AS campaign_id,
    'recipient@example.com'::text AS recipient_email,
    'provider-message-id'::text AS provider_message_id,
    'opened'::text AS event_type,
    '2026-03-20T00:00:00Z'::timestamptz AS event_ts_provider,
    'webhook-delivery-id'::text AS webhook_delivery_id
),
webhook_collision AS (
  SELECT 'webhook_delivery_id'::text AS constraint_candidate, COUNT(*)::bigint AS matching_rows
  FROM email_tracking_events ete
  JOIN params p
    ON ete.tenant_id = p.tenant_id
   AND ete.webhook_delivery_id = p.webhook_delivery_id
),
semantic_collision AS (
  SELECT 'semantic_event_tuple'::text AS constraint_candidate, COUNT(*)::bigint AS matching_rows
  FROM email_tracking_events ete
  JOIN params p
    ON ete.tenant_id = p.tenant_id
   AND ete.customer_email = p.recipient_email
   AND ete.event_type = p.event_type
   AND (p.campaign_id IS NULL OR ete.campaign_id = p.campaign_id)
   AND ete.event_data ->> 'email_id' = p.provider_message_id
),
provider_collision AS (
  SELECT 'provider_tuple'::text AS constraint_candidate, COUNT(*)::bigint AS matching_rows
  FROM email_tracking_events ete
  JOIN params p
    ON ete.tenant_id = p.tenant_id
   AND ete.provider_message_id = p.provider_message_id
   AND ete.event_type = p.event_type
   AND ete.event_ts_provider = p.event_ts_provider
)
SELECT * FROM webhook_collision
UNION ALL
SELECT * FROM semantic_collision
UNION ALL
SELECT * FROM provider_collision
ORDER BY matching_rows DESC, constraint_candidate;

-- ============================================
-- Section 11: Optional rollback-only probe
-- ============================================
-- Use this only if Sections 4-10 are inconclusive and you need the exact
-- violated index/constraint from a live insert attempt. Keep the transaction
-- wrapped in BEGIN/ROLLBACK so nothing persists.
--
-- BEGIN;
-- INSERT INTO email_tracking_events (
--   campaign_id,
--   customer_email,
--   event_type,
--   event_data,
--   provider_message_id,
--   event_ts_provider,
--   ingested_at,
--   tenant_id,
--   is_mpp_guess,
--   ip_hash,
--   webhook_delivery_id
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'recipient@example.com',
--   'opened',
--   jsonb_build_object(
--     'email_id', 'provider-message-id',
--     'occurred_at', '2026-03-20T00:00:00Z',
--     'raw_payload', jsonb_build_object('type', 'email.opened')
--   ),
--   'provider-message-id',
--   '2026-03-20T00:00:00Z'::timestamptz,
--   now(),
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   false,
--   null,
--   'webhook-delivery-id'
-- );
-- ROLLBACK;