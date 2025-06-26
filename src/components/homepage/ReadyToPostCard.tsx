
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Leaf } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentTask } from "@/types/content";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ReadyToPostCard = ({ tasks, onTaskUpdate }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [readyTasks, setReadyTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchReadyTasks = async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    try {
      // Build status filter for ready-to-post content - include both approved and review status
      const statusFilter = ['approved', 'review'];
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            id,
            title,
            week_number,
            start_date,
            tenant_id,
            user_id
          )
        `)
        .eq('tenant_id', tenant.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ready tasks:', error);
        setReadyTasks([]);
      } else {
        // Security filter to double-check ownership
        const securityCheckedTasks = data?.filter(task => {
          if (tenant?.id) {
            return task.campaigns?.tenant_id === tenant.id;
          } else {
            return task.campaigns?.user_id === user.id || task.user_id === user.id;
          }
        }) || [];
        
        setReadyTasks(securityCheckedTasks as ContentTask[]);
      }
    } catch (error) {
      console.error('Error fetching ready tasks:', error);
      setReadyTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyTasks();
  }, [user, tenant, tasks]);

  const handleMarkAsPosted = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .eq('id', taskId);

      if (error) throw error;

      // Refresh the tasks
      await fetchReadyTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error marking task as posted:', error);
    }
  };

  if (loading) {
    return (
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
              5
            </div>
            <Leaf className="w-5 h-5" />
            Ready to Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-blue-600 text-sm">Loading ready content...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no ready tasks
  if (readyTasks.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50" data-section="ready-to-post-section">
      <CardHeader>
        <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
            5
          </div>
          <CheckCircle2 className="w-5 h-5" />
          Ready to Post!
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            {readyTasks.length} approved
          </Badge>
        </CardTitle>
        <CardDescription className="text-blue-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Content approved and ready for your social media channels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {readyTasks.slice(0, 5).map((task) => (
            <div
              key={task.id}
              id={`task-${task.id}`}
              className="bg-white/70 border border-blue-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-blue-700 border-blue-300 text-xs">
                      {task.post_type || 'Social Post'}
                    </Badge>
                    <span className="text-xs text-blue-600">
                      {task.campaigns?.title}
                    </span>
                  </div>
                  <p className="text-sm text-blue-900 mb-2 line-clamp-2">
                    {task.ai_output?.substring(0, 120)}...
                  </p>
                  {task.hashtags && (
                    <p className="text-xs text-blue-600 mb-2">
                      {task.hashtags}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleMarkAsPosted(task.id)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    Mark Posted
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {readyTasks.length > 5 && (
            <div className="text-center pt-2">
              <p className="text-blue-600 text-sm">
                +{readyTasks.length - 5} more pieces ready to post
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
