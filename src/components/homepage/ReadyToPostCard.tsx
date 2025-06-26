
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Leaf } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentTask } from "@/types/content";
import { ImprovedReadyToPostItem } from "./ready-to-post/ImprovedReadyToPostItem";
import { ContentViewerDialog } from "@/components/content/ContentViewerDialog";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ReadyToPostCard = ({ tasks, onTaskUpdate }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [readyTasks, setReadyTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchReadyTasks = async () => {
    if (!user || !tenant) {
      setLoading(false);
      return;
    }

    console.log('🔍 READY_TO_POST: Fetching ready tasks for tenant:', tenant.id);

    try {
      // Build status filter for ready-to-post content - focus on approved content
      const statusFilter = ['approved', 'posted'];
      
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
        console.error('❌ READY_TO_POST: Error fetching ready tasks:', error);
        setReadyTasks([]);
      } else {
        console.log('📊 READY_TO_POST: Raw query results:', {
          totalFound: data?.length || 0,
          statusBreakdown: data?.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });

        // Security filter to double-check ownership
        const securityCheckedTasks = data?.filter(task => {
          if (tenant?.id) {
            return task.campaigns?.tenant_id === tenant.id;
          } else {
            return task.campaigns?.user_id === user.id || task.user_id === user.id;
          }
        }) || [];
        
        console.log('✅ READY_TO_POST: Security filtered results:', {
          finalCount: securityCheckedTasks.length,
          statuses: securityCheckedTasks.map(t => ({ id: t.id, status: t.status, type: t.post_type }))
        });
        
        setReadyTasks(securityCheckedTasks as ContentTask[]);
      }
    } catch (error) {
      console.error('❌ READY_TO_POST: Exception fetching ready tasks:', error);
      setReadyTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyTasks();
  }, [user, tenant, tasks]);

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setShowContentViewer(true);
  };

  const handleTaskEdit = (task: any, editMode: boolean) => {
    setSelectedTask(task);
    setShowContentViewer(true);
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
    fetchReadyTasks();
    if (onTaskUpdate) onTaskUpdate();
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
    console.log('🔍 READY_TO_POST: No ready tasks found, component will not render');
    return null;
  }

  return (
    <>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {readyTasks.map((task) => (
              <ImprovedReadyToPostItem
                key={task.id}
                task={task}
                onClick={handleTaskClick}
                onTaskUpdate={fetchReadyTasks}
                onEdit={handleTaskEdit}
              />
            ))}
          </div>
          
          {readyTasks.length > 4 && (
            <div className="text-center pt-4 mt-4 border-t border-blue-200">
              <p className="text-blue-600 text-sm">
                Showing {Math.min(4, readyTasks.length)} of {readyTasks.length} ready pieces
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Viewer Dialog */}
      {selectedTask && (
        <ContentViewerDialog
          task={selectedTask}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={handleContentViewerClose}
        />
      )}
    </>
  );
};
