import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PlaybookSummary {
  id: string;
  name: string;
  job_type: string | null;
  description: string | null;
  version: number;
  is_archived: boolean;
  confidence_score: number;
  projects_analyzed: number;
  total_hours_low: number | null;
  total_hours_high: number | null;
  phase_count: number;
  task_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaybookTask {
  id: string;
  title: string;
  description: string | null;
  estimated_hours: number | null;
  baseline_role_type: string | null;
  sequence_order: number;
}

export interface PlaybookPhase {
  id: string;
  name: string;
  description: string | null;
  sequence_order: number;
  tasks: PlaybookTask[];
}

export interface PlaybookDetail {
  id: string;
  name: string;
  job_type: string | null;
  description: string | null;
  version: number;
  confidence_score: number;
  projects_analyzed: number;
  total_hours_low: number | null;
  total_hours_high: number | null;
  phases: PlaybookPhase[];
}

export interface GeneratePlaybookParams {
  job_type: string;
  audience?: string;
  trade_name?: string;
  org_id?: string;
}

export interface GeneratedPlaybook {
  name: string;
  job_type: string;
  description: string;
  confidence_score: number;
  data_quality_note: string;
  projects_analyzed: number;
  total_hours_band: { low: number; high: number };
  phases: {
    name: string;
    description: string;
    sequence_order: number;
    tasks: {
      title: string;
      description: string;
      estimated_hours: number;
      baseline_role_type: string;
      sequence_order: number;
    }[];
  }[];
}

async function getOrgId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("organization_memberships" as any)
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data?.org_id) return null;
  return data.org_id as string;
}

export function usePlaybooks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["playbooks", user?.id],
    queryFn: async (): Promise<PlaybookSummary[]> => {
      if (!user) return [];
      const orgId = await getOrgId(user.id);
      if (!orgId) return [];

      const { data, error } = await supabase.rpc("rpc_list_playbooks_by_org" as any, {
        p_org_id: orgId,
      });
      if (error) throw error;
      return (data as PlaybookSummary[]) || [];
    },
    enabled: !!user,
  });
}

export function usePlaybook(playbookId: string | null) {
  return useQuery({
    queryKey: ["playbook", playbookId],
    queryFn: async (): Promise<PlaybookDetail | null> => {
      if (!playbookId) return null;
      const { data, error } = await supabase.rpc("rpc_get_playbook" as any, {
        p_playbook_id: playbookId,
      });
      if (error) throw error;
      return data as PlaybookDetail | null;
    },
    enabled: !!playbookId,
  });
}

export function useGeneratePlaybook() {
  return useMutation({
    mutationFn: async (params: GeneratePlaybookParams): Promise<GeneratedPlaybook> => {
      const { data, error } = await supabase.functions.invoke("generate-playbook", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as GeneratedPlaybook;
    },
    onError: (error: Error) => {
      toast.error("Failed to generate playbook: " + error.message);
    },
  });
}

export function useCreatePlaybook() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      job_type?: string;
      description?: string;
      confidence_score?: number;
      projects_analyzed?: number;
      total_hours_low?: number;
      total_hours_high?: number;
      phases?: GeneratedPlaybook["phases"];
    }): Promise<string> => {
      if (!user) throw new Error("Not authenticated");
      const orgId = await getOrgId(user.id);
      if (!orgId) throw new Error("No organization found");

      const { data, error } = await supabase.rpc("rpc_create_playbook" as any, {
        p_name: params.name,
        p_job_type: params.job_type || null,
        p_description: params.description || null,
        p_org_id: orgId,
        p_confidence_score: params.confidence_score ?? 0,
        p_projects_analyzed: params.projects_analyzed ?? 0,
        p_total_hours_low: params.total_hours_low ?? null,
        p_total_hours_high: params.total_hours_high ?? null,
        p_phases: JSON.stringify(params.phases || []),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      toast.success("Playbook created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create playbook: " + error.message);
    },
  });
}
