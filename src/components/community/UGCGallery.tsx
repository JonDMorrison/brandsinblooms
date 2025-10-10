import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Eye, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface UGCSubmission {
  id: string;
  image_url: string | null;
  video_url: string | null;
  caption_text: string | null;
  customer_name: string | null;
  status: string;
  tags: string[];
  created_at: string;
  customer_consent: boolean;
}

export const UGCGallery = () => {
  const [submissions, setSubmissions] = useState<UGCSubmission[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSubmissions = async () => {
    try {
      let query = (supabase as any)
        .from('ugc_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubmissions((data as UGCSubmission[]) || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await (supabase as any)
        .from('ugc_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Submission ${status}`,
      });
      fetchSubmissions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      const { error } = await (supabase as any)
        .from('ugc_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Submission removed' });
      fetchSubmissions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending_review: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      published: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-12">Loading submissions...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending_review">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {submissions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No submissions yet. Start capturing customer stories!
          </div>
        ) : (
          submissions.map((submission) => (
            <Card key={submission.id} className="overflow-hidden">
              {submission.image_url && (
                <img
                  src={submission.image_url}
                  alt={submission.customer_name || 'Customer story'}
                  className="w-full h-48 object-cover"
                />
              )}
              {submission.video_url && !submission.image_url && (
                <video
                  src={submission.video_url}
                  className="w-full h-48 object-cover"
                  controls
                />
              )}
              
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{submission.customer_name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {submission.caption_text}
                    </p>
                  </div>
                  {getStatusBadge(submission.status)}
                </div>

                {submission.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {submission.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {submission.status === 'pending_review' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => updateStatus(submission.id, 'approved')}
                      className="flex-1"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatus(submission.id, 'rejected')}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {submission.status === 'approved' && (
                  <Button
                    size="sm"
                    onClick={() => updateStatus(submission.id, 'published')}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Publish
                  </Button>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSubmission(submission.id)}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
