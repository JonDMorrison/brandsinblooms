
import React, { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AccordionItemHeader } from "./AccordionItemHeader";
import { AccordionItemContent } from "./AccordionItemContent";
import { AccordionItemActions } from "./AccordionItemActions";
import { useIsMobile } from "@/hooks/use-mobile";

interface AccordionReadyToPostItemProps {
  task: any;
  onViewFull: (task: any) => void;
  onTaskUpdate?: () => void;
  isFirst?: boolean;
  socialConnections?: any[];
  batchMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

const getPostTypeLabel = (postType: string) => {
  switch (postType) {
    case 'instagram': return 'Instagram Post';
    case 'facebook': return 'Facebook Post';
    case 'email': return 'Email';
    case 'newsletter': return 'Newsletter';
    case 'video': return 'Video';
    default: return 'Content';
  }
};

export const AccordionReadyToPostItem: React.FC<AccordionReadyToPostItemProps> = ({
  task,
  onViewFull,
  onTaskUpdate,
  isFirst = false,
  socialConnections = [],
  batchMode = false,
  isSelected = false,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(isFirst);
  const isMobile = useIsMobile();

  const postLabel = getPostTypeLabel(task.post_type);

  const cleanContent = task.ai_output ? 
    task.ai_output.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

  const preview = cleanContent.length > 120 ? 
    cleanContent.substring(0, 120) + '...' : cleanContent;

  const campaignTitle = task.campaigns?.title || task.holidays?.holiday_name || 'Content';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`
        border rounded-xl transition-all duration-200 mb-3
        ${isOpen ? 'border-garden-green shadow-md bg-white' : 'border-gray-200 hover:border-garden-green/50 hover:shadow-sm'}
        ${batchMode && isSelected ? 'ring-2 ring-blue-200 bg-blue-50' : ''}
      `}>
        <CollapsibleTrigger asChild>
          <AccordionItemHeader
            task={task}
            isOpen={isOpen}
            batchMode={batchMode}
            isSelected={isSelected}
            onSelect={onSelect}
            postLabel={postLabel}
            campaignTitle={campaignTitle}
            preview={preview}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-gray-100">
            <AccordionItemContent
              task={task}
              cleanContent={cleanContent}
            />

            <AccordionItemActions
              task={task}
              onViewFull={onViewFull}
              onTaskUpdate={onTaskUpdate}
              socialConnections={socialConnections}
              batchMode={batchMode}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
