
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Image } from "lucide-react";
import { PlatformChip } from "@/components/ui/platform-chip";
import { getStatusConfig, extractBlogMetadata } from "@/utils/contentUtils";

interface TaskItemHeaderProps {
  task: any;
  imageCount: number;
  previewText: string;
}

export const TaskItemHeader = ({ task, imageCount, previewText }: TaskItemHeaderProps) => {
  const statusConfig = getStatusConfig(task.status);
  const hasContent = task.ai_output && task.ai_output.trim() !== '';
  
  // Extract blog metadata for enhanced display using normalized data
  const blogMetadata = task.post_type === 'blog' && hasContent ? 
    extractBlogMetadata(task.display_content || task.ai_output) : null;
  
  // Check if this is a structured newsletter using normalized data
  const isStructuredNewsletter = task.post_type === 'newsletter' && 
                                 hasContent && 
                                 task.normalized;

  return (
    <div className="flex flex-col w-full space-y-2">
      {/* First row - Platform chip and badges */}
      <div className="flex items-center justify-between w-full">
        {/* Left cluster - Platform chip with enhanced title */}
        <div className="flex items-center gap-3">
          <PlatformChip postType={task.post_type} />
          {task.post_type === 'blog' && blogMetadata?.title && (
            <span className="text-sm font-medium text-slate-700 truncate max-w-xs">
              {blogMetadata.title}
            </span>
          )}
          {isStructuredNewsletter && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Structured
            </span>
          )}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0`}>
            {statusConfig.label}
          </Badge>
          {blogMetadata?.readingTime && (
            <span className="text-xs text-gray-500">
              {blogMetadata.readingTime} min read
            </span>
          )}
          {imageCount > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Image className="w-3 h-3" />
              <span>{imageCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Second row - Preview text */}
      <div className="flex items-center justify-between w-full">
        <p className="text-sm text-gray-600 italic flex-1 text-left">
          {previewText}
        </p>
      </div>
    </div>
  );
};
