
import React from "react";
import { Badge } from "@/components/ui/badge";
import { getPostTypeIcon } from "../ContentViewerUtils";
import { getStatusBadgeVariant, getPlatformBadgeVariant, getStatusLabel, getPlatformLabel } from "@/utils/badgeUtils";

interface TaskHeaderProps {
  postType: string;
  status: string;
}

export const TaskHeader = ({ postType, status }: TaskHeaderProps) => {
  return (
    <div className="flex items-center gap-3">
      {getPostTypeIcon(postType)}
      <span className="font-medium capitalize">{getPlatformLabel(postType)}</span>
      
      <Badge variant={getPlatformBadgeVariant(postType)}>
        {getPlatformLabel(postType)}
      </Badge>
      
      <Badge variant={getStatusBadgeVariant(status)}>
        {getStatusLabel(status)}
      </Badge>
    </div>
  );
};
