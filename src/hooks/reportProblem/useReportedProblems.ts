import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReportedProblem } from '@/types/reportedProblems';

interface UseReportedProblemsOptions {
  status?: string;
  userId?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export const useReportedProblems = (options: UseReportedProblemsOptions = {}) => {
  return useQuery({
    queryKey: ['reported-problems', options],
    queryFn: async () => {
      let query = supabase
        .from('reported_problems')
        .select(`
          *,
          attachments:reported_problem_attachments(*)
        `)
        .order('created_at', { ascending: false });

      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options.url) {
        query = query.ilike('captured_url', `%${options.url}%`);
      }
      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReportedProblem[];
    },
  });
};
