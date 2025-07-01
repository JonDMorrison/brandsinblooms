
import React from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPostTypeIcon } from "../ContentViewerUtils";
import { getStatusBadgeVariant, getStatusLabel } from "@/utils/badgeUtils";

interface TaskHeaderProps {
  postType: string;
  status: string;
}

export const TaskHeader = ({ postType, status }: TaskHeaderProps) => {
  const PostIcon = getPostTypeIcon(postType);
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-slate-700">
        <PostIcon className="w-4 h-4" />
        <span className="font-medium capitalize text-sm">{postType}</span>
      </div>
      
      <StatusBadge variant={getStatusBadgeVariant(status)}>
        {getStatusLabel(status)}
      </StatusBadge>
    </div>
  );
};
