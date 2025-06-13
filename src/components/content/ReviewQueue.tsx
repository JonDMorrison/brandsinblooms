
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Sparkles, Leaf } from "lucide-react";
import { ReviewQueueItem } from "./ReviewQueueItem";
import { ReviewQueueLoading } from "./ReviewQueueLoading";
import { ReviewQueueError } from "./ReviewQueueError";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";
import { useReviewQueue } from "./useReviewQueue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { ContentTask, ReviewQueueProps } from "@/types/content";

export const ReviewQueue = ({ onTaskUpdate, onTaskClick }: ReviewQueueProps) => {
  const {
    pendingTasks,
    loading,
    error,
    approvingTasks,
    handleApprove,
    handleRetry
  } = useReviewQueue(onTaskUpdate);

  const [bulkApproving, setBulkApproving] = useState(false);

  const tasksArray = Array.isArray(pendingTasks) ? pendingTasks : [];

  const tasksByTheme = tasksArray.reduce((acc: Record<string, ContentTask[]>, task: ContentTask) => {
    const theme = task.notes?.includes('Generated from theme:') 
      ? task.notes.replace('Generated from theme: ', '').trim()
      : 'Garden Center Content';
    
    if (!acc[theme]) acc[theme] = [];
    acc[theme].push(task);
    return acc;
  }, {} as Record<string, ContentTask[]>);

  const handleBulkApprove = async (themeTasks: ContentTask[]) => {
    setBulkApproving(true);
    
    try {
      const taskIds = themeTasks.map(task => task.id);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .in('id', taskIds);

      if (error) throw error;

      toast.success(`🌱 Approved ${themeTasks.length} pieces of garden center content!`);
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      toast.error('Failed to approve content batch');
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) return <ReviewQueueLoading />;
  if (error) return <ReviewQueueError error={error} onRetry={handleRetry} />;
  if (tasksArray.length === 0) return <ReviewQueueEmpty />;

  const hasGeneratedContent = Object.keys(tasksByTheme).some(theme => theme !== 'Garden Center Content');
  const gardenCenterTasks: ContentTask[] = Array.isArray(tasksByTheme['Garden Center Content']) ? tasksByTheme['Garden Center Content'] : [];

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="text-lg text-green-800 flex items-center gap-2">
          <Leaf className="w-5 h-5" />
          Garden Center Content Ready!
          <Badge className="bg-green-100 text-green-800 border-green-300">
            {tasksArray.length} pieces
          </Badge>
        </CardTitle>
        <CardDescription className="text-green-700">
          Professional garden center marketing content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasGeneratedContent && Object.entries(tasksByTheme)
          .filter(([theme]) => theme !== 'Garden Center Content')
          .map(([theme, tasks]: [string, ContentTask[]]) => (
            <div key={theme} className="border border-green-200 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-600" />
                  <h4 className="font-medium text-green-900">Themed Garden Content</h4>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    {tasks.length} pieces
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleBulkApprove(tasks)}
                  disabled={bulkApproving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approve All
                </Button>
              </div>
              <p className="text-sm text-green-700 mb-3 font-medium">Theme: {theme}</p>
              <div className="space-y-2">
                {tasks.map((task: ContentTask) => (
                  <ReviewQueueItem
                    key={task.id}
                    task={task}
                    onApprove={handleApprove}
                    onClick={onTaskClick || (() => {})}
                    isApproving={approvingTasks.has(task.id)}
                    onTaskUpdate={onTaskUpdate}
                  />
                ))}
              </div>
            </div>
          ))}

        {gardenCenterTasks.length > 0 && (
          <div className="border border-green-200 rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600" />
                <h4 className="font-medium text-green-900">Garden Center Marketing Content</h4>
                <Badge variant="outline" className="text-green-700 border-green-300">
                  {gardenCenterTasks.length} ready
                </Badge>
              </div>
              {gardenCenterTasks.length > 1 && (
                <Button
                  size="sm"
                  onClick={() => handleBulkApprove(gardenCenterTasks)}
                  disabled={bulkApproving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approve All
                </Button>
              )}
            </div>
            <p className="text-sm text-green-700 mb-3">
              🌱 Professional content designed specifically for garden centers
            </p>
            <div className="space-y-2">
              {gardenCenterTasks.slice(0, 3).map((task: ContentTask) => (
                <ReviewQueueItem
                  key={task.id}
                  task={task}
                  onApprove={handleApprove}
                  onClick={onTaskClick || (() => {})}
                  isApproving={approvingTasks.has(task.id)}
                  onTaskUpdate={onTaskUpdate}
                />
              ))}
            </div>
          </div>
        )}
        
        {tasksArray.length > 6 && (
          <Button variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50">
            View All {tasksArray.length} Garden Center Content Pieces
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
