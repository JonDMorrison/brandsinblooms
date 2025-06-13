import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, CheckCircle, Edit, ExternalLink, Instagram, Facebook, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";
import { getPostTypeIcon, getStatusColor, handleCopy, formatContentForDisplay } from "./ContentViewerUtils";
import { ContentSidebar } from "@/components/ContentSidebar";
import { ApproveButton } from "@/components/ui/approve-button";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const [approvingTask, setApprovingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [retryingGeneration, setRetryingGeneration] = useState(false);
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [openInEditMode, setOpenInEditMode] = useState(false);

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

  const handleDelete = async () => {
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

  const handleRetryGeneration = async () => {
    setRetryingGeneration(true);
    
    try {
      console.log(`Manually retrying content generation for ${task.post_type} task:`, task.id);
      
      // Reset the task to trigger content generation
      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          status: 'generating',
          ai_output: null 
        })
        .eq('id', task.id);

      if (error) {
        console.error('Error retrying content generation:', error);
        toast.error('Failed to retry content generation');
      } else {
        toast.success('Content generation restarted');
        if (onTaskUpdate) onTaskUpdate();
        
        // Force a content generation attempt by calling the edge function directly
        try {
          const { data: generationData, error: generationError } = await supabase.functions.invoke('generate-content', {
            body: {
              postType: task.post_type,
              campaignTitle: 'Facebook Post Generation',
              userId: null,
              enforceCompanyName: true
            }
          });

          if (generationError) {
            console.error('Error in manual content generation:', generationError);
            toast.error('Failed to generate content automatically');
          } else if (generationData?.content) {
            // Update the task with the generated content
            const { error: updateError } = await supabase
              .from('content_tasks')
              .update({ 
                status: 'scheduled',
                ai_output: generationData.content 
              })
              .eq('id', task.id);

            if (updateError) {
              console.error('Error updating task with generated content:', updateError);
            } else {
              toast.success('Content generated successfully!');
              if (onTaskUpdate) onTaskUpdate();
            }
          }
        } catch (genError) {
          console.error('Error calling generate-content function:', genError);
        }
      }
    } catch (error) {
      console.error('Error retrying content generation:', error);
      toast.error('Failed to retry content generation');
    } finally {
      setRetryingGeneration(false);
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

  const handleEdit = () => {
    setOpenInEditMode(true);
    setShowContentSidebar(true);
  };

  const handleCloseSidebar = () => {
    setShowContentSidebar(false);
    setOpenInEditMode(false);
  };

  const handleTaskUpdateFromSidebar = () => {
    if (onTaskUpdate) onTaskUpdate();
  };

  const showSocialMediaButton = (task.post_type === 'facebook' || task.post_type === 'instagram') && task.status === 'completed';
  const canApprove = task.status === 'scheduled' && task.ai_output;
  const canEdit = task.ai_output && task.status !== 'published';
  const isGenerating = task.status === 'generating';
  const hasFailedGeneration = task.status === 'generating' && !task.ai_output;
  const isStuckGenerating = task.status === 'generating' && !task.ai_output;
  const isApproved = task.status === 'completed';

  return (
    <>
      <div className="border rounded-lg p-4 space-y-3 relative group">
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

              {(hasFailedGeneration || isStuckGenerating) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetryGeneration}
                      disabled={retryingGeneration}
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${retryingGeneration ? 'animate-spin' : ''}`} />
                      {retryingGeneration ? 'Retrying...' : 'Retry'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry content generation</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEdit}
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
              
              {canApprove && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ApproveButton
                      isApproved={isApproved}
                      onApprove={handleApprove}
                      disabled={approvingTask}
                    />
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
          </TooltipProvider>
        </div>

        {task.ai_output ? (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {formatContentForDisplay(task.ai_output)}
            </div>
          </div>
        ) : isGenerating ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-800">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-sm">Generating {task.post_type} content...</span>
              </div>
              {isStuckGenerating && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryGeneration}
                  disabled={retryingGeneration}
                  className="border-orange-300 text-orange-600 hover:bg-orange-50 text-xs px-2 py-1"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${retryingGeneration ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-sm text-gray-500 italic">
              No content generated yet
            </div>
          </div>
        )}

        {task.scheduled_date && (
          <p className="text-xs text-gray-500">
            Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
          </p>
        )}
      </div>

      <ContentSidebar
        task={task}
        isOpen={showContentSidebar}
        onClose={handleCloseSidebar}
        onTaskUpdate={handleTaskUpdateFromSidebar}
        initialEditMode={openInEditMode}
      />
    </>
  );
};
