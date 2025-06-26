
import React from "react";
import { Calendar } from "lucide-react";

interface TaskMetadataProps {
  scheduledDate?: string;
}

export const TaskMetadata = ({ scheduledDate }: TaskMetadataProps) => {
  if (!scheduledDate) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-slate-500">
      <Calendar className="w-3 h-3" />
      <span>{new Date(scheduledDate).toLocaleDateString()}</span>
    </div>
  );
};
