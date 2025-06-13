
import React from "react";

interface TaskMetadataProps {
  scheduledDate?: string;
}

export const TaskMetadata = ({ scheduledDate }: TaskMetadataProps) => {
  if (!scheduledDate) return null;

  return (
    <p className="text-xs text-gray-500">
      Scheduled: {new Date(scheduledDate).toLocaleDateString()}
    </p>
  );
};
