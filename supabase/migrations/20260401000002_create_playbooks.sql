-- Playbooks feature: reusable project templates with phases and tasks
-- Adapted to use tenant_id (this codebase's multi-tenant pattern)

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_type text,
  description text,
  version integer DEFAULT 1,
  is_archived boolean DEFAULT false,
  confidence_score integer DEFAULT 0,
  projects_analyzed integer DEFAULT 0,
  total_hours_low numeric,
  total_hours_high numeric,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbook_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.playbook_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid REFERENCES public.playbook_phases(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  estimated_hours numeric,
  baseline_role_type text,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_playbooks_tenant_id ON public.playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbook_phases_playbook_id ON public.playbook_phases(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_tasks_phase_id ON public.playbook_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_playbook_tasks_playbook_id ON public.playbook_tasks(playbook_id);

-- 3. RLS
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_select" ON public.playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbooks_insert" ON public.playbooks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "playbooks_update" ON public.playbooks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "playbooks_delete" ON public.playbooks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "playbook_phases_select" ON public.playbook_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbook_phases_insert" ON public.playbook_phases FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "playbook_phases_update" ON public.playbook_phases FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "playbook_phases_delete" ON public.playbook_phases FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "playbook_tasks_select" ON public.playbook_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "playbook_tasks_insert" ON public.playbook_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "playbook_tasks_update" ON public.playbook_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "playbook_tasks_delete" ON public.playbook_tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. RPCs

-- Create playbook with phases and tasks in one transaction
CREATE OR REPLACE FUNCTION public.rpc_create_playbook(
  p_name text,
  p_job_type text,
  p_description text,
  p_tenant_id uuid,
  p_confidence_score integer DEFAULT 0,
  p_projects_analyzed integer DEFAULT 0,
  p_total_hours_low numeric DEFAULT NULL,
  p_total_hours_high numeric DEFAULT NULL,
  p_phases jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_playbook_id uuid;
  v_phase jsonb;
  v_task jsonb;
  v_phase_id uuid;
  v_phase_order integer := 0;
  v_task_order integer;
BEGIN
  INSERT INTO public.playbooks (name, job_type, description, tenant_id, confidence_score, projects_analyzed, total_hours_low, total_hours_high, created_by)
  VALUES (p_name, p_job_type, p_description, p_tenant_id, p_confidence_score, p_projects_analyzed, p_total_hours_low, p_total_hours_high, auth.uid())
  RETURNING id INTO v_playbook_id;

  FOR v_phase IN SELECT * FROM jsonb_array_elements(p_phases)
  LOOP
    INSERT INTO public.playbook_phases (playbook_id, name, description, sequence_order)
    VALUES (v_playbook_id, v_phase->>'name', v_phase->>'description', v_phase_order)
    RETURNING id INTO v_phase_id;

    v_task_order := 0;
    IF v_phase ? 'tasks' AND jsonb_typeof(v_phase->'tasks') = 'array' THEN
      FOR v_task IN SELECT * FROM jsonb_array_elements(v_phase->'tasks')
      LOOP
        INSERT INTO public.playbook_tasks (playbook_id, phase_id, title, description, estimated_hours, baseline_role_type, sequence_order)
        VALUES (
          v_playbook_id,
          v_phase_id,
          v_task->>'title',
          v_task->>'description',
          (v_task->>'estimated_hours')::numeric,
          v_task->>'baseline_role_type',
          v_task_order
        );
        v_task_order := v_task_order + 1;
      END LOOP;
    END IF;

    v_phase_order := v_phase_order + 1;
  END LOOP;

  RETURN v_playbook_id;
END;
$$;

-- List playbooks for a tenant with counts
CREATE OR REPLACE FUNCTION public.rpc_list_playbooks_by_tenant(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  job_type text,
  description text,
  version integer,
  is_archived boolean,
  confidence_score integer,
  projects_analyzed integer,
  total_hours_low numeric,
  total_hours_high numeric,
  phase_count bigint,
  task_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pb.id, pb.name, pb.job_type, pb.description, pb.version,
    pb.is_archived, pb.confidence_score, pb.projects_analyzed,
    pb.total_hours_low, pb.total_hours_high,
    COUNT(DISTINCT pp.id) as phase_count,
    COUNT(DISTINCT pt.id) as task_count,
    pb.created_at, pb.updated_at
  FROM public.playbooks pb
  LEFT JOIN public.playbook_phases pp ON pp.playbook_id = pb.id
  LEFT JOIN public.playbook_tasks pt ON pt.playbook_id = pb.id
  WHERE pb.tenant_id = p_tenant_id AND pb.is_archived = false
  GROUP BY pb.id
  ORDER BY pb.updated_at DESC;
END;
$$;

-- Get full playbook with phases and tasks
CREATE OR REPLACE FUNCTION public.rpc_get_playbook(p_playbook_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', pb.id,
    'name', pb.name,
    'job_type', pb.job_type,
    'description', pb.description,
    'version', pb.version,
    'confidence_score', pb.confidence_score,
    'projects_analyzed', pb.projects_analyzed,
    'total_hours_low', pb.total_hours_low,
    'total_hours_high', pb.total_hours_high,
    'phases', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'name', pp.name,
          'description', pp.description,
          'sequence_order', pp.sequence_order,
          'tasks', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', pt.id,
                'title', pt.title,
                'description', pt.description,
                'estimated_hours', pt.estimated_hours,
                'baseline_role_type', pt.baseline_role_type,
                'sequence_order', pt.sequence_order
              ) ORDER BY pt.sequence_order
            ) FROM public.playbook_tasks pt WHERE pt.phase_id = pp.id
          ), '[]'::jsonb)
        ) ORDER BY pp.sequence_order
      ) FROM public.playbook_phases pp WHERE pp.playbook_id = pb.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.playbooks pb
  WHERE pb.id = p_playbook_id;

  RETURN v_result;
END;
$$;
