
import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { isSupportedPostType, cleanContentForDisplay, truncateText } from "@/utils/contentUtils";
import { useTaskImages } from "@/hooks/useTaskImages";
import { normalizeTask } from "@/utils/normalizeTask";
import { TaskItemHeader } from "./TaskItemHeader";
import { TaskItemContent } from "./TaskItemContent";
import { TaskItemActions } from "./TaskItemActions";

interface AccordionTaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const AccordionTaskItem = ({ task, onClick, onTaskUpdate }: AccordionTaskItemProps) => {
  console.log('AccordionTaskItem: Rendering task:', task.id, task.post_type, task.status);
  
  // Don't render unsupported post types
  if (!isSupportedPostType(task.post_type)) {
    console.log('AccordionTaskItem: Filtering out unsupported post type:', task.post_type);
    return null;
  }
  
  // Normalize the task for consistent display
  const normalizedTask = normalizeTask(task);
  console.log('AccordionTaskItem: Normalized task:', normalizedTask.id, 'needs normalization:', JSON.stringify({
    hasImagePrompts: !!normalizedTask.image_prompts?.length,
    hasNormalized: !!normalizedTask.normalized,
    hasTeaserHtml: !!normalizedTask.teaser_html
  }));
  
  const { images, imageCount, loading: imagesLoading } = useTaskImages(normalizedTask?.id);
  const hasContent = normalizedTask.ai_output && normalizedTask.ai_output.trim() !== '';
  
  // Check if this is a structured newsletter using normalized data
  const isStructuredNewsletter = normalizedTask.post_type === 'newsletter' && 
                                 hasContent && 
                                 normalizedTask.normalized;
  
  let cleanContent = '';
  let previewText = '';
  
  if (hasContent) {
    if (isStructuredNewsletter && normalizedTask.normalized) {
      // For structured newsletters, use the newsletter_md content for preview
      cleanContent = normalizedTask.normalized.newsletter_md || normalizedTask.ai_output;
      previewText = truncateText(cleanContent.replace(/[#*]/g, '').replace(/\s+/g, ' ').trim(), 110, '…');
    } else {
      // Use the normalized display content or fall back to processing
      cleanContent = normalizedTask.display_content || cleanContentForDisplay(normalizedTask.ai_output, normalizedTask.post_type);
      previewText = truncateText(cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(), 110, '…');
    }
  } else {
    previewText = 'Content will be generated soon...';
  }

  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={normalizedTask.id} className="border-gray-200 rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <TaskItemHeader 
            task={normalizedTask}
            imageCount={imageCount}
            previewText={previewText}
          />
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            <TaskItemContent
              task={normalizedTask}
              hasContent={hasContent}
              cleanContent={cleanContent}
              onClick={onClick}
            />

            <TaskItemActions
              task={normalizedTask}
              hasContent={hasContent}
              cleanContent={cleanContent}
              onClick={onClick}
              onTaskUpdate={onTaskUpdate}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
