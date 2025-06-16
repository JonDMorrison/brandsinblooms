
import { useState } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Eye, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useTaskImages } from "@/hooks/useTaskImages";
import { TaskImagePreview } from "./TaskImagePreview";

interface TaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskItem = ({ task, onClick, onTaskUpdate }: TaskItemProps) => {
  const { images, imageCount, loading } = useTaskImages(task?.id);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'review':
        return <Eye className="w-4 h-4 text-warning" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-text-secondary" />;
      default:
        return <AlertCircle className="w-4 h-4 text-text-tertiary" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
      case 'approved':
        return 'text-success';
      case 'review':
        return 'text-warning';
      case 'pending':
        return 'text-text-secondary';
      default:
        return 'text-text-tertiary';
    }
  };

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
              {task.status?.charAt(0).toUpperCase() + task.status?.slice(1) || 'Draft'}
            </CaptionMedium>
            
            {/* Image preview */}
            <div className="mt-2">
              <TaskImagePreview 
                images={images} 
                imageCount={imageCount} 
                loading={loading}
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
