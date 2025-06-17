
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Eye, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import { TaskImagePreview } from "./TaskImagePreview";
import { useTaskImages } from "@/hooks/useTaskImages";

interface TaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskItem = ({ task, onClick, onTaskUpdate }: TaskItemProps) => {
  console.log('TaskItem: Rendering task:', task.id, task.post_type, task.status);
  
  const { images, imageCount, loading: imagesLoading } = useTaskImages(task?.id);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'posted':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'review':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'pending':
      case 'generated':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'posted':
        return 'text-blue-600';
      case 'review':
        return 'text-orange-600';
      case 'pending':
      case 'generated':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusLabel = () => {
    switch (task.status) {
      case 'posted':
        return 'Ready to Post';
      case 'review':
        return 'Needs Approval';
      case 'pending':
      case 'generated':
        return 'Draft';
      default:
        return task.status?.charAt(0).toUpperCase() + task.status?.slice(1) || 'Draft';
    }
  };

  const hasContent = task.ai_output && task.ai_output.trim() !== '';

  return (
    <EnhancedAppleCard 
      variant="default" 
      surface="secondary"
      hoverEffect="subtle"
      animated={true}
      className="cursor-pointer apple-stagger-1"
      onClick={() => onClick(task)}
    >
      <AppleCardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon()}
              <BodyMedium className="font-medium text-text-primary">
                {task.post_type || 'Content'}
              </BodyMedium>
            </div>
            <CaptionMedium className={getStatusColor()}>
              {getStatusLabel()}
            </CaptionMedium>
            
            {/* Content preview */}
            {hasContent && (
              <div className="mt-2">
                <CaptionMedium className="text-text-tertiary">
                  {task.ai_output.substring(0, 100)}...
                </CaptionMedium>
              </div>
            )}

            {/* Image preview - available for all users */}
            <div className="mt-2">
              <TaskImagePreview 
                images={images} 
                imageCount={imageCount} 
                loading={imagesLoading} 
              />
            </div>
          </div>
          <EnhancedAppleButton 
            variant="tertiary" 
            size="sm"
            iconAnimation="bounce"
          >
            <Eye className="w-4 h-4" />
          </EnhancedAppleButton>
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
