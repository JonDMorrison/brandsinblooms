
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, FileText, Instagram, Facebook, Mail, BookOpen, Video, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReviewQueueProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

export const ReviewQueue = ({ onTaskUpdate, onTaskClick }: ReviewQueueProps) => {
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const fetchPendingTasks = useCallback(async () => {
    try {
      setError(null);
      console.log('ReviewQueue: Fetching pending tasks');
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title
          )
        `)
        .eq('status', 'draft')
        .not('ai_output', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ReviewQueue: Error fetching pending tasks:', error);
        throw new Error(`Failed to load pending tasks: ${error.message}`);
      }

      console.log('ReviewQueue: Loaded pending tasks:', data?.length || 0);
      setPendingTasks(data || []);
    } catch (error: any) {
      console.error('ReviewQueue: Error in fetchPendingTasks:', error);
      setError(error.message || 'Failed to load pending tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingTasks();
  }, [fetchPendingTasks]);

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

  const handleApprove = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      console.log('ReviewQueue: Approving task:', taskId);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', taskId);

      if (error) {
        console.error('ReviewQueue: Error approving task:', error);
        throw new Error(`Failed to approve content: ${error.message}`);
      }

      toast.success('Content approved successfully!');
      await fetchPendingTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error: any) {
      console.error('ReviewQueue: Error in handleApprove:', error);
      toast.error(error.message || 'Failed to approve content');
    } finally {
      setApprovingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const stripHtmlAndFormat = (content: string) => {
    if (!content) return '';
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  };

  if (loading) {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Review Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Review Queue - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-red-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">Failed to load review queue</p>
            <p className="text-sm">{error}</p>
            <Button 
              variant="outline" 
              className="mt-3"
              onClick={() => {
                setLoading(true);
                fetchPendingTasks();
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingTasks.length === 0) {
    return (
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Review Queue
          </CardTitle>
          <CardDescription>
            Content ready for your review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm">No content pending review</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Review Queue
          <Badge className="bg-orange-100 text-orange-800">
            {pendingTasks.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingTasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getPostTypeIcon(task.post_type)}
                <Badge className="bg-orange-100 text-orange-800">
                  {task.post_type}
                </Badge>
                {task.campaigns?.title && (
                  <span className="text-sm text-gray-600">
                    {task.campaigns.title}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={(e) => handleApprove(task.id, e)}
                disabled={approvingTasks.has(task.id)}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {approvingTasks.has(task.id) ? 'Approving...' : 'Approve'}
              </Button>
            </div>
            
            <p className="text-sm text-gray-700 line-clamp-2">
              {stripHtmlAndFormat(task.ai_output)}
            </p>
          </div>
        ))}
        
        {pendingTasks.length > 3 && (
          <Button variant="outline" className="w-full">
            View All {pendingTasks.length} Items
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
