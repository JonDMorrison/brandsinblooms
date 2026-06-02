ALTER TABLE public.bloom_conversations
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id UUID;

ALTER TABLE public.bloom_conversations
  DROP CONSTRAINT IF EXISTS bloom_conversations_session_type_check;

ALTER TABLE public.bloom_conversations
  ADD CONSTRAINT bloom_conversations_session_type_check
  CHECK (session_type IN ('standard', 'resource_focused'));

ALTER TABLE public.bloom_conversations
  DROP CONSTRAINT IF EXISTS bloom_conversations_session_type_resource_focus_check;

ALTER TABLE public.bloom_conversations
  ADD CONSTRAINT bloom_conversations_session_type_resource_focus_check
  CHECK (
    session_type = 'standard'
    OR (resource_type IS NOT NULL AND resource_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_bloom_conversations_resource
  ON public.bloom_conversations (
    tenant_id,
    user_id,
    session_type,
    resource_type,
    resource_id
  )
  WHERE session_type = 'resource_focused';
