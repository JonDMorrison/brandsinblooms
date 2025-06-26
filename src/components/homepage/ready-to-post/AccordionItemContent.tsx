
import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AccordionItemContentProps {
  task: any;
  cleanContent: string;
}

export const AccordionItemContent: React.FC<AccordionItemContentProps> = ({
  task,
  cleanContent
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="pt-4 space-y-4">
      {/* Content Preview - Full content when expanded */}
      {cleanContent && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div 
            className={`text-gray-700 ${isMobile ? 'text-sm' : 'text-base'}`}
            dangerouslySetInnerHTML={{ __html: task.ai_output }}
          />
        </div>
      )}

      {/* Error Message */}
      {task.last_posting_error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{task.last_posting_error}</p>
          {task.posting_attempts > 0 && (
            <p className="text-xs text-red-500 mt-1">
              Failed {task.posting_attempts} time{task.posting_attempts !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
