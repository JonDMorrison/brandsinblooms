import { useState, useEffect } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { CheckCircle, Eye, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ReadyToPostItem } from "./ready-to-post/ReadyToPostItem";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks: propTasks, onTaskUpdate, onTaskClick }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  useEffect(() => {
    const fetchReadyTasks = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns (
              title,
              user_id
            )
          `)
          .eq('campaigns.user_id', user.id)
          .in('status', ['review', 'approved'])
          .not('ai_output', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) {
          console.error('Error fetching ready tasks:', error);
        } else {
          setTasks(data || []);
        }
      } catch (error) {
        console.error('Error in fetchReadyTasks:', error);
      }
    };

    // Use prop tasks if provided, otherwise fetch
    if (propTasks && propTasks.length > 0) {
      const readyTasks = propTasks
        .filter(task => ['review', 'approved'].includes(task.status) && task.ai_output)
        .slice(0, 6);
      setTasks(readyTasks);
    } else {
      fetchReadyTasks();
    }
  }, [user, propTasks]);

  const handleTaskClick = (task: any) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      setSelectedTask(task);
      setShowContentViewer(true);
    }
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
    if (onTaskUpdate) {
      onTaskUpdate();
    }
  };

  if (tasks.length === 0) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className="border-dashed border-2"
        hoverEffect="none"
        animated={true}
      >
        <AppleCardContent className="text-center py-12">
          <div className="flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mx-auto mb-4 apple-hover-subtle">
            <CheckCircle className="w-8 h-8 text-success apple-icon-bounce" />
          </div>
          <HeadlineMedium className="text-text-primary mb-2 apple-text-glow">
            No Content Ready Yet
          </HeadlineMedium>
          <BodyMedium className="text-text-secondary max-w-md mx-auto apple-color-transition">
            Generate content from your campaigns to see it here when it's ready to post
          </BodyMedium>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  return (
    <>
      <EnhancedAppleCard 
        variant="elevated" 
        surface="primary"
        hoverEffect="subtle"
        animated={true}
      >
        <AppleCardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 apple-slide-up">
              <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded-xl apple-hover-subtle">
                <CheckCircle className="w-5 h-5 text-success apple-icon-bounce" />
              </div>
              <div>
                <HeadlineMedium className="text-text-primary apple-text-glow">
                  Ready to Post
                </HeadlineMedium>
                <CaptionMedium className="text-text-secondary apple-color-transition">
                  {tasks.length} piece{tasks.length !== 1 ? 's' : ''} ready for publishing
                </CaptionMedium>
              </div>
            </div>
            <EnhancedAppleButton 
              variant="tertiary" 
              size="sm"
              iconAnimation="bounce"
              className="apple-stagger-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              View All
            </EnhancedAppleButton>
          </div>
        </AppleCardHeader>

        <AppleCardContent className="space-y-4">
          <ResponsiveGrid 
            cols={{ mobile: 1, tablet: 2, desktop: 2 }}
            gap={{ mobile: 3, tablet: 4, desktop: 4 }}
            animated={true}
          >
            {tasks.map((task) => (
              <ReadyToPostItem
                key={task.id}
                task={task}
                onClick={handleTaskClick}
              />
            ))}
          </ResponsiveGrid>

          {tasks.length >= 6 && (
            <div className="text-center pt-4 border-t border-border apple-slide-up">
              <EnhancedAppleButton 
                variant="secondary" 
                className="w-full"
                iconAnimation="bounce"
                pulseOnHover={true}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                View All Ready Content
              </EnhancedAppleButton>
            </div>
          )}
        </AppleCardContent>
      </EnhancedAppleCard>

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id}
          campaignTitle={selectedTask.campaigns?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
          initialTask={selectedTask}
        />
      )}
    </>
  );
};
