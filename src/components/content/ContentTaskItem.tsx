
import React, { useState } from "react";
import { ContentSidebar } from "@/components/ContentSidebar";
import { TaskHeader } from "./task-item/TaskHeader";
import { TaskActions } from "./task-item/TaskActions";
import { TaskContent } from "./task-item/TaskContent";
import { TaskMetadata } from "./task-item/TaskMetadata";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [retryingGeneration, setRetryingGeneration] = useState(false);

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

        <TaskMetadata scheduledDate={task.scheduled_date} />
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
