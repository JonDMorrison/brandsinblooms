
import React, { useState } from "react";
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Edit, Eye } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CaptionMedium, BodySmall } from "@/components/ui/typography";
import { ContentPreview } from "./ContentPreview";
import { CompactImageCarousel } from "./CompactImageCarousel";

interface ImprovedReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  onEdit?: (task: any, editMode: boolean) => void;
}

export const ImprovedReadyToPostItem = ({ task, onClick, onTaskUpdate, onEdit }: ImprovedReadyToPostItemProps) => {
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

  const handleViewFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(task);
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

  const getStatusColor = () => {
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  const handleShowAllImages = () => {
    onClick(task); // Open the full content viewer which has the full image carousel
  };

  return (
    <div
      className={`
        border border-stone-200 rounded-lg p-4 cursor-pointer transition-all duration-200 
        bg-white hover:bg-stone-50 hover:border-stone-300 hover:shadow-sm
        ${isMobile ? 'min-h-[200px]' : ''}
      `}
      onClick={handleViewFull}
    >
      {/* Header Section - Simplified without campaign title */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 text-stone-600">
            {getPostTypeIcon(task.post_type)}
          </div>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <Badge 
              variant="secondary" 
              className="capitalize w-fit text-xs bg-stone-100 text-stone-700 border-stone-200"
            >
              {task.post_type}
            </Badge>
            <Badge 
              className={`w-fit text-xs ${getStatusColor()}`}
            >
              ✓ Ready to Use
            </Badge>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      {task.ai_output && (
        <div className="mb-4">
          <ContentPreview 
            content={task.ai_output} 
            postType={task.post_type}
          />
        </div>
      )}

      {/* Image Suggestions */}
      <div className="mb-4" onClick={(e) => e.stopPropagation()}>
        <CompactImageCarousel 
          task={task}
          campaignTheme={task.campaigns?.theme}
          onShowAll={handleShowAllImages}
        />
      </div>

      {/* Scheduled Date */}
      {task.scheduled_date && (
        <div className="mb-4">
          <CaptionMedium className="text-stone-500">
            Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
          </CaptionMedium>
        </div>
      )}

      {/* Action Buttons */}
      <div className={`
        flex gap-2 flex-wrap
        ${isMobile ? 'justify-center' : 'justify-start'}
      `}>
        <Tooltip>
          <TooltipTrigger asChild>
            <EnhancedAppleButton
              size="sm"
              variant="secondary"
              onClick={handleEdit}
              className={`
                border-blue-200 text-blue-700 hover:bg-blue-50
                ${isMobile ? 'flex-1 min-w-[70px]' : ''}
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

        <Tooltip>
          <TooltipTrigger asChild>
            <EnhancedAppleButton
              size="sm"
              variant="tertiary"
              onClick={handleCopyContent}
              className={`
                text-stone-600 hover:bg-stone-100
                ${isMobile ? 'flex-1 min-w-[70px]' : ''}
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

        <Tooltip>
          <TooltipTrigger asChild>
            <EnhancedAppleButton
              size="sm"
              variant="secondary"
              onClick={handleViewFull}
              className={`
                border-stone-200 text-stone-700 hover:bg-stone-50
                ${isMobile ? 'flex-1 min-w-[70px]' : ''}
              `}
              iconAnimation="bounce"
            >
              <Eye className="w-3 h-3 mr-1" />
              {isMobile ? '' : 'View Full'}
            </EnhancedAppleButton>
          </TooltipTrigger>
          <TooltipContent>
            <p>View full content</p>
          </TooltipContent>
        </Tooltip>

        {!isMobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <EnhancedAppleButton
                size="sm"
                variant="tertiary"
                onClick={handleDelete}
                disabled={deletingTask}
                loading={deletingTask}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
