
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { ContentTaskItem } from "./ContentTaskItem";

interface ContentViewerContentProps {
  loading: boolean;
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ContentViewerContent = ({ loading, tasks, onTaskUpdate }: ContentViewerContentProps) => {
  console.log('ContentViewerContent: Rendering with', tasks.length, 'tasks, loading:', loading);

  // Check if we have tasks with actual content or if content is still being generated
  const tasksWithContent = tasks.filter(task => task.ai_output && task.ai_output.trim() !== '');
  const tasksGenerating = tasks.filter(task => task.status === 'generating' || !task.ai_output);
  
  const isActuallyLoading = loading && tasks.length === 0;
  const isGeneratingContent = tasksGenerating.length > 0;

  return (
    <ScrollArea className="h-[600px] pr-4">
      {isActuallyLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading and generating content...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-gray-500 mb-4">Generating content for this campaign...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Found {tasks.length} content pieces for this campaign
            {isGeneratingContent && (
              <span className="ml-2 text-blue-600">
                ({tasksGenerating.length} still generating...)
              </span>
            )}
          </div>

          {tasks.map((task) => (
            <ContentTaskItem 
              key={task.id} 
              task={task} 
              onTaskUpdate={onTaskUpdate}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
};
