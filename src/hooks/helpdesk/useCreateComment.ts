import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CreateCommentData {
  ticketId: string;
  comment: string;
  isInternal?: boolean;
  attachments?: File[];
}

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateCommentData) => {
      if (!user) throw new Error('Not authenticated');

      // Create comment
      const { data: comment, error: commentError } = await supabase
        .from('support_comments')
        .insert({
          ticket_id: data.ticketId,
          user_id: user.id,
          comment_text: data.comment,
          is_internal: data.isInternal || false,
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Upload attachments if any
      if (data.attachments?.length) {
        for (const file of data.attachments) {
          const filePath = `${user.id}/${data.ticketId}/${comment.id}/${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Create attachment record
          await supabase.from('support_attachments').insert({
            comment_id: comment.id,
            ticket_id: data.ticketId,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
          });
        }
      }

      return comment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-comments', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      toast({
        title: 'Comment Added',
        description: 'Your comment has been added successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add comment',
        variant: 'destructive',
      });
    },
  });
};
