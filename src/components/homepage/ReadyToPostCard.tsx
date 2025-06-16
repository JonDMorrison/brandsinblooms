
import { useState, useEffect } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { CheckCircle, Eye, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ImprovedReadyToPostItem } from "./ready-to-post/ImprovedReadyToPostItem";
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
          if (data && data.length > 0) {
            setCurrentCampaign(data[0].campaigns);
          }
        }
      } catch (error) {
        console.error('Error in fetchReadyTasks:', error);
      }
    };

    if (propTasks && propTasks.length > 0) {
      const readyTasks = propTasks
        .filter(task => ['review', 'approved'].includes(task.status) && task.ai_output)
        .slice(0, 6);
      setTasks(readyTasks);
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
        className="border-dashed border-2 border-stone-200"
        hoverEffect="none"
        animated={true}
      >
        <AppleCardContent className={`
          text-center 
          ${isMobile ? 'py-6' : 'py-12'}
        `}>
          <div className={`
            flex items-center justify-center rounded-full mx-auto mb-4
            ${isMobile ? 'w-12 h-12 bg-stone-100' : 'w-16 h-16 bg-stone-100'}
          `}>
            <FileText className={`text-stone-500 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
          </div>
          <HeadlineMedium className={`text-stone-700 mb-2 ${isMobile ? 'text-lg' : ''}`}>
            No Content Ready Yet
          </HeadlineMedium>
          <BodyMedium className={`text-stone-600 max-w-md mx-auto ${isMobile ? 'text-sm' : ''}`}>
            Generate content from your campaigns to see it here when it's ready to use
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
        className={`border-l-4 border-l-blue-400 ${isMobile ? 'mobile-constrained' : ''}`}
      >
        <AppleCardHeader className={`${isMobile ? 'pb-3' : 'pb-4'}`}>
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-3 text-center' : ''}`}>
            <div className={`flex items-center gap-3 ${isMobile ? 'w-full justify-center text-center' : ''}`}>
              <div className={`
                flex items-center justify-center rounded-xl
                ${isMobile ? 'w-8 h-8 bg-blue-50' : 'w-10 h-10 bg-blue-50'}
              `}>
                <CheckCircle className={`text-blue-600 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
              </div>
              <div className={isMobile ? 'text-center' : ''}>
                <HeadlineMedium className={`text-stone-800 ${isMobile ? 'text-lg' : ''}`}>
                  Ready to Use
                </HeadlineMedium>
                <CaptionMedium className={`text-stone-600 ${isMobile ? 'text-sm' : ''}`}>
                  {tasks.length} piece{tasks.length !== 1 ? 's' : ''} ready for your marketing
                </CaptionMedium>
              </div>
            </div>
            {!isMobile && (
              <EnhancedAppleButton 
                variant="tertiary" 
                size="sm"
                iconAnimation="bounce"
                className="text-stone-600 hover:text-stone-800"
                onClick={handleViewAllContent}
              >
                <Eye className="w-4 h-4 mr-2" />
                View All
              </EnhancedAppleButton>
            )}
          </div>
        </AppleCardHeader>

        <AppleCardContent className="space-y-4">
          <ResponsiveGrid 
            cols={{ mobile: 1, tablet: 1, desktop: 2 }}
            gap={{ mobile: 3, tablet: 4, desktop: 4 }}
            animated={true}
          >
            {tasks.map((task) => (
              <ImprovedReadyToPostItem
                key={task.id}
                task={task}
                onClick={handleTaskClick}
                onTaskUpdate={onTaskUpdate}
                onEdit={onTaskClick}
              />
            ))}
          </ResponsiveGrid>

          {tasks.length >= 6 && (
            <div className="text-center pt-4 border-t border-stone-200">
              <EnhancedAppleButton 
                variant="secondary" 
                className={`border-stone-200 text-stone-700 hover:bg-stone-50 ${isMobile ? 'w-full' : 'w-full'}`}
                iconAnimation="bounce"
                onClick={handleViewAllContent}
              >
                <FileText className="w-4 h-4 mr-2" />
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
