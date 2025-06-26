
import React, { useState, useEffect } from "react";
import { ContentSidebar } from "@/components/ContentSidebar";
import { TaskHeader } from "./task-item/TaskHeader";
import { TaskActions } from "./task-item/TaskActions";
import { TaskContent } from "./task-item/TaskContent";
import { TaskMetadata } from "./task-item/TaskMetadata";
import { CompactImageCarousel } from "@/components/homepage/ready-to-post/CompactImageCarousel";
import { supabase } from "@/integrations/supabase/client";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [retryingGeneration, setRetryingGeneration] = useState(false);
  const [imageCount, setImageCount] = useState(0);

  // Fetch image count for this task
  useEffect(() => {
    const fetchImageCount = async () => {
      if (task?.id) {
        try {
          const { count, error } = await supabase
            .from('image_suggestions')
            .select('*', { count: 'exact', head: true })
            .eq('content_task_id', task.id);

          if (!error && count !== null) {
            setImageCount(count);
          }
        } catch (error) {
          console.error('Error fetching image count:', error);
        }
      }
    };

    fetchImageCount();
  }, [task?.id]);

  const handleEdit = () => {
    setOpenInEditMode(true);
    setShowContentSidebar(true);
  };

  const handleCloseSidebar = () => {
    setShowContentSidebar(false);
    setOpenInEditMode(false);
  };

  const handleTaskUpdateFromSidebar = () => {
    if (onTaskUpdate) onTaskUpdate();
  };

  const handleRetryGeneration = () => {
    setRetryingGeneration(true);
    setTimeout(() => setRetryingGeneration(false), 3000);
  };

  const handleShowAllImages = () => {
    setShowContentSidebar(true);
  };

  // Get the campaign theme, handling both campaign and holiday content
  const getCampaignTheme = () => {
    if (task.campaigns?.theme) {
      return task.campaigns.theme;
    }
    if (task.holiday_id && task.holidays?.holiday_name) {
      return task.holidays.holiday_name;
    }
    return 'Holiday Content';
  };

  return (
    <>
      <div className="border border-slate-200 rounded-lg bg-white hover:shadow-sm transition-shadow duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <TaskHeader postType={task.post_type} status={task.status} />
          <TaskActions 
            task={task} 
            onTaskUpdate={onTaskUpdate} 
            onEdit={handleEdit}
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <TaskContent 
            task={task} 
            onRetryGeneration={handleRetryGeneration}
            retryingGeneration={retryingGeneration}
          />

          {/* Image Suggestions */}
          {task.ai_output && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <CompactImageCarousel 
                task={task}
                campaignTheme={getCampaignTheme()}
                onShowAll={handleShowAllImages}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {task.scheduled_date && (
          <div className="px-4 pb-4">
            <TaskMetadata scheduledDate={task.scheduled_date} />
          </div>
        )}
      </div>

      <ContentSidebar
        task={task}
        isOpen={showContentSidebar}
        onClose={handleCloseSidebar}
        onTaskUpdate={handleTaskUpdateFromSidebar}
        initialEditMode={openInEditMode}
      />
    </>
  );
};
