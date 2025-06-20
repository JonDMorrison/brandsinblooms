
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { MagazineContentDisplay } from "./MagazineContentDisplay";
import { MagazineNewsletterDisplay } from "@/components/content-sidebar/MagazineNewsletterDisplay";

interface TaskContentProps {
  task: any;
  onRetryGeneration: () => void;
  retryingGeneration: boolean;
}

export const TaskContent = ({ task, onRetryGeneration, retryingGeneration }: TaskContentProps) => {
  const isGenerating = task.status === 'generating';
  const isStuckGenerating = task.status === 'generating' && !task.ai_output;

  if (task.ai_output) {
    // Always use MagazineNewsletterDisplay for ALL newsletters
    if (task.post_type === 'newsletter') {
      return (
        <MagazineNewsletterDisplay 
          content={task.ai_output}
          className="bg-white rounded-lg border"
        />
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
