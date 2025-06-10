
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, CheckCircle, Edit, ExternalLink, Instagram, Facebook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";
import { getPostTypeIcon, getStatusColor, handleCopy, formatContentForDisplay } from "./ContentViewerUtils";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const [approvingTask, setApprovingTask] = useState(false);

  const handleApprove = async () => {
    setApprovingTask(true);
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'completed' })
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

  const handleSocialMediaPost = () => {
    const cleanContent = task.ai_output
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    if (task.post_type === 'facebook') {
      postToFacebook(cleanContent);
    } else if (task.post_type === 'instagram') {
      postToInstagram(cleanContent);
    }
  };

  const showSocialMediaButton = (task.post_type === 'facebook' || task.post_type === 'instagram') && task.status === 'completed';
  const canApprove = task.status === 'scheduled' && task.ai_output;
  const canEdit = task.ai_output && task.status !== 'published';

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getPostTypeIcon(task.post_type)}
          <span className="font-medium capitalize">{task.post_type}</span>
          <Badge className={getStatusColor(task.status)}>
            {task.status}
          </Badge>
        </div>
        
        <TooltipProvider>
          <div className="flex gap-2">
            {task.ai_output && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handleCopy(task.ai_output);
                  toast.success('Content copied to clipboard');
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            )}
            
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info('Edit functionality would open content editor')}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
            
            {canApprove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApprove}
                    disabled={approvingTask}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {approvingTask ? 'Approving...' : 'Approve'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Approve this content and send it to the Ready to Post section</p>
                </TooltipContent>
              </Tooltip>
            )}
            
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
            ) : task.status === 'completed' && task.post_type !== 'facebook' && task.post_type !== 'instagram' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info('Publishing integration coming soon')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Publish
              </Button>
            ) : null}
          </div>
        </TooltipProvider>
      </div>

      {task.ai_output && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {formatContentForDisplay(task.ai_output)}
          </div>
        </div>
      )}

      {task.scheduled_date && (
        <p className="text-xs text-gray-500">
          Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
