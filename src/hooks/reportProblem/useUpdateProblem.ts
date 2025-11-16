import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProblemStatus, ProblemPriority } from '@/types/reportedProblems';

interface UpdateProblemData {
  problemId: string;
  status?: ProblemStatus;
  priority?: ProblemPriority;
  admin_notes?: string;
  assigned_to?: string;
}

export const useUpdateProblem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateProblemData) => {
      const updateData: any = {};
      
      if (data.status) updateData.status = data.status;
      if (data.priority) updateData.priority = data.priority;
      if (data.admin_notes !== undefined) updateData.admin_notes = data.admin_notes;
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to;
      if (data.status === 'resolved') updateData.resolved_at = new Date().toISOString();

      const { data: problem, error } = await supabase
        .from('reported_problems')
        .update(updateData)
        .eq('id', data.problemId)
        .select()
        .single();

      if (error) throw error;
      return problem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reported-problem', variables.problemId] });
      queryClient.invalidateQueries({ queryKey: ['reported-problems'] });
      toast({
        title: 'Problem Updated',
        description: 'Problem has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update problem',
        variant: 'destructive',
      });
    },
  });
};
