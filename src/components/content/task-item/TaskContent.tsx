
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { ContentBody } from "../display/ContentBody";
import { generatePersonalizedContent } from "@/components/homepage/ContentGenerationServices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeTask } from "@/utils/normalizeTask";

interface TaskContentProps {
  task: any;
  onRetryGeneration: () => void;
  retryingGeneration: boolean;
}

export const TaskContent = ({ task, onRetryGeneration, retryingGeneration }: TaskContentProps) => {
  const [regenerating, setRegenerating] = useState(false);
  
  // Normalize the task for consistent display
  const normalizedTask = normalizeTask(task);

  const handleRegenerateContent = async () => {
    if (!normalizedTask.campaigns?.title && !normalizedTask.holiday_id) {
      toast.error('Unable to regenerate - campaign or holiday information missing');
      return;
    }

    setRegenerating(true);
    try {
      toast.loading('Regenerating content...', { id: 'regenerate' });
      
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

      toast.success('Content regenerated successfully!', { id: 'regenerate' });
      onRetryGeneration(); // Trigger refresh
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast.error('Failed to regenerate content', { id: 'regenerate' });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <ContentBody task={normalizedTask} />
      
      {normalizedTask.ai_output && (
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
      )}
    </div>
  );
};
