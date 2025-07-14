
import React, { useState } from "react";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Trash2, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Removed sonner import - using global toast replacement
import { supabase } from "@/integrations/supabase/client";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";
import { ApproveButton } from "@/components/ui/approve-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CaptionMedium, BodySmall } from "@/components/ui/typography";

interface EnhancedReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  onEdit?: (task: any, editMode: boolean) => void;
}

export const EnhancedReadyToPostItem = ({ task, onClick, onTaskUpdate, onEdit }: EnhancedReadyToPostItemProps) => {
  const [deletingTask, setDeletingTask] = useState(false);
  const isMobile = useIsMobile();

  const handleCopyContent = (event: React.MouseEvent) => {
    event.stopPropagation();
    const cleanContent = stripHtmlAndFormat(task.ai_output);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${task.post_type} content copied to clipboard`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(task, true);
    else onClick(task);
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    setDeletingTask(true);
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete content');
      } else {
        toast.success('Content deleted successfully');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete content');
    } finally {
      setDeletingTask(false);
    }
  };

  const isApproved = task.status === 'approved';
  const PostIcon = getPostTypeIcon(task.post_type);

  return (
    <div
      className={`
        border rounded-lg p-4 cursor-pointer transition-all duration-200 
        ${getPostTypeColor(task.post_type)} 
        apple-hover-subtle apple-card-interactive
        responsive-padding touch-target
        ${isMobile ? 'min-h-[120px]' : 'hover:shadow-md'}
      `}
      onClick={() => onClick(task)}
    >
      {/* Header Section */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <PostIcon className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <Badge 
              variant="secondary" 
              className={`
                capitalize w-fit text-xs bg-primary/10 text-primary border-primary/20
                ${isMobile ? 'px-2 py-1' : ''}
              `}
            >
              {task.post_type}
            </Badge>
            <Badge 
              className={`
                bg-success/10 text-success border-success/20 w-fit text-xs
                ${isMobile ? 'px-2 py-1' : ''}
              `}
            >
              ✅ Ready
            </Badge>
          </div>
        </div>
      </div>

      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Left column - Text content (2/3 width) */}
        <div className="md:col-span-2 space-y-4">
          {/* Content Preview */}
          <div className={`${isMobile ? 'responsive-text-sm' : 'text-sm'}`}>
            <BodySmall className="text-text-secondary leading-relaxed line-clamp-2">
              {stripHtmlAndFormat(task.ai_output)}
            </BodySmall>
          </div>

          {/* Scheduled Date */}
          {task.scheduled_date && (
            <div>
              <CaptionMedium className="text-text-tertiary">
                Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
              </CaptionMedium>
            </div>
          )}
        </div>

        {/* Right column - Image placeholder (1/3 width) */}
        <div className="md:col-span-1">
          {task.attachments?.[0]?.url ? (
            <img 
              src={task.attachments[0].url} 
              alt="Content image"
              className="w-full h-24 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className={`
        flex gap-2 flex-wrap
        ${isMobile ? 'justify-center' : 'justify-start'}
      `}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <EnhancedAppleButton
                size="sm"
                variant="secondary"
                onClick={handleEdit}
                className={`
                  border-primary/30 text-primary hover:bg-primary/10
                  apple-button-base touch-target
                  ${isMobile ? 'flex-1 min-w-[80px]' : ''}
                `}
                iconAnimation="bounce"
              >
                <Edit className="w-3 h-3 mr-1" />
                {isMobile ? '' : 'Edit'}
              </EnhancedAppleButton>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit content</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <EnhancedAppleButton
                size="sm"
                variant="tertiary"
                onClick={handleCopyContent}
                className={`
                  apple-button-base touch-target text-primary hover:bg-primary/10
                  ${isMobile ? 'flex-1 min-w-[80px]' : ''}
                `}
                iconAnimation="bounce"
              >
                <Copy className="w-3 h-3 mr-1" />
                {isMobile ? '' : 'Copy'}
              </EnhancedAppleButton>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy content to clipboard</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ApproveButton
          isApproved={isApproved}
          onApprove={() => {}}
          disabled={true}
          size="sm"
          className={`
            apple-button-base touch-target
            ${isMobile ? 'flex-1 min-w-[80px]' : ''}
          `}
        />

        <EnhancedAppleButton
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            toast.info('Publishing integration coming soon');
          }}
          className={`
            border-primary/30 text-primary hover:bg-primary/10
            apple-button-base touch-target
            ${isMobile ? 'flex-1 min-w-[80px]' : ''}
          `}
          iconAnimation="bounce"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          {isMobile ? '' : 'Publish'}
        </EnhancedAppleButton>

        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <EnhancedAppleButton
                size="sm"
                variant="tertiary"
                onClick={handleDelete}
                disabled={deletingTask}
                loading={deletingTask}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 touch-target"
                iconAnimation="bounce"
              >
                <Trash2 className="w-3 h-3" />
              </EnhancedAppleButton>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete this content</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
