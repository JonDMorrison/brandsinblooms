import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

interface CreateProblemData {
  title: string;
  description: string;
  capturedUrl: string;
  userAgent?: string;
  viewportSize?: string;
  browserInfo?: Record<string, any>;
  attachments?: File[];
}

export const useCreateProblem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async (problemData: CreateProblemData) => {
      if (!user || !tenant?.id) throw new Error('Not authenticated');

      // Create problem record
      const { data: problem, error: problemError } = await supabase
        .from('reported_problems')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          user_email: user.email!,
          title: problemData.title,
          description: problemData.description,
          captured_url: problemData.capturedUrl,
          user_agent: problemData.userAgent,
          viewport_size: problemData.viewportSize,
          browser_info: problemData.browserInfo || {},
          status: 'open',
          priority: 'medium',
        })
        .select()
        .single();

      if (problemError) throw problemError;

      // Upload attachments if any
      if (problemData.attachments?.length) {
        for (const file of problemData.attachments) {
          const filePath = `${user.id}/${problem.id}/${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('problem-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Create attachment record
          await supabase.from('reported_problem_attachments').insert({
            problem_id: problem.id,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
          });
        }
      }

      return problem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reported-problems'] });
      toast({
        title: 'Problem Reported',
        description: 'Thank you for reporting this issue. We will look into it.',
      });
    },
    onError: (error: any) => {
      console.error('Create problem error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to report problem',
        variant: 'destructive',
      });
    },
  });
};
