
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, CheckCircle, Edit, ExternalLink, Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ContentViewerProps {
  campaignId: string;
  campaignTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ContentViewer = ({ campaignId, campaignTitle, isOpen, onClose, onTaskUpdate }: ContentViewerProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const fetchTasks = async () => {
    if (!campaignId || !isOpen) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to load content');
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTasks();
  }, [campaignId, isOpen]);

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'newsletter': return <BookOpen className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'generating': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApprove = async (taskId: string) => {
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', taskId);

      if (error) {
        console.error('Error approving task:', error);
        toast.error('Failed to approve content');
      } else {
        toast.success('Content approved successfully!');
        fetchTasks();
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApprovingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleCopy = (content: string) => {
    if (!content) return;
    
    // Strip HTML and format for copying
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, '\n')
      .trim();
    
    navigator.clipboard.writeText(cleanContent);
    toast.success('Content copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {campaignTitle} - Generated Content
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No content generated yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPostTypeIcon(task.post_type)}
                      <span className="font-medium capitalize">{task.post_type}</span>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      {task.ai_output && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(task.ai_output)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      )}
                      
                      {task.status === 'draft' && task.ai_output && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(task.id)}
                          disabled={approvingTasks.has(task.id)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {approvingTasks.has(task.id) ? 'Approving...' : 'Approve'}
                        </Button>
                      )}
                      
                      {task.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toast.info('Publishing integration coming soon')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>

                  {task.ai_output && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: task.ai_output }}
                      />
                    </div>
                  )}

                  {task.scheduled_date && (
                    <p className="text-xs text-gray-500">
                      Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
