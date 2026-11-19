-- Let authorized staff ask Bloom about tickets and clients in any internal
-- Slack channel, public or private.
--
-- Bloom's Slack conversations previously shared ticket and client records only
-- in private channels. slack_agent.allow_any_staff_channel = true also allows
-- public internal channels. Channels shared outside the workspace and failed
-- Slack lookups are still refused. Staff identity (BLOOM_SUPPORT_SLACK_STAFF_IDS),
-- the route-to-channel binding and per-tool role checks are unchanged.
--
-- Only this key is added; enabled, release and any other keys are kept. Running
-- it again changes nothing. To turn it off, set the key to false (see
-- docs/bloom-support/OPERATOR.md).

UPDATE bloom_support.settings
SET value = value || '{"allow_any_staff_channel": true}'::jsonb,
    updated_at = now()
WHERE key = 'slack_agent'
  AND NOT (value ? 'allow_any_staff_channel');
