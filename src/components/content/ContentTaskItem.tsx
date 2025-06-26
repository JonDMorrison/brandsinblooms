
import React, { useState } from "react";
import { ContentSidebar } from "@/components/ContentSidebar";
import { ContentDisplay } from "./ContentDisplay";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [openInEditMode, setOpenInEditMode] = useState(false);

  const handleEdit = () => {
    setOpenInEditMode(true);
    setShowContentSidebar(true);
  };

  const handleViewFull = (task: any) => {
    setShowContentSidebar(true);
  };

  const handleCloseSidebar = () => {
    setShowContentSidebar(false);
    setOpenInEditMode(false);
  };

  const handleTaskUpdateFromSidebar = () => {
    if (onTaskUpdate) onTaskUpdate();
  };

  return (
    <>
      <ContentDisplay
        task={task}
        onTaskUpdate={onTaskUpdate}
        onViewFull={handleViewFull}
      />

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
