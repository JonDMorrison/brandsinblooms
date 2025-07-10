
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

  // Get task image from attachments or image_url
  const getTaskImageUrl = (task: any) => {
    return task.attachments?.[0]?.url || task.image_url || null;
  };

  // Get thumbnail image (fallback to image suggestions)
  const getThumbnailImage = () => {
    const taskImage = getTaskImageUrl(task);
    if (taskImage) return taskImage;
    
    if (task.image_suggestions && task.image_suggestions.length > 0) {
      return task.image_suggestions[0].urls?.small || task.image_suggestions[0].urls?.regular;
    }
    return null;
  };

  const thumbnailImage = getThumbnailImage();
  const PostIcon = getPostTypeIcon(task.post_type);

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
            <PostIcon className="w-5 h-5" />
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

      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Left column - Text content (2/3 width) */}
        <div className="md:col-span-2 space-y-3">
          {/* Content preview */}
          <div className="flex-1">
            <BodySmall className="text-stone-600 line-clamp-2 leading-relaxed">
              {getContentPreview(task.ai_output)}
            </BodySmall>
          </div>

          {/* Scheduled date if available */}
          {task.scheduled_date && (
            <div>
              <CaptionMedium className="text-stone-400 text-xs">
                {new Date(task.scheduled_date).toLocaleDateString()}
              </CaptionMedium>
            </div>
          )}
        </div>

        {/* Right column - Image (1/3 width) */}
        <div className="md:col-span-1">
          {thumbnailImage ? (
            <div className="overflow-hidden rounded-md h-16">
              <img 
                src={thumbnailImage} 
                alt="Content preview"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="w-full h-16 bg-stone-100 rounded-md flex items-center justify-center">
              <span className="text-xs text-stone-400">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
    </div>
  );
};
