
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, Sparkles } from "lucide-react";
import { ReviewQueueItem } from "./ReviewQueueItem";
import { ReviewQueueLoading } from "./ReviewQueueLoading";
import { ReviewQueueError } from "./ReviewQueueError";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";
import { useReviewQueue } from "./useReviewQueue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface ReviewQueueProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

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

  // Ensure pendingTasks is always an array
  const tasksArray = Array.isArray(pendingTasks) ? pendingTasks : [];

  // Group tasks by theme/campaign for batch operations with explicit typing
  const tasksByTheme = tasksArray.reduce((acc: Record<string, any[]>, task: any) => {
    const theme = task.notes?.includes('Generated from theme:') 
      ? task.notes.replace('Generated from theme: ', '').trim()
      : 'Other';
    
    if (!acc[theme]) acc[theme] = [];
    acc[theme].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  const handleBulkApprove = async (themeTasks: any[]) => {
    setBulkApproving(true);
    
    try {
      const taskIds = themeTasks.map(task => task.id);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'posted' })
        .in('id', taskIds);

      if (error) throw error;

      toast.success(`Approved ${themeTasks.length} pieces of content!`);
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error bulk approving tasks:', error);
      toast.error('Failed to approve content batch');
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) {
    return <ReviewQueueLoading />;
  }

  if (error) {
    return <ReviewQueueError error={error} onRetry={handleRetry} />;
  }

  if (tasksArray.length === 0) {
    return <ReviewQueueEmpty />;
  }

  const hasGeneratedContent = Object.keys(tasksByTheme).some(theme => theme !== 'Other');
  // Safely get other tasks with type guard
  const otherTasks: any[] = Array.isArray(tasksByTheme['Other']) ? tasksByTheme['Other'] : [];

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-lg text-black flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Review Queue
          <Badge className="bg-orange-100 text-orange-800">
            {tasksArray.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-black">
          Content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show generated content batches first */}
        {hasGeneratedContent && Object.entries(tasksByTheme)
          .filter(([theme]) => theme !== 'Other')
          .map(([theme, tasks]: [string, any[]]) => (
            <div key={theme} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h4 className="font-medium text-purple-900">Generated Content Pack</h4>
                  <Badge variant="outline" className="text-purple-700 border-purple-300">
                    {tasks.length} pieces
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleBulkApprove(tasks)}
                  disabled={bulkApproving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approve All
                </Button>
              </div>
              <p className="text-sm text-purple-700 mb-3 font-medium">Theme: {theme}</p>
              <div className="space-y-2">
                {tasks.map((task: any) => (
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

        {/* Show other content */}
        {otherTasks.length > 0 && (
          <div className="space-y-3">
            {otherTasks.slice(0, 3).map((task: any) => (
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
        )}
        
        {tasksArray.length > 6 && (
          <Button variant="outline" className="w-full">
            View All {tasksArray.length} Items
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
