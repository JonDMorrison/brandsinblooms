
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskContent } from "./task-item/TaskContent";
import { InlineEditableContent } from "./InlineEditableContent";
import { normalizeTask } from "@/utils/normalizeTask";

interface ContentTaskItemProps {
  task: any;
  onTaskUpdate?: () => void;
}

export const ContentTaskItem = ({ task, onTaskUpdate }: ContentTaskItemProps) => {
  const normalizedTask = normalizeTask(task);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'review': return 'bg-blue-100 text-blue-800';
      case 'generating': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'blog': return '📝';
      case 'video': return '🎬';
      case 'newsletter': return '📧';
      default: return '📄';
    }
  };

  const retryGeneration = () => {
    // Implement retry logic if needed
    if (onTaskUpdate) onTaskUpdate();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getPostTypeIcon(normalizedTask.post_type)}</span>
            <div>
              <h3 className="font-semibold capitalize">
                {normalizedTask.post_type} Content
              </h3>
              {normalizedTask.scheduled_date && (
                <p className="text-sm text-gray-600">
                  Scheduled: {new Date(normalizedTask.scheduled_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(normalizedTask.status)}>
              {normalizedTask.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <InlineEditableContent
          task={normalizedTask}
          onTaskUpdate={onTaskUpdate}
        />
      </CardContent>
    </Card>
  );
};
