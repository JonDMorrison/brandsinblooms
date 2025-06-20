
import React from "react";
import { Badge } from "@/components/ui/badge";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CaptionMedium, BodySmall } from "@/components/ui/typography";

interface SimpleReadyToPostCardProps {
  task: any;
  onClick: (task: any) => void;
}

export const SimpleReadyToPostCard = ({ task, onClick }: SimpleReadyToPostCardProps) => {
  const isMobile = useIsMobile();

  const handleClick = () => {
    onClick(task);
  };

  // Get first line of content for preview
  const getContentPreview = (content: string) => {
    if (!content) return "No content available";
    const cleanContent = stripHtmlAndFormat(content);
    const firstLine = cleanContent.split('\n')[0] || cleanContent;
    return firstLine.length > 60 ? `${firstLine.substring(0, 60)}...` : firstLine;
  };

  // Get thumbnail image
  const getThumbnailImage = () => {
    if (task.image_suggestions && task.image_suggestions.length > 0) {
      return task.image_suggestions[0].urls?.small || task.image_suggestions[0].urls?.regular;
    }
    return null;
  };

  const thumbnailImage = getThumbnailImage();

  return (
    <div
      className={`
        group cursor-pointer rounded-lg border border-stone-200 bg-white p-4 
        transition-all duration-200 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5
        ${isMobile ? 'min-h-[140px]' : 'min-h-[160px]'}
      `}
      onClick={handleClick}
    >
      {/* Header with post type and status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-stone-600 flex-shrink-0">
            {getPostTypeIcon(task.post_type)}
          </div>
          <Badge 
            variant="secondary" 
            className="capitalize text-xs bg-stone-100 text-stone-700 border-stone-200"
          >
            {task.post_type}
          </Badge>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-500" title="Ready to post" />
      </div>

      {/* Thumbnail image */}
      {thumbnailImage && (
        <div className="mb-3 overflow-hidden rounded-md">
          <img 
            src={thumbnailImage} 
            alt="Content preview"
            className="w-full h-20 object-cover transition-transform duration-200 group-hover:scale-105"
          />
        </div>
      )}

      {/* Content preview */}
      <div className="mb-3 flex-1">
        <BodySmall className="text-stone-600 line-clamp-2 leading-relaxed">
          {getContentPreview(task.ai_output)}
        </BodySmall>
      </div>

      {/* Scheduled date if available */}
      {task.scheduled_date && (
        <div className="mt-auto">
          <CaptionMedium className="text-stone-400 text-xs">
            {new Date(task.scheduled_date).toLocaleDateString()}
          </CaptionMedium>
        </div>
      )}

      {/* Hover indicator */}
      <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
    </div>
  );
};
