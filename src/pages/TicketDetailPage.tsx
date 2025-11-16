import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Edit } from 'lucide-react';
import { useTicketDetail } from '@/hooks/helpdesk/useTicketDetail';
import { useComments } from '@/hooks/helpdesk/useComments';
import { useCreateComment } from '@/hooks/helpdesk/useCreateComment';
import { useUpdateTicketStatus } from '@/hooks/helpdesk/useUpdateTicketStatus';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge';
import { CommentThread } from '@/components/helpdesk/CommentThread';
import { UpdateStatusDialog } from '@/components/helpdesk/UpdateStatusDialog';
import { format } from 'date-fns';

const TicketDetailPage = () => {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const isAdmin = isSuperAdmin;

  const { data: ticket, isLoading: ticketLoading } = useTicketDetail(ticketId!);
  const { data: comments = [], isLoading: commentsLoading } = useComments(ticketId!);
  const createComment = useCreateComment();
  const updateStatus = useUpdateTicketStatus();

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !ticketId) return;

    await createComment.mutateAsync({
      ticketId,
      comment: newComment,
    });
    
    setNewComment('');
  };

  if (ticketLoading) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Loading ticket...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Ticket not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/helpdesk/tickets')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-sm text-muted-foreground">
              {ticket.ticket_number}
            </span>
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Update Status
          </Button>
        )}
      </div>

      <UpdateStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        currentStatus={ticket.status}
        onUpdateStatus={(status) => {
          updateStatus.mutate({ ticketId: ticketId!, status });
          setStatusDialogOpen(false);
        }}
        loading={updateStatus.isPending}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-foreground">{ticket.description}</p>
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                <p>Created {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments & Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {commentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                <CommentThread comments={comments} isAdmin={isAdmin} />
              )}

              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || createComment.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {createComment.isPending ? 'Sending...' : 'Send Comment'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Priority</p>
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              {ticket.category && (
                <div>
                  <p className="text-muted-foreground mb-1">Category</p>
                  <p className="font-medium">{ticket.category.name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Created</p>
                <p className="font-medium">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Last Updated</p>
                <p className="font-medium">
                  {format(new Date(ticket.updated_at), 'MMM d, yyyy')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
