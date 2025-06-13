
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Edit, ExternalLink, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleCopy } from "../ContentViewerUtils";
import { ApproveButton } from "@/components/ui/approve-button";
import { generatePersonalizedContent } from "@/components/homepage/ContentGenerationServices";

interface TaskActionsProps {
  task: any;
  onTaskUpdate?: () => void;
  onEdit: () => void;
}

export const TaskActions = ({ task, onTaskUpdate, onEdit }: TaskActionsProps) => {
  const [approvingTask, setApprovingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [retryingGeneration, setRetryingGeneration] = useState(false);

  const handleApprove = async () => {
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
      
      // First, fetch the campaign data to get the proper theme and context
      let campaignTitle = 'Content Generation';
      let weekDescription = '';
      
      if (task.campaign_id) {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('title, theme, description')
          .eq('id', task.campaign_id)
          .maybeSingle();
        
        if (campaignError) {
          console.error('Error fetching campaign data:', campaignError);
        } else if (campaignData) {
          campaignTitle = campaignData.title || campaignData.theme || 'Content Generation';
          weekDescription = campaignData.description || '';
          console.log('Using campaign context:', { campaignTitle, weekDescription });
        }
      }
      
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
        return;
      }

      toast.success('Content generation restarted');
      if (onTaskUpdate) onTaskUpdate();
      
      // Generate content using the proper service with campaign context
      try {
        console.log(`Generating ${task.post_type} content with theme: ${campaignTitle}`);
        
        const generatedContent = await generatePersonalizedContent(
          task.post_type, 
          campaignTitle, 
          null, // userId - will be handled by the service
          weekDescription
        );

        if (!generatedContent || generatedContent.trim() === '') {
          throw new Error('Generated content is empty');
        }

        // Validate content doesn't contain forbidden patterns
        const hasPlaceholders = generatedContent.includes('[') && generatedContent.includes(']');
        const hasWeekNumbers = /week\s+\d+/i.test(generatedContent);
        const hasWelcomePhrase = generatedContent.toLowerCase().includes('welcome to');
        
        if (hasPlaceholders || hasWeekNumbers || hasWelcomePhrase) {
          console.warn('Generated content contains validation issues, but proceeding');
        }

        // Update the task with the generated content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({ 
            status: 'scheduled',
            ai_output: generatedContent 
          })
          .eq('id', task.id);

        if (updateError) {
          console.error('Error updating task with generated content:', updateError);
          toast.error('Failed to save generated content');
        } else {
          console.log(`Successfully generated and saved ${task.post_type} content for theme: ${campaignTitle}`);
          toast.success('Content generated successfully!');
          if (onTaskUpdate) onTaskUpdate();
        }
      } catch (genError) {
        console.error('Error generating content:', genError);
        
        // Update task status back to failed/scheduled if generation fails
        await supabase
          .from('content_tasks')
          .update({ status: 'scheduled' })
          .eq('id', task.id);
          
        toast.error('Failed to generate content. Please try again.');
      }
    } catch (error) {
      console.error('Error retrying content generation:', error);
      toast.error('Failed to retry content generation');
    } finally {
      setRetryingGeneration(false);
    }
  };

  const canApprove = ['scheduled', 'pending', 'draft', 'ready', 'review', 'posted'].includes(task.status) && task.ai_output;
  const canEdit = task.ai_output && task.status !== 'published';
  const isGenerating = task.status === 'generating';
  const hasFailedGeneration = task.status === 'generating' && !task.ai_output;
  const isStuckGenerating = task.status === 'generating' && !task.ai_output;
  const isApproved = task.status === 'posted';

  return (
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
            onClick={onEdit}
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
              <p>{isApproved ? 'Content is approved' : 'Approve this content and send it to the Ready to Post section'}</p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {task.status === 'posted' && task.post_type !== 'facebook' && task.post_type !== 'instagram' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.info('Publishing integration coming soon')}
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
    </TooltipProvider>
  );
};
