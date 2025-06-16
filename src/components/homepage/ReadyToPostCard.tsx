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
import { EnhancedReadyToPostItem } from "./ready-to-post/EnhancedReadyToPostItem";
import { useIsMobile } from "@/hooks/use-mobile";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks: propTasks, onTaskUpdate, onTaskClick }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [showAllContent, setShowAllContent] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<any>(null);

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
          // Store the first campaign for "View All" functionality
          if (data && data.length > 0) {
            setCurrentCampaign(data[0].campaigns);
          }
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
      // Get campaign info from the first task
      if (readyTasks.length > 0) {
        setCurrentCampaign(readyTasks[0].campaigns);
      }
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

  const handleViewAllContent = () => {
    if (currentCampaign && tasks.length > 0) {
      // Use the campaign from the first task to show all content
      const firstTask = tasks[0];
      setSelectedTask(firstTask);
      setShowAllContent(true);
      setShowContentViewer(true);
    }
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
    setShowAllContent(false);
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
        <AppleCardContent className={`
          text-center 
          ${isMobile ? 'py-6 mobile-card-spacing' : 'py-12'}
        `}>
          <div className={`
            flex items-center justify-center rounded-full mx-auto mb-4 apple-hover-subtle
            ${isMobile ? 'w-12 h-12 bg-success/10' : 'w-16 h-16 bg-success/10'}
          `}>
            <CheckCircle className={`text-success apple-icon-bounce ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
          </div>
          <HeadlineMedium className={`text-text-primary mb-2 apple-text-glow ${isMobile ? 'responsive-text-lg' : ''}`}>
            No Content Ready Yet
          </HeadlineMedium>
          <BodyMedium className={`text-text-secondary max-w-md mx-auto apple-color-transition ${isMobile ? 'responsive-text-sm' : ''}`}>
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
        className={isMobile ? 'mobile-constrained apple-card-mobile-optimized' : ''}
      >
        <AppleCardHeader className={`${isMobile ? 'pb-3 mobile-header-padding' : 'pb-4'}`}>
          <div className={`flex items-center justify-between ${isMobile ? 'mobile-header-stacked' : ''}`}>
            <div className={`flex items-center gap-3 apple-slide-up ${isMobile ? 'w-full justify-center text-center' : ''}`}>
              <div className={`
                flex items-center justify-center rounded-xl apple-hover-subtle
                ${isMobile ? 'mobile-icon-container bg-success/10' : 'w-10 h-10 bg-success/10'}
              `}>
                <CheckCircle className={`text-success apple-icon-bounce ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              </div>
              <div className={isMobile ? 'text-center' : ''}>
                <HeadlineMedium className={`text-text-primary apple-text-glow ${isMobile ? 'responsive-text-lg' : ''}`}>
                  Ready to Post
                </HeadlineMedium>
                <CaptionMedium className={`text-text-secondary apple-color-transition ${isMobile ? 'responsive-text-sm' : ''}`}>
                  {tasks.length} piece{tasks.length !== 1 ? 's' : ''} ready for publishing
                </CaptionMedium>
              </div>
            </div>
            {!isMobile && (
              <EnhancedAppleButton 
                variant="tertiary" 
                size="sm"
                iconAnimation="bounce"
                className="apple-stagger-1"
                onClick={handleViewAllContent}
              >
                <Eye className="w-4 h-4 mr-2" />
                View All
              </EnhancedAppleButton>
            )}
          </div>
        </AppleCardHeader>

        <AppleCardContent className={`
          space-y-4 
          ${isMobile ? 'apple-card-content-mobile' : ''}
        `}>
          <ResponsiveGrid 
            cols={{ mobile: 1, tablet: 1, desktop: 2 }}
            gap={{ mobile: 3, tablet: 4, desktop: 4 }}
            animated={true}
          >
            {tasks.map((task) => (
              <EnhancedReadyToPostItem
                key={task.id}
                task={task}
                onClick={handleTaskClick}
                onTaskUpdate={onTaskUpdate}
              />
            ))}
          </ResponsiveGrid>

          {tasks.length >= 6 && (
            <div className={`
              text-center pt-4 border-t border-border apple-slide-up 
              ${isMobile ? 'mobile-card-spacing' : ''}
            `}>
              <EnhancedAppleButton 
                variant="secondary" 
                className={`${isMobile ? 'w-full apple-button-mobile' : 'w-full'}`}
                iconAnimation="bounce"
                pulseOnHover={!isMobile}
                onClick={handleViewAllContent}
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
          campaignTitle={selectedTask.campaigns?.title || currentCampaign?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
};
