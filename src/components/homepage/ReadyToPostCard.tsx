import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Leaf, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentTask } from "@/types/content";
import { AccordionReadyToPostItem } from "./ready-to-post/AccordionReadyToPostItem";
import { ContentViewerDialog } from "@/components/content/ContentViewerDialog";
import { SocialConnectionStatus } from "@/components/social/SocialConnectionStatus";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  const [socialConnections, setSocialConnections] = useState<any[]>([]);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchSocialConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching social connections:', error);
      } else {
        setSocialConnections(data || []);
      }
    } catch (error) {
      console.error('Exception fetching social connections:', error);
    }
  };

  const handleConnectPlatform = (platform: string) => {
    // For now, show a message about setting up OAuth
    toast.info(`To connect ${platform}, please set up OAuth credentials in your project settings.`);
  };

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
    fetchSocialConnections();
  }, [user, tenant, tasks]);

  const handleViewFull = (task: any) => {
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
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2 font-semibold">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sage-100 text-sage-600 text-sm font-bold">
              5
            </div>
            <Leaf className="w-5 h-5 text-sage-600" />
            Ready to Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-muted-foreground text-sm">Loading ready content...</p>
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
      <Card className="rounded-xl border border-border bg-card shadow-sm" data-section="ready-to-post-section">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg text-foreground flex items-center gap-2 font-semibold">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sage-100 text-sage-600 text-sm font-bold">
                  5
                </div>
                <CheckCircle2 className="w-5 h-5 text-sage-600" />
                Draft posts ready
                <Badge className="ml-2 px-2 py-0.5 rounded-full bg-sage-100 text-sage-600 text-[11px] font-medium">
                  {readyTasks.length} items
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 block text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-sage-600" />
                Open Publish Portal to schedule and publish
              </CardDescription>
            </div>
            <Button 
              onClick={() => window.location.href = '/publish'}
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm font-semibold shadow-md transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
            >
              <Sparkles className="w-4 h-4" />
              Open Publish Portal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Social Connection Status */}
          <SocialConnectionStatus
            connections={socialConnections}
            onConnectPlatform={handleConnectPlatform}
            onRefreshConnections={fetchSocialConnections}
          />
          
          
          {/* Legacy content list - keep for transition */}
          <div className="space-y-3">
            {readyTasks.slice(0, 3).map((task, index) => (
              <AccordionReadyToPostItem
                key={task.id}
                task={task}
                onViewFull={handleViewFull}
                onTaskUpdate={fetchReadyTasks}
                isFirst={index === 0}
                socialConnections={socialConnections}
              />
            ))}
          </div>
          
          {readyTasks.length > 3 && (
            <div className="text-center pt-4 mt-4 border-t border-border">
              <p className="text-muted-foreground text-sm">
                Showing 3 of {readyTasks.length} ready pieces • 
                <button 
                  onClick={() => window.location.href = '/publish'}
                  className="text-foreground hover:underline ml-1 font-medium"
                >
                  View all in Publish Portal
                </button>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Viewer Dialog */}
      {selectedTask && (
        <ContentViewerDialog
          campaignTitle={selectedTask.campaigns?.title || 'Content'}
          loading={false}
          tasks={[selectedTask]}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={handleContentViewerClose}
        />
      )}
    </>
  );
};
