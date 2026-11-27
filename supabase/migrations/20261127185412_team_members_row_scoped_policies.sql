-- Scope legacy team_members / teams writes to the caller's own rows.
--
-- The INSERT, UPDATE and DELETE policies on public.team_members allowed a
-- write when
--   invited_by = auth.uid() OR EXISTS (SELECT 1 FROM teams WHERE owner_id = auth.uid())
-- The EXISTS branch is not correlated to the row (team_members has no team_id),
-- and handle_new_user_team gives every user a team, so any signed-in user
-- could insert, update or delete any team_members row.
--
-- Impact today is limited: the table is empty in production, no RLS helper or
-- permission check reads it (business access comes from profile_user_id_for /
-- has_tenant_permission), and the Team UI that writes it (TeamPage and its
-- children) is not routed. This closes it anyway so the table cannot be used
-- to plant or remove rows for other accounts.
--
-- The SELECT policy "Users can view team members they belong to" queries
-- team_members inside its own USING clause, so every authenticated read
-- (including INSERT ... RETURNING) fails with 42P17 infinite recursion. It is
-- replaced with the non-recursive equivalent: the invitee or the inviter.
--
-- teams: owners could also set is_paid / max_members on their own team.
-- Clients now get column-level INSERT (owner_id, name) and UPDATE (name) only.

-- team_members -------------------------------------------------------------
DROP POLICY IF EXISTS "Team owners can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can delete team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view team members they belong to" ON public.team_members;

CREATE POLICY "Users can view team members they belong to"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR invited_by = (SELECT auth.uid())
  );

CREATE POLICY "Team owners can insert team members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (invited_by = (SELECT auth.uid()));

CREATE POLICY "Team owners can update team members"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (invited_by = (SELECT auth.uid()))
  WITH CHECK (invited_by = (SELECT auth.uid()));

CREATE POLICY "Team owners can delete team members"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (invited_by = (SELECT auth.uid()));

REVOKE ALL ON public.team_members FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.team_members FROM authenticated;

-- teams --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own teams" ON public.teams;
CREATE POLICY "Users can update their own teams"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.teams FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.teams FROM authenticated;
GRANT INSERT (owner_id, name) ON public.teams TO authenticated;
GRANT UPDATE (name) ON public.teams TO authenticated;
