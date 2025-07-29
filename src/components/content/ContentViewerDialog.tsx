
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ContentTaskItem } from "./ContentTaskItem";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Get unique content types present in tasks
  const availableContentTypes = [...new Set(tasks.map(task => task.post_type))].filter(Boolean);
  const showTabs = availableContentTypes.length > 1;
  
  // Group tasks by type for tabs
  const facebookTasks = tasks.filter(task => task.post_type === 'facebook');
  const instagramTasks = tasks.filter(task => task.post_type === 'instagram');
  const blogTasks = tasks.filter(task => task.post_type === 'blog');
  const videoTasks = tasks.filter(task => task.post_type === 'video');
  const newsletterTasks = tasks.filter(task => task.post_type === 'newsletter');

  const contentTypeMap: Record<string, { label: string; tasks: any[] }> = {
    facebook: { label: 'Facebook', tasks: facebookTasks },
    instagram: { label: 'Instagram', tasks: instagramTasks },
    blog: { label: 'Blog', tasks: blogTasks },
    video: { label: 'Video', tasks: videoTasks },
    newsletter: { label: 'Newsletter', tasks: newsletterTasks }
  };

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

                {showTabs ? (
                  <Tabs defaultValue={availableContentTypes.length > 1 ? "all" : availableContentTypes[0]} className="w-full">
                    <TabsList className={`grid w-full grid-cols-${availableContentTypes.length > 1 ? availableContentTypes.length + 1 : availableContentTypes.length}`}>
                      {availableContentTypes.length > 1 && <TabsTrigger value="all">All</TabsTrigger>}
                      {availableContentTypes.map(type => (
                        <TabsTrigger key={type} value={type}>
                          {contentTypeMap[type]?.label || type}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {availableContentTypes.length > 1 && (
                      <TabsContent value="all" className="space-y-4">
                        <div className="grid gap-4">
                          {tasks.map((task) => (
                            <ContentTaskItem 
                              key={task.id} 
                              task={task} 
                              onTaskUpdate={onTaskUpdate}
                            />
                          ))}
                        </div>
                      </TabsContent>
                    )}
                    
                    {availableContentTypes.map(type => (
                      <TabsContent key={type} value={type} className="space-y-4">
                        <div className="grid gap-4">
                          {contentTypeMap[type]?.tasks.map((task) => (
                            <ContentTaskItem 
                              key={task.id} 
                              task={task} 
                              onTaskUpdate={onTaskUpdate}
                            />
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <div className="space-y-4">
                    {availableContentTypes.length === 1 && (
                      <h3 className="text-lg font-semibold text-foreground">
                        {contentTypeMap[availableContentTypes[0]]?.label || availableContentTypes[0]} Content
                      </h3>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
