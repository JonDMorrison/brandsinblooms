
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Sparkles, FileText, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContentTask {
  id: string;
  post_type: string;
  status: string;
  ai_output?: string;
  scheduled_date: string;
  hashtags?: string;
  image_idea?: string;
}

interface ContentPackReviewModalProps {
  campaignId: string;
  campaignTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onContentApproved?: () => void;
}

export const ContentPackReviewModal = ({
  campaignId,
  campaignTitle,
  isOpen,
  onClose,
  onContentApproved
}: ContentPackReviewModalProps) => {
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchGeneratedContent();
    }
  }, [isOpen, campaignId]);

  const fetchGeneratedContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .in('status', ['review', 'generated'])
        .order('post_type', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching generated content:', error);
      toast.error('Failed to load generated content');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    setApproving(prev => new Set(prev).add(taskId));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .eq('id', taskId);

      if (error) throw error;

      setApproved(prev => new Set(prev).add(taskId));
      toast.success('Content approved and scheduled!');
      
      if (onContentApproved) {
        onContentApproved();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApproving(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleApproveAll = async () => {
    const unapprovedTasks = tasks.filter(task => !approved.has(task.id));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .in('id', unapprovedTasks.map(t => t.id));

      if (error) throw error;

      setApproved(new Set(tasks.map(t => t.id)));
      toast.success(`All ${unapprovedTasks.length} pieces approved and scheduled!`);
      
      if (onContentApproved) {
        onContentApproved();
      }
    } catch (error) {
      console.error('Error approving all content:', error);
      toast.error('Failed to approve all content');
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Content copied to clipboard!');
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'email': return '📧';
      case 'newsletter': return '📰';
      case 'video': return '🎥';
      case 'linkedin': return '💼';
      default: return '📝';
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Content Pack Review
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-3 text-gray-600">Loading generated content...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (tasks.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              No Generated Content Found
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              No generated content found for this campaign. Use the "Generate Content Pack" button to create content first.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const unapprovedCount = tasks.filter(task => !approved.has(task.id)).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Content Pack Review - {campaignTitle}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">
                {tasks.length} pieces generated
              </Badge>
              {unapprovedCount > 0 && (
                <Button
                  onClick={handleApproveAll}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve All ({unapprovedCount})
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tasks.map((task) => {
              const isApproved = approved.has(task.id);
              const isApproving = approving.has(task.id);
              
              return (
                <Card key={task.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span>{getPostTypeIcon(task.post_type)}</span>
                        <span className="capitalize">{task.post_type}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <Clock className="w-3 h-3 mr-1" />
                            Review
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded-lg border">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {task.ai_output}
                      </p>
                    </div>
                    
                    {task.hashtags && (
                      <div className="text-xs text-gray-600">
                        <strong>Hashtags:</strong> {task.hashtags}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyContent(task.ai_output || '')}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                      
                      {!isApproved && (
                        <Button
                          size="sm"
                          onClick={() => handleApproveTask(task.id)}
                          disabled={isApproving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isApproving ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                              Approving...
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">
              Once approved, content will appear on your calendar with scheduled dates.
            </p>
            <Button onClick={onClose} variant="outline">
              Close Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
