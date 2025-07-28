
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Leaf, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentTask } from "@/types/content";
import { AccordionReadyToPostItem } from "./ready-to-post/AccordionReadyToPostItem";
import { ContentViewerDialog } from "@/components/content/ContentViewerDialog";
import { SocialConnectionStatus } from "@/components/social/SocialConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { useNavigate } from "react-router-dom";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ReadyToPostCard = ({ tasks, onTaskUpdate }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [readyTasks, setReadyTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [socialConnections, setSocialConnections] = useState<any[]>([]);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const { toast } = useToast();
  
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
    toast({
      title: "Setup Required",
      description: `To connect ${platform}, please set up OAuth credentials in your project settings.`,
    });
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
        toast({
          title: "Error",
          description: 'Unsupported post type for quick publish',
          variant: "destructive",
        });
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
        toast({
          title: "Error",
          description: `Publishing failed: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
        if (successCount === totalCount) {
          toast({
            title: "Success",
            description: `✅ Successfully published to ${task.post_type}!`,
          });
        } else if (successCount > 0) {
          toast({
            title: "Partial Success",
            description: `Published to ${successCount}/${totalCount} platforms`,
          });
        } else {
          toast({
            title: "Error",
            description: 'Publishing failed',
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: data?.message || 'Publishing failed',
          variant: "destructive",
        });
      }
      
      // Refresh the ready tasks
      fetchReadyTasks();
      if (onTaskUpdate) onTaskUpdate();
      
    } catch (error) {
      console.error('Error in quick publish:', error);
      toast({
        title: "Error",
        description: 'Failed to publish - please try again',
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Modern Gradient Header Section */}
      <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50/30 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8 mb-8">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5">
            <Send className="w-64 h-64 text-green-400" />
          </div>
        </div>
        
        {/* Header Content */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex flex-col gap-3 text-left">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                <Send className="w-8 h-8 text-white" />
              </div>
              <HeadlineLarge className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent text-left">Your Approved Posts</HeadlineLarge>
            </div>
            <BodyMedium className="text-lg text-slate-600 max-w-2xl leading-relaxed text-left">
              Approved content ready for publishing and scheduling
            </BodyMedium>
          </div>
        </div>
      </div>

      {/* Content Card */}
      {loading ? (
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardContent className="relative z-10 py-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading ready content...</p>
            </div>
          </CardContent>
        </Card>
      ) : readyTasks.length === 0 ? (
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardContent className="relative z-10 py-16 px-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
                <Clock className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-3">No content ready to post</h3>
              <p className="text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
                Generate and approve content to see it here. Content needs to be approved before it can be published.
              </p>
              <div className="relative group inline-block">
                <Button 
                  onClick={() => navigate('/')}
                  className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  Generate Content
                </Button>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl blur-xl group-hover:blur-lg transition-all duration-300"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden" data-section="ready-to-post-section">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardHeader className="relative z-10">
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
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
                    onClick={() => navigate('/publish')}
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
