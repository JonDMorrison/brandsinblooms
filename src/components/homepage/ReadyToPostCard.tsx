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
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";

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
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('🔍 READY_TO_POST: Fetching ready tasks for user:', user.id, 'tenant:', tenant?.id);

    try {
      // Build status filter for ready-to-post content - focus on approved content
      const statusFilter = ['approved'];
      
      // Build query that works for both tenant and non-tenant users
      let query = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            id,
            title,
            week_number,
            start_date,
            tenant_id,
            user_id
          )
        `)
        .in('status', statusFilter)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply appropriate filter based on tenant setup
      if (tenant?.id) {
        query = query.eq('tenant_id', tenant.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ READY_TO_POST: Error fetching ready tasks:', error);
        setReadyTasks([]);
      } else {
        console.log('📊 READY_TO_POST: Raw query results:', {
          totalFound: data?.length || 0,
          statusBreakdown: data?.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sampleTasks: data?.slice(0, 3).map(t => ({ 
            id: t.id, 
            status: t.status, 
            type: t.post_type,
            hasAiOutput: !!t.ai_output,
            campaignTitle: t.campaigns?.title
          }))
        });

        // Security filter to double-check ownership
        const securityCheckedTasks = data?.filter(task => {
          if (tenant?.id) {
            return task.campaigns?.tenant_id === tenant.id || task.tenant_id === tenant.id;
          } else {
            return task.campaigns?.user_id === user.id || task.user_id === user.id;
          }
        }) || [];
        
        console.log('✅ READY_TO_POST: Security filtered results:', {
          finalCount: securityCheckedTasks.length,
          statuses: securityCheckedTasks.map(t => ({ 
            id: t.id, 
            status: t.status, 
            type: t.post_type,
            aiOutput: t.ai_output?.substring(0, 50) + '...' 
          }))
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

  const handlePublishNow = async (task: any) => {
    try {
      console.log('🚀 Quick publishing task:', task.id);
      
      // Determine platforms based on post type
      const platforms = [];
      if (task.post_type === 'facebook') {
        platforms.push('facebook');
      } else if (task.post_type === 'instagram') {
        platforms.push('instagram');
      }
      
      if (platforms.length === 0) {
        toast.error('Unsupported post type for quick publish');
        return;
      }

      // Call the publish-task endpoint
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: task.id,
          platforms
        }
      });

      if (error) {
        console.error('Quick publish error:', error);
        toast.error(`Publishing failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
        if (successCount === totalCount) {
          toast.success(`✅ Successfully published to ${task.post_type}!`);
        } else if (successCount > 0) {
          toast.success(`Published to ${successCount}/${totalCount} platforms`);
        } else {
          toast.error('Publishing failed');
        }
      } else {
        toast.error(data?.message || 'Publishing failed');
      }
      
      // Refresh the ready tasks
      fetchReadyTasks();
      if (onTaskUpdate) onTaskUpdate();
      
    } catch (error) {
      console.error('Error in quick publish:', error);
      toast.error('Failed to publish - please try again');
    }
  };

  return (
    <>
      {/* Header Section - Always shown, matches Seasonal Marketing Opportunities pattern */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2 text-left">
          <HeadlineLarge className="text-left">Your Approved Posts</HeadlineLarge>
          <BodyMedium className="text-muted-foreground text-left">
            Approved content ready for publishing and scheduling
          </BodyMedium>
        </div>
        {readyTasks.length > 0 && (
          <Button 
            onClick={() => window.location.href = '/publish'}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-md bg-mint-600 px-4 py-2 text-white text-sm font-semibold shadow-md transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-mint-600"
          >
            <Sparkles className="w-4 h-4" />
            Open Publish Portal
          </Button>
        )}
      </div>

      {/* Content Card */}
      {loading ? (
        <Card className="rounded-xl border border-gray-200 bg-[#FBF9F4] shadow-sm">
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-mint-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">Loading ready content...</p>
            </div>
          </CardContent>
        </Card>
      ) : readyTasks.length === 0 ? (
        <Card className="rounded-xl border border-gray-200 bg-[#FBF9F4] shadow-sm">
          <CardContent className="py-8">
            <div className="text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-2">No content ready to post</p>
              <p className="text-gray-500 text-sm mb-4">
                Generate and approve content to see it here. Content needs to be approved before it can be published.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="text-sm"
              >
                Generate Content
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-gray-200 bg-[#FBF9F4] shadow-sm" data-section="ready-to-post-section">
          <CardHeader>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Social Connection Status */}
            <SocialConnectionStatus
              connections={socialConnections}
              onConnectPlatform={handleConnectPlatform}
              onRefreshConnections={fetchSocialConnections}
            />
            
            {/* Content list */}
            <div className="space-y-3">
              {readyTasks.slice(0, 10).map((task, index) => (
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
            
            {readyTasks.length > 10 && (
              <div className="text-center pt-4 mt-4 border-t border-gray-200">
                <p className="text-gray-600 text-sm">
                  Showing 10 of {readyTasks.length} ready pieces • 
                  <button 
                    onClick={() => window.location.href = '/publish'}
                    className="text-brand-navy hover:underline ml-1 font-medium"
                  >
                    View all in Publish Portal
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
