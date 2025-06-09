import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Clock, CheckCircle, Calendar as CalendarIcon, Edit } from "lucide-react";
import { toast } from "sonner";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface EnhancedReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate: () => void;
}

export const EnhancedReadyToPostItem = ({ task, onClick, onTaskUpdate }: EnhancedReadyToPostItemProps) => {
  const [isPublishing, setIsPublishing] = useState(false);

  const handleCopyContent = (e: React.MouseEvent, content: string, postType: string) => {
    e.stopPropagation();
    const cleanContent = stripHtmlAndFormat(content);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${postType} content copied to clipboard`);
  };

  const handleMarkAsPublished = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPublishing(true);
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'completed' })
        .eq('id', task.id);

      if (error) throw error;
      
      toast.success('Content marked as published!');
      onTaskUpdate();
    } catch (error) {
      console.error('Error marking as published:', error);
      toast.error('Failed to mark as published');
    } finally {
      setIsPublishing(false);
    }
  };

  // Content is already approved, show publish-ready status
  const getReadinessStatus = () => {
    const hasContent = task.ai_output && task.ai_output.trim().length > 0;
    const hasScheduleDate = task.scheduled_date;
    
    if (hasContent && hasScheduleDate) {
      return { status: 'ready', label: 'Ready to Publish', color: 'bg-green-100 text-green-800' };
    } else if (hasContent) {
      return { status: 'needs-schedule', label: 'Needs Scheduling', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'needs-content', label: 'Needs Content', color: 'bg-orange-100 text-orange-800' };
    }
  };

  const readinessStatus = getReadinessStatus();
  const isOverdue = task.scheduled_date && new Date(task.scheduled_date) < new Date();

  return (
    <div
      className="border rounded-lg p-4 hover:bg-green-25 transition-all duration-200 cursor-pointer border-green-200 bg-white hover:shadow-md"
      onClick={() => onClick(task)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {getPostTypeIcon(task.post_type)}
          <Badge className={getPostTypeColor(task.post_type)}>
            {task.post_type}
          </Badge>
          <Badge className={readinessStatus.color}>
            {readinessStatus.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
            {readinessStatus.status === 'needs-schedule' && <Clock className="w-3 h-3 mr-1" />}
            {readinessStatus.label}
          </Badge>
          {isOverdue && (
            <Badge className="bg-red-100 text-red-800">
              <Clock className="w-3 h-3 mr-1" />
              Overdue
            </Badge>
          )}
        </div>
        
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => handleCopyContent(e, task.ai_output, task.post_type)}
            className="h-7 w-7 p-0 hover:bg-green-100"
            title="Copy content"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onClick(task);
            }}
            className="h-7 w-7 p-0 hover:bg-blue-100"
            title="Edit content"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMarkAsPublished}
            disabled={isPublishing}
            className="h-7 w-7 p-0 hover:bg-green-100"
            title="Mark as published"
          >
            <CheckCircle className={`w-3 h-3 ${isPublishing ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
      </div>
      
      {task.ai_output && (
        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
          {stripHtmlAndFormat(task.ai_output)}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        {task.scheduled_date && (
          <div className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            <span>
              Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
            </span>
          </div>
        )}
        {task.campaigns?.title && (
          <span className="text-gray-600 font-medium">
            {task.campaigns.title}
          </span>
        )}
      </div>
    </div>
  );
};
