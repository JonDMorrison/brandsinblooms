import { useState, useEffect } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { PlusCircle, CheckCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TaskItem } from "./current-campaign/TaskItem";
import { ContentViewer } from "@/components/content/ContentViewer";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface CurrentCampaignSectionProps {
  activeCampaign: any;
  onTaskUpdate: () => void;
  onCreateCampaign: () => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const CurrentCampaignSection = ({
  activeCampaign,
  onTaskUpdate,
  onCreateCampaign,
  onCampaignCreated,
  onTaskClick
}: CurrentCampaignSectionProps) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showContentViewer, setShowContentViewer] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!activeCampaign) {
        setTasks([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('campaign_id', activeCampaign.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tasks:', error);
        } else {
          setTasks(data || []);
        }
      } catch (error) {
        console.error('Error in fetchTasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [activeCampaign]);

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

  if (!activeCampaign) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className="border-dashed border-2"
        hoverEffect="none"
        animated={true}
        data-campaign-section="true"
      >
        <AppleCardContent className="text-center py-12">
          <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto mb-4 apple-hover-subtle">
            <PlusCircle className="w-8 h-8 text-primary apple-icon-bounce" />
          </div>
          <HeadlineMedium className="text-text-primary mb-2 apple-text-glow">
            No Active Campaign
          </HeadlineMedium>
          <BodyMedium className="text-text-secondary max-w-md mx-auto apple-color-transition">
            Start a new campaign to generate content for this week
          </BodyMedium>
          <EnhancedAppleButton 
            variant="primary" 
            className="mt-6"
            iconAnimation="bounce"
            onClick={onCreateCampaign}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Campaign
          </EnhancedAppleButton>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  if (loading) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="primary" 
        className="mx-auto max-w-md"
        animated={true}
        data-campaign-section="true"
      >
        <AppleCardContent className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <BodyMedium className="text-text-secondary mt-4">
            Loading campaign content...
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
        data-campaign-section="true"
      >
        <AppleCardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 apple-slide-up">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl apple-hover-subtle">
                <Sparkles className="w-5 h-5 text-primary apple-icon-bounce" />
              </div>
              <div>
                <HeadlineMedium className="text-text-primary apple-text-glow">
                  Current Campaign
                </HeadlineMedium>
                <CaptionMedium className="text-text-secondary apple-color-transition">
                  {activeCampaign.title}
                </CaptionMedium>
              </div>
            </div>
            <EnhancedAppleButton 
              variant="tertiary" 
              size="sm"
              iconAnimation="bounce"
              className="apple-stagger-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Complete
            </EnhancedAppleButton>
          </div>
        </AppleCardHeader>

        <AppleCardContent className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-8 apple-slide-up">
              <BodyMedium className="text-text-secondary">
                No content has been generated for this campaign yet.
              </BodyMedium>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task)}
                  onTaskUpdate={onTaskUpdate}
                />
              ))}
            </div>
          )}
        </AppleCardContent>
      </EnhancedAppleCard>

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id}
          campaignTitle={activeCampaign?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
};
