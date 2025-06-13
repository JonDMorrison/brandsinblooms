
import React from "react";
import { Badge } from "@/components/ui/badge";
import { getPostTypeIcon, getStatusColor } from "../ContentViewerUtils";

interface TaskHeaderProps {
  postType: string;
  status: string;
}

export const TaskHeader = ({ postType, status }: TaskHeaderProps) => {
  return (
    <div className="flex items-center gap-3">
      {getPostTypeIcon(postType)}
      <span className="font-medium capitalize">{postType}</span>
      <Badge className={getStatusColor(status)}>
        {status}
      </Badge>
    </div>
  );
};
