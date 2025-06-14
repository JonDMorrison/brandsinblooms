import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ContentTaskItem } from "./task-item/ContentTaskItem";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContentViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaignTitle: string;
  loading: boolean;
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ContentViewerDialog = ({ 
  isOpen, 
  onClose, 
  campaignTitle, 
  loading, 
  tasks, 
  onTaskUpdate,
  onManualGeneration 
}: ContentViewerDialogProps & { onManualGeneration?: () => void }) => {

  const tasksWithContent = tasks.filter(task => task.ai_output && task.ai_output.trim() !== '');
  const tasksWithoutContent = tasks.filter(task => !task.ai_output || task.ai_output.trim() === '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            Content for "{campaignTitle}"
          </DialogTitle>
          <DialogDescription>
            Review and manage your generated content for this campaign
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading content..." />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No content tasks found</h3>
                <p className="text-gray-500 mb-6">Content tasks will be created automatically when you generate content.</p>
                {onManualGeneration && (
                  <Button onClick={onManualGeneration} className="bg-primary hover:bg-primary/90">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Content Pack
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {tasksWithoutContent.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-amber-800">Missing Content</h4>
                        <p className="text-sm text-amber-700">
                          {tasksWithoutContent.length} content piece(s) need to be generated: {tasksWithoutContent.map(t => t.post_type).join(', ')}
                        </p>
                      </div>
                      {onManualGeneration && (
                        <Button 
                          onClick={onManualGeneration} 
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Missing Content
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  {tasks.map((task) => (
                    <ContentTaskItem 
                      key={task.id} 
                      task={task} 
                      onTaskUpdate={onTaskUpdate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
