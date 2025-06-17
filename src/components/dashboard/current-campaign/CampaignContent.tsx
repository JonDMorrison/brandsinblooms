
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardHeader, AppleCardContent } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { HeadlineMedium, CaptionMedium, BodyMedium } from "@/components/ui/typography";
import { CheckCircle, Sparkles } from "lucide-react";
import { TaskItem } from "./TaskItem";

interface CampaignContentProps {
  activeCampaign: any;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTaskUpdate: () => void;
}

export const CampaignContent = ({ 
  activeCampaign, 
  tasks, 
  onTaskClick, 
  onTaskUpdate 
}: CampaignContentProps) => {
  return (
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
                onClick={() => onTaskClick(task)}
                onTaskUpdate={onTaskUpdate}
              />
            ))}
          </div>
        )}
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
