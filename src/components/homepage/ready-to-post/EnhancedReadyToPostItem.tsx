
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Instagram, Facebook, ExternalLink, Trash2, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";

interface EnhancedReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  onEdit?: (task: any, editMode: boolean) => void;
}

export const EnhancedReadyToPostItem = ({ task, onClick, onTaskUpdate, onEdit }: EnhancedReadyToPostItemProps) => {
  const [deletingTask, setDeletingTask] = useState(false);

  const handleCopyContent = (event: React.MouseEvent) => {
    event.stopPropagation();
    const cleanContent = stripHtmlAndFormat(task.ai_output);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${task.post_type} content copied to clipboard`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(task, true);
    else onClick(task); // Fallback to regular click if onEdit not provided
  };

  const handleSocialMediaPost = (event: React.MouseEvent) => {
    event.stopPropagation();
    const cleanContent = stripHtmlAndFormat(task.ai_output);
    
    if (task.post_type === 'facebook') {
      postToFacebook(cleanContent);
    } else if (task.post_type === 'instagram') {
      postToInstagram(cleanContent);
    }
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

  const showSocialMediaButton = task.post_type === 'facebook' || task.post_type === 'instagram';

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md bg-gradient-to-r ${getPostTypeColor(task.post_type)} relative group`}
      onClick={() => onClick(task)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getPostTypeIcon(task.post_type)}
          <Badge variant="secondary" className="capitalize">
            {task.post_type}
          </Badge>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            ✅ Ready
          </Badge>
        </div>
      </div>

      <div className="text-sm text-gray-700 line-clamp-3 mb-3 leading-relaxed">
        {stripHtmlAndFormat(task.ai_output)}
      </div>

      {task.scheduled_date && (
        <p className="text-xs text-gray-500 mb-3">
          Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEdit}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit content</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyContent}
                className="border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy content to clipboard</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showSocialMediaButton ? (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSocialMediaPost}
          >
            {task.post_type === 'facebook' ? (
              <>
                <Facebook className="w-3 h-3 mr-1" />
                Post to Facebook
              </>
            ) : (
              <>
                <Instagram className="w-3 h-3 mr-1" />
                Post to Instagram
              </>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              toast.info('Publishing integration coming soon');
            }}
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
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
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete this content</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
