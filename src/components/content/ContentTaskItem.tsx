import React, { useState, useEffect } from "react";
import { ContentSidebar } from "@/components/ContentSidebar";
import { TaskHeader } from "./task-item/TaskHeader";
import { TaskActions } from "./task-item/TaskActions";
import { TaskContent } from "./task-item/TaskContent";
import { TaskMetadata } from "./task-item/TaskMetadata";
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
    // This will be handled by TaskActions component
    setRetryingGeneration(true);
    // Reset after a delay to allow the action to complete
    setTimeout(() => setRetryingGeneration(false), 3000);
  };

  return (
    <>
      <div className="border rounded-lg p-4 space-y-3 relative group">
        <div className="flex items-center justify-between">
          <TaskHeader postType={task.post_type} status={task.status} />
          <TaskActions 
            task={task} 
            onTaskUpdate={onTaskUpdate} 
            onEdit={handleEdit}
          />
        </div>

        <TaskContent 
          task={task} 
          onRetryGeneration={handleRetryGeneration}
          retryingGeneration={retryingGeneration}
        />

        <div className="flex items-center justify-between">
          <TaskMetadata scheduledDate={task.scheduled_date} />
          
          {/* Image count indicator */}
          {imageCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>📷</span>
              <span>{imageCount} images</span>
            </div>
          )}
        </div>
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
