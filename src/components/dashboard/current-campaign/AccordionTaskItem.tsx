

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, Edit, ExternalLink, Trash2, RefreshCw, Image } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlatformChip } from "@/components/ui/platform-chip";
import { stripMarkdown, truncateText, getStatusConfig } from "@/utils/contentUtils";
import { useTaskImages } from "@/hooks/useTaskImages";
import { handleCopy } from "@/components/content/ContentViewerUtils";
import { CompactImageCarousel } from "@/components/homepage/ready-to-post/CompactImageCarousel";
import { ApproveButton } from "@/components/ui/approve-button";

interface AccordionTaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

// Enhanced content cleaning function for better display
const cleanContentForDisplay = (content: string): string => {
  if (!content) return '';
  
  // First strip markdown and HTML
  let cleaned = stripMarkdown(content);
  
  // Remove any remaining technical artifacts
  cleaned = cleaned
    // Remove code blocks that might have been missed
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove HTML entities
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    // Remove excessive whitespace and normalize line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\s+/g, ' ')
    // Remove any leftover brackets or technical formatting
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .trim();
    
  return cleaned;
};

export const AccordionTaskItem = ({ task, onClick, onTaskUpdate }: AccordionTaskItemProps) => {
  console.log('AccordionTaskItem: Rendering task:', task.id, task.post_type, task.status);
  
  const { images, imageCount, loading: imagesLoading } = useTaskImages(task?.id);
  const [approvingTask, setApprovingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [retryingGeneration, setRetryingGeneration] = useState(false);

  const statusConfig = getStatusConfig(task.status);
  const hasContent = task.ai_output && task.ai_output.trim() !== '';
  const cleanContent = hasContent ? cleanContentForDisplay(task.ai_output) : '';
  const previewText = cleanContent ? truncateText(cleanContent, 110, '…') : 'Content will be generated soon...';

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(task);
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApprovingTask(true);
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .eq('id', task.id);

      if (error) {
        console.error('Error approving task:', error);
        toast.error('Failed to approve content');
      } else {
        toast.success('Content approved and moved to Ready to Post!');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApprovingTask(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  const handleCopyContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasContent) {
      handleCopy(cleanContent);
      toast.success('Content copied to clipboard');
    }
  };

  const canApprove = ['scheduled', 'pending', 'draft', 'ready', 'review', 'posted'].includes(task.status) && task.ai_output;
  const isApproved = task.status === 'posted';

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={task.id} className="border-gray-200 rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex flex-col w-full space-y-2">
            {/* First row - Platform chip and badges */}
            <div className="flex items-center justify-between w-full">
              {/* Left cluster - Just platform chip */}
              <div className="flex items-center gap-3">
                <PlatformChip postType={task.post_type} />
              </div>

              {/* Right cluster */}
              <div className="flex items-center gap-3">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} border-0`}>
                  {statusConfig.label}
                </Badge>
                {imageCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Image className="w-3 h-3" />
                    <span>{imageCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Second row - Preview text (spans full width, chevron will be on the right) */}
            <div className="flex items-center justify-between w-full">
              <p className="text-sm text-gray-600 italic flex-1 text-left">
                {previewText}
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Full content - now using cleaned content */}
            {hasContent && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {cleanContent}
                </div>
              </div>
            )}

            {/* Image thumbnails */}
            {hasContent && (
              <div>
                <CompactImageCarousel 
                  task={task}
                  campaignTheme={task.campaigns?.theme}
                  onShowAll={() => onClick(task)}
                />
              </div>
            )}

            {/* Action bar */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                {hasContent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyContent}
                    className="flex-1 min-w-[80px]"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEdit}
                  className="flex-1 min-w-[80px] border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>

                {canApprove && (
                  <ApproveButton
                    isApproved={isApproved}
                    onApprove={handleApprove}
                    disabled={approvingTask}
                    className="flex-1 min-w-[80px]"
                  />
                )}

                {task.status === 'posted' && task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info('Publishing integration coming soon');
                    }}
                    className="flex-1 min-w-[80px]"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDelete}
                      disabled={deletingTask}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 min-w-[40px]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this content</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

