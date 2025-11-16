import React from 'react';
import { SupportComment } from '@/types/helpdesk';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  comments: SupportComment[];
  isAdmin: boolean;
}

export const CommentThread: React.FC<Props> = ({ comments, isAdmin }) => {
  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        // Skip internal comments if not admin
        if (comment.is_internal && !isAdmin) return null;

        return (
          <div key={comment.id} className={`flex gap-3 p-4 rounded-lg border ${
            comment.is_internal ? 'bg-yellow-50 border-yellow-200' : 'bg-card'
          }`}>
            <Avatar>
              <AvatarFallback>
                {comment.user?.name?.charAt(0) || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground">{comment.user?.name}</span>
                {comment.user?.role === 'admin' && (
                  <Badge variant="secondary">Support Agent</Badge>
                )}
                {comment.is_internal && (
                  <Badge variant="outline" className="bg-yellow-100">Internal Note</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{comment.comment_text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
