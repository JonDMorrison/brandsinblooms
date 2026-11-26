-- Bloom Slack: a grumpy IT veteran voice for the internal staff channels.
--
-- slack_agent.persona = 'grumpy_it_vet' adds a dry, wry tone and a few emojis
-- to Bloom's answers in the staff Slack channels. It changes tone only: facts,
-- figures, warnings and "nothing was changed" statements are unchanged. It does
-- not apply to client emails, the client-facing Bloom chat, or reply drafts.
--
-- Only this key is added; other keys are kept. Running it again changes
-- nothing. To turn it off: remove the key or set it to any other value.

UPDATE bloom_support.settings
SET value = value || '{"persona": "grumpy_it_vet"}'::jsonb,
    updated_at = now()
WHERE key = 'slack_agent'
  AND NOT (value ? 'persona');
