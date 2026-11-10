-- Ask Bloom: exactly-once approvals for inline action cards.
--
-- Before this, execute_action ran whatever tool arguments the browser sent back
-- with approved:true, and a double click or replayed request could run the same
-- change twice. Now bloom-assist executes only the arguments it stored on the
-- assistant message when it proposed the change, and claims the action here
-- first. The primary key makes the claim exactly-once; a repeat returns the
-- recorded outcome instead of running the tool again.
--
-- Written only by bloom-assist with the service role. No client access.

CREATE TABLE IF NOT EXISTS public.bloom_action_claims (
  mutation_id text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.bloom_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  tool_name text NOT NULL,
  status text NOT NULL DEFAULT 'executing' CHECK (status IN ('executing', 'completed', 'failed')),
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS bloom_action_claims_tenant_created_idx
  ON public.bloom_action_claims (tenant_id, created_at DESC);

ALTER TABLE public.bloom_action_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bloom_action_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bloom_action_claims TO service_role;

COMMENT ON TABLE public.bloom_action_claims IS
  'Exactly-once claims for Ask Bloom inline action approvals. Service role only.';
