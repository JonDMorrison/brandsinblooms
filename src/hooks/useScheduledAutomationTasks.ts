import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ScheduledTask {
  id: string;
  tenant_id: string;
  automation_id: string | null;
  automation_run_id: string | null;
  customer_id: string;
  message_type: "email" | "sms";
  recipient: string;
  subject: string | null;
  content: string;
  scheduled_at: string;
  status: string;
  step_index: number;
  priority: number;
  created_at: string;
  // Joined data
  automation_name?: string;
  customer_name?: string;
  customer_email?: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  customer_id: string;
  tenant_id: string;
  status: "active" | "completed" | "paused" | "cancelled" | "failed";
  current_step_index: number;
  total_steps: number;
  next_step_scheduled_at: string | null;
  started_at: string;
  completed_at: string | null;
  trigger_data: Record<string, any>;
  metadata: Record<string, any>;
  error_message: string | null;
  // Joined data
  automation_name?: string;
  customer_name?: string;
  customer_email?: string;
}

interface UseScheduledTasksOptions {
  status?: string;
  automationId?: string;
  limit?: number;
}

export function useScheduledAutomationTasks(options: UseScheduledTasksOptions = {}) {
  const { status = "pending", automationId, limit = 50 } = options;

  return useQuery({
    queryKey: ["scheduled-tasks", status, automationId, limit],
    queryFn: async (): Promise<ScheduledTask[]> => {
      let query = supabase
        .from("crm_outbox")
        .select(`
          id,
          tenant_id,
          automation_id,
          automation_run_id,
          customer_id,
          message_type,
          recipient,
          subject,
          content,
          scheduled_at,
          status,
          step_index,
          priority,
          created_at
        `)
        .eq("status", status)
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (automationId) {
        query = query.eq("automation_id", automationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch automation names and customer info for the tasks
      const automationIds = [...new Set(data?.map((t) => t.automation_id).filter(Boolean))] as string[];
      const customerIds = [...new Set(data?.map((t) => t.customer_id).filter(Boolean))] as string[];

      const [automationsResult, customersResult] = await Promise.all([
        automationIds.length > 0
          ? supabase.from("crm_automations").select("id, name").in("id", automationIds)
          : { data: [] as { id: string; name: string }[] },
        customerIds.length > 0
          ? supabase.from("crm_customers").select("id, first_name, last_name, email").in("id", customerIds)
          : { data: [] as { id: string; first_name: string; last_name: string; email: string }[] },
      ]);

      const automationsMap = new Map<string, string>();
      automationsResult.data?.forEach((a) => automationsMap.set(a.id, a.name));
      
      const customersMap = new Map<string, { name: string; email: string }>();
      customersResult.data?.forEach((c) => {
        customersMap.set(c.id, { 
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email, 
          email: c.email 
        });
      });

      return (data || []).map((task) => ({
        ...task,
        message_type: task.message_type as "email" | "sms",
        automation_name: task.automation_id ? automationsMap.get(task.automation_id) : undefined,
        customer_name: customersMap.get(task.customer_id)?.name,
        customer_email: customersMap.get(task.customer_id)?.email,
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAutomationRuns(options: UseScheduledTasksOptions = {}) {
  const { status, automationId, limit = 50 } = options;

  return useQuery({
    queryKey: ["automation-runs", status, automationId, limit],
    queryFn: async (): Promise<AutomationRun[]> => {
      let query = supabase
        .from("automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }

      if (automationId) {
        query = query.eq("automation_id", automationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch automation names and customer info
      const automationIds = [...new Set(data?.map((r) => r.automation_id).filter(Boolean))] as string[];
      const customerIds = [...new Set(data?.map((r) => r.customer_id).filter(Boolean))] as string[];

      const [automationsResult, customersResult] = await Promise.all([
        automationIds.length > 0
          ? supabase.from("crm_automations").select("id, name").in("id", automationIds)
          : { data: [] as { id: string; name: string }[] },
        customerIds.length > 0
          ? supabase.from("crm_customers").select("id, first_name, last_name, email").in("id", customerIds)
          : { data: [] as { id: string; first_name: string; last_name: string; email: string }[] },
      ]);

      const automationsMap = new Map<string, string>();
      automationsResult.data?.forEach((a) => automationsMap.set(a.id, a.name));
      
      const customersMap = new Map<string, { name: string; email: string }>();
      customersResult.data?.forEach((c) => {
        customersMap.set(c.id, { 
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email, 
          email: c.email 
        });
      });

      return (data || []).map((run) => ({
        ...run,
        status: run.status as AutomationRun["status"],
        trigger_data: run.trigger_data as Record<string, any>,
        metadata: run.metadata as Record<string, any>,
        automation_name: automationsMap.get(run.automation_id),
        customer_name: customersMap.get(run.customer_id)?.name,
        customer_email: customersMap.get(run.customer_id)?.email,
      }));
    },
    refetchInterval: 30000,
  });
}

export function useCancelScheduledTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("crm_outbox")
        .update({ status: "cancelled" })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      toast({ title: "Task cancelled", description: "The scheduled message has been cancelled." });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to cancel task", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    },
  });
}

export function usePauseAutomationRun() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: "pause" | "resume" | "cancel" }) => {
      const statusMap = {
        pause: "paused",
        resume: "active",
        cancel: "cancelled",
      };

      const { error } = await supabase
        .from("automation_runs")
        .update({ status: statusMap[action] })
        .eq("id", runId);

      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      
      const messages = {
        pause: "Automation run paused",
        resume: "Automation run resumed",
        cancel: "Automation run cancelled",
      };
      
      toast({ title: messages[action] });
    },
    onError: (error) => {
      toast({ 
        title: "Action failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    },
  });
}

export function useScheduledTaskStats() {
  return useQuery({
    queryKey: ["scheduled-task-stats"],
    queryFn: async () => {
      const [pendingResult, activeRunsResult, completedTodayResult] = await Promise.all([
        supabase.from("crm_outbox").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("automation_runs").select("id", { count: "exact" }).eq("status", "active"),
        supabase
          .from("automation_runs")
          .select("id", { count: "exact" })
          .eq("status", "completed")
          .gte("completed_at", new Date().toISOString().split("T")[0]),
      ]);

      return {
        pendingMessages: pendingResult.count || 0,
        activeRuns: activeRunsResult.count || 0,
        completedToday: completedTodayResult.count || 0,
      };
    },
    refetchInterval: 60000,
  });
}
