-- BLOOM-M01: Bloom Assist database schema foundation.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND p.pronargs = 0
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $function$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bloom_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pinned', 'archived', 'deleted')),
  mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (mode IN ('standard', 'reasoning', 'research', 'image')),
  message_count INTEGER NOT NULL DEFAULT 0
    CHECK (message_count >= 0),
  last_message_preview TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.bloom_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  thinking_content TEXT,
  block_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (mode IN ('standard', 'reasoning', 'research', 'image')),
  model TEXT,
  tokens_input INTEGER CHECK (tokens_input IS NULL OR tokens_input >= 0),
  tokens_output INTEGER CHECK (tokens_output IS NULL OR tokens_output >= 0),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  follow_up_chips JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  is_compacted BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloom_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.bloom_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.bloom_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tool_name TEXT NOT NULL CHECK (btrim(tool_name) <> ''),
  tool_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  tool_output JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  error_message TEXT,
  execution_time_ms INTEGER CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloom_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  interaction_count INTEGER NOT NULL DEFAULT 0
    CHECK (interaction_count >= 0),
  onboarding_stage INTEGER NOT NULL DEFAULT 0
    CHECK (onboarding_stage BETWEEN 0 AND 3),
  seen_tips TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  workspace_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bloom_user_profiles_tenant_user_key UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.bloom_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  conversation_id UUID REFERENCES public.bloom_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.bloom_messages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'prompt',
      'tool_call',
      'tool_result',
      'response',
      'approval',
      'execution',
      'error'
    )
  ),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_used TEXT,
  tokens_input INTEGER CHECK (tokens_input IS NULL OR tokens_input >= 0),
  tokens_output INTEGER CHECK (tokens_output IS NULL OR tokens_output >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bloom_proactive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  insight_type TEXT NOT NULL CHECK (btrim(insight_type) <> ''),
  title TEXT NOT NULL CHECK (btrim(title) <> ''),
  description TEXT NOT NULL CHECK (btrim(description) <> ''),
  action_prompt TEXT,
  entity_type TEXT CHECK (
    entity_type IS NULL
    OR entity_type IN ('customer', 'product', 'campaign', 'segment')
  ),
  entity_id UUID,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  dismissed_by UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloom_conversations_sidebar
  ON public.bloom_conversations (
    tenant_id,
    user_id,
    (CASE status WHEN 'pinned' THEN 0 WHEN 'active' THEN 1 WHEN 'archived' THEN 2 ELSE 3 END),
    updated_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_bloom_conversations_recent
  ON public.bloom_conversations (tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_messages_history
  ON public.bloom_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_bloom_messages_recent
  ON public.bloom_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_messages_bookmarked
  ON public.bloom_messages (tenant_id, user_id, created_at DESC)
  WHERE is_bookmarked = true;

CREATE INDEX IF NOT EXISTS idx_bloom_tool_executions_conversation_time
  ON public.bloom_tool_executions (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_bloom_tool_executions_message_time
  ON public.bloom_tool_executions (message_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_bloom_tool_executions_tenant_tool_time
  ON public.bloom_tool_executions (tenant_id, tool_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_audit_log_tenant_time
  ON public.bloom_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_audit_log_tenant_event_time
  ON public.bloom_audit_log (tenant_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_audit_log_tenant_user_time
  ON public.bloom_audit_log (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bloom_user_profiles_user
  ON public.bloom_user_profiles (user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_bloom_proactive_insights_unexpiring
  ON public.bloom_proactive_insights (tenant_id, created_at DESC)
  WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bloom_proactive_insights_expiring
  ON public.bloom_proactive_insights (tenant_id, expires_at, created_at DESC)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bloom_proactive_insights_dismissed_by
  ON public.bloom_proactive_insights USING GIN (dismissed_by);

ALTER TABLE public.bloom_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloom_proactive_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloom_conversations_select_own" ON public.bloom_conversations;
CREATE POLICY "bloom_conversations_select_own"
  ON public.bloom_conversations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversations.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversations_insert_own" ON public.bloom_conversations;
CREATE POLICY "bloom_conversations_insert_own"
  ON public.bloom_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversations.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversations_update_own" ON public.bloom_conversations;
CREATE POLICY "bloom_conversations_update_own"
  ON public.bloom_conversations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversations.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversations.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_conversations_delete_own" ON public.bloom_conversations;
CREATE POLICY "bloom_conversations_delete_own"
  ON public.bloom_conversations
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_conversations.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_messages_select_own" ON public.bloom_messages;
CREATE POLICY "bloom_messages_select_own"
  ON public.bloom_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_messages.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_messages_insert_own" ON public.bloom_messages;
CREATE POLICY "bloom_messages_insert_own"
  ON public.bloom_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_messages.tenant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.bloom_conversations c
      WHERE c.id = bloom_messages.conversation_id
        AND c.user_id = auth.uid()
        AND c.tenant_id = bloom_messages.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_messages_update_own" ON public.bloom_messages;
CREATE POLICY "bloom_messages_update_own"
  ON public.bloom_messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_messages.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_messages.tenant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.bloom_conversations c
      WHERE c.id = bloom_messages.conversation_id
        AND c.user_id = auth.uid()
        AND c.tenant_id = bloom_messages.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_messages_delete_own" ON public.bloom_messages;
CREATE POLICY "bloom_messages_delete_own"
  ON public.bloom_messages
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_messages.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_tool_executions_select_own" ON public.bloom_tool_executions;
CREATE POLICY "bloom_tool_executions_select_own"
  ON public.bloom_tool_executions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_tool_executions.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_tool_executions_insert_own" ON public.bloom_tool_executions;
CREATE POLICY "bloom_tool_executions_insert_own"
  ON public.bloom_tool_executions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_tool_executions.tenant_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.bloom_messages m
      WHERE m.id = bloom_tool_executions.message_id
        AND m.conversation_id = bloom_tool_executions.conversation_id
        AND m.user_id = auth.uid()
        AND m.tenant_id = bloom_tool_executions.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_user_profiles_select_own" ON public.bloom_user_profiles;
CREATE POLICY "bloom_user_profiles_select_own"
  ON public.bloom_user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_user_profiles.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_user_profiles_insert_own" ON public.bloom_user_profiles;
CREATE POLICY "bloom_user_profiles_insert_own"
  ON public.bloom_user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_user_profiles.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_user_profiles_update_own" ON public.bloom_user_profiles;
CREATE POLICY "bloom_user_profiles_update_own"
  ON public.bloom_user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_user_profiles.tenant_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_user_profiles.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_user_profiles_delete_own" ON public.bloom_user_profiles;
CREATE POLICY "bloom_user_profiles_delete_own"
  ON public.bloom_user_profiles
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_user_profiles.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_audit_log_select_own" ON public.bloom_audit_log;
CREATE POLICY "bloom_audit_log_select_own"
  ON public.bloom_audit_log
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_audit_log.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_audit_log_insert_own" ON public.bloom_audit_log;
CREATE POLICY "bloom_audit_log_insert_own"
  ON public.bloom_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_audit_log.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_proactive_insights_select_tenant" ON public.bloom_proactive_insights;
CREATE POLICY "bloom_proactive_insights_select_tenant"
  ON public.bloom_proactive_insights
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_proactive_insights.tenant_id
    )
  );

DROP POLICY IF EXISTS "bloom_proactive_insights_update_dismissed_by" ON public.bloom_proactive_insights;
CREATE POLICY "bloom_proactive_insights_update_dismissed_by"
  ON public.bloom_proactive_insights
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_proactive_insights.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id = bloom_proactive_insights.tenant_id
    )
    AND auth.uid() = ANY(dismissed_by)
  );

DROP POLICY IF EXISTS "bloom_proactive_insights_insert_service_role" ON public.bloom_proactive_insights;
CREATE POLICY "bloom_proactive_insights_insert_service_role"
  ON public.bloom_proactive_insights
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "bloom_proactive_insights_delete_service_role" ON public.bloom_proactive_insights;
CREATE POLICY "bloom_proactive_insights_delete_service_role"
  ON public.bloom_proactive_insights
  FOR DELETE
  TO service_role
  USING (true);

REVOKE ALL ON TABLE public.bloom_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_tool_executions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_user_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bloom_proactive_insights FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloom_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloom_messages TO authenticated;
GRANT SELECT, INSERT ON TABLE public.bloom_tool_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloom_user_profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.bloom_audit_log TO authenticated;
GRANT SELECT, UPDATE (dismissed_by) ON TABLE public.bloom_proactive_insights TO authenticated;

GRANT ALL ON TABLE public.bloom_conversations TO service_role;
GRANT ALL ON TABLE public.bloom_messages TO service_role;
GRANT SELECT, INSERT ON TABLE public.bloom_tool_executions TO service_role;
GRANT ALL ON TABLE public.bloom_user_profiles TO service_role;
GRANT SELECT, INSERT ON TABLE public.bloom_audit_log TO service_role;
GRANT ALL ON TABLE public.bloom_proactive_insights TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_bloom_conversations_updated_at'
  ) THEN
    CREATE TRIGGER update_bloom_conversations_updated_at
      BEFORE UPDATE ON public.bloom_conversations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_bloom_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_bloom_user_profiles_updated_at
      BEFORE UPDATE ON public.bloom_user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;