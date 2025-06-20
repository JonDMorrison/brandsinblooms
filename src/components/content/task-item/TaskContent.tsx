
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { MagazineContentDisplay } from "./MagazineContentDisplay";

interface TaskContentProps {
  task: any;
  onRetryGeneration: () => void;
  retryingGeneration: boolean;
}

export const TaskContent = ({ task, onRetryGeneration, retryingGeneration }: TaskContentProps) => {
  const isGenerating = task.status === 'generating';
  const isStuckGenerating = task.status === 'generating' && !task.ai_output;

  if (task.ai_output) {
    // Check if this is a structured newsletter for special handling
    const isStructuredNewsletter = task.post_type === 'newsletter' && task.ai_output.includes('newsletter_md:');
    
    if (isStructuredNewsletter) {
      // For structured newsletters, show a simplified preview since full magazine display is in the sidebar
      return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-700">Structured Newsletter</span>
          </div>
          <p className="text-sm text-gray-600 italic">
            Magazine-style newsletter with multiple sections and content blocks. Click to view full layout.
          </p>
        </div>
      );
    }

    // Use magazine-style display for all other content types
    return (
      <MagazineContentDisplay 
        content={task.ai_output}
        postType={task.post_type}
      />
    );
  }

  if (isGenerating) {
    return (
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
