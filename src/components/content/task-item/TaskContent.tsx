import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { MagazineContentDisplay } from "./MagazineContentDisplay";
import { SocialMediaPostPreview } from "./SocialMediaPostPreview";
import { generatePersonalizedContent } from "@/components/homepage/ContentGenerationServices";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement
import { normalizeTask } from "@/utils/normalizeTask";
import { formatNewsletterContent, addNewsletterSections } from "@/utils/newsletterFormatter";
import { SafeHtml } from "@/components/ui/safe-html";

interface TaskContentProps {
  task: any;
  onRetryGeneration: () => void;
  retryingGeneration: boolean;
}

export const TaskContent = ({ task, onRetryGeneration, retryingGeneration }: TaskContentProps) => {
  const [regenerating, setRegenerating] = useState(false);
  
  // Normalize the task for consistent display
  const normalizedTask = normalizeTask(task);
  
  const isGenerating = normalizedTask.status === 'generating';
  const isStuckGenerating = normalizedTask.status === 'generating' && !normalizedTask.ai_output;

  // Enhanced content validation for video tasks
  const hasValidContent = normalizedTask.ai_output && normalizedTask.ai_output.trim() !== '';
  
  // Special validation for video content
  if (normalizedTask.post_type === 'video' && normalizedTask.ai_output) {
    console.log(`🎬 TASK_CONTENT DEBUG: Video task validation:`, {
      id: normalizedTask.id,
      has_content: hasValidContent,
      content_length: normalizedTask.ai_output?.length || 0,
      content_preview: normalizedTask.ai_output?.substring(0, 200)
    });
  }

  const handleRegenerateContent = async () => {
    if (!normalizedTask.campaigns?.title && !normalizedTask.holiday_id) {
      toast.error('Unable to regenerate - campaign or holiday information missing');
      return;
    }

    setRegenerating(true);
    try {
      toast.loading('Regenerating content...');
      
      // Use holiday name for holiday content or campaign title for regular content
      const contentTitle = normalizedTask.holiday_id ? 
        normalizedTask.notes?.replace('Generated for ', '') || 'Holiday Content' :
        normalizedTask.campaigns.title;
      
      const contentDescription = normalizedTask.holiday_id ?
        `Holiday content for ${contentTitle}` :
        normalizedTask.campaigns.description;
      
      const newContent = await generatePersonalizedContent(
        normalizedTask.post_type,
        contentTitle,
        normalizedTask.user_id,
        contentDescription
      );

      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: newContent,
          status: 'review'
        })
        .eq('id', normalizedTask.id);

      if (error) {
        throw error;
      }

      toast.success('Content regenerated successfully!');
      onRetryGeneration(); // Trigger refresh
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast.error('Failed to regenerate content');
    } finally {
      setRegenerating(false);
    }
  };

  if (hasValidContent) {
    // Check if this is a social media post for special preview handling
    const isSocialMediaPost = normalizedTask.post_type === 'instagram' || normalizedTask.post_type === 'facebook';
    
    if (isSocialMediaPost) {
      return (
        <div className="space-y-3">
          <SocialMediaPostPreview 
            content={normalizedTask.ai_output}
            postType={normalizedTask.post_type as 'instagram' | 'facebook'}
            contentTaskId={normalizedTask.id}
            campaignTitle={normalizedTask.campaigns?.theme || normalizedTask.campaigns?.title}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerateContent}
              disabled={regenerating}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>
      );
    }

    // Enhanced newsletter handling with better formatting
    if (normalizedTask.post_type === 'newsletter') {
      const enhancedContent = addNewsletterSections(normalizedTask.ai_output);
      const formattedContent = formatNewsletterContent(enhancedContent);
      
      return (
        <div className="space-y-3">
          <div className="prose prose-lg max-w-none">
            <SafeHtml content={formattedContent} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerateContent}
              disabled={regenerating}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
        </div>
      );
    }

    // Use magazine-style display for all other content types (blog, video)
    return (
      <div className="space-y-3">
        <MagazineContentDisplay 
          content={normalizedTask.display_content || normalizedTask.ai_output}
          postType={normalizedTask.post_type}
          contentTaskId={normalizedTask.id}
          campaignTitle={normalizedTask.campaigns?.theme || normalizedTask.campaigns?.title}
          task={normalizedTask}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerateContent}
            disabled={regenerating}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span className="text-sm">Generating {normalizedTask.post_type} content...</span>
          </div>
          {isStuckGenerating && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetryGeneration}
              disabled={retryingGeneration}
              className="border-orange-300 text-orange-600 hover:bg-orange-50 text-xs px-2 py-1"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${retryingGeneration ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="text-sm text-gray-500 italic">
        No content generated yet
      </div>
    </div>
  );
};
