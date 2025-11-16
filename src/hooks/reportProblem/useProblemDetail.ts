import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useProblemDetail = (problemId: string | undefined) => {
  return useQuery({
    queryKey: ['reported-problem', problemId],
    queryFn: async () => {
      if (!problemId) throw new Error('Problem ID required');

      const { data, error } = await supabase
        .from('reported_problems')
        .select(`
          *,
          attachments:reported_problem_attachments(*)
        `)
        .eq('id', problemId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!problemId,
  });
};
