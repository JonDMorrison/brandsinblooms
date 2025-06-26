
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Leaf, AlertTriangle } from "lucide-react";
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
      : 'Business Content';
    
    if (!acc[theme]) acc[theme] = [];
    acc[theme].push(task);
    return acc;
  }, {} as Record<string, ContentTask[]>);

  const handleBulkApprove = async (themeTasks: ContentTask[]) => {
    // Add confirmation dialog for bulk approval
    const confirmed = window.confirm(
      `Are you sure you want to approve all ${themeTasks.length} pieces of content for this theme? ` +
      'This will move them to the "Ready to Post" section.'
    );
    
    if (!confirmed) return;
    
    setBulkApproving(true);
    
    console.log('🎯 REVIEW_QUEUE: Starting bulk approval for', themeTasks.length, 'tasks');
    
    try {
      const taskIds = themeTasks.map(task => task.id);
      
      // Use 'approved' status for bulk approval
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'approved' })
        .in('id', taskIds);

      if (error) {
        console.error('❌ REVIEW_QUEUE: Bulk approval database error:', error);
        throw error;
      }

      console.log('✅ REVIEW_QUEUE: Bulk approval successful');
      toast.success(`🚀 Approved ${themeTasks.length} pieces of content!`);
      if (onTaskUpdate) {
        console.log('🔄 REVIEW_QUEUE: Calling onTaskUpdate to refresh data');
        onTaskUpdate();
      }
    } catch (error) {
      console.error('❌ REVIEW_QUEUE: Bulk approval failed:', error);
      toast.error('Failed to approve content batch');
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) return <ReviewQueueLoading />;
  if (error) return <ReviewQueueError error={error} onRetry={handleRetry} />;
  if (tasksArray.length === 0) return <ReviewQueueEmpty />;

  const hasGeneratedContent = Object.keys(tasksByTheme).some(theme => theme !== 'Business Content');
  const businessTasks: ContentTask[] = Array.isArray(tasksByTheme['Business Content']) ? tasksByTheme['Business Content'] : [];

  return (
    <div className="space-y-4">
      {/* Safety notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Review Required</p>
            <p>All content below requires your approval before it appears in "Ready to Post".</p>
          </div>
        </div>
      </div>

      {hasGeneratedContent && Object.entries(tasksByTheme)
        .filter(([theme]) => theme !== 'Business Content')
        .map(([theme, tasks]: [string, ContentTask[]]) => (
          <div key={theme} className="border border-green-200 rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-600" />
                <h4 className="font-medium text-green-900">Themed Content</h4>
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
                Approve All ({tasks.length})
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

      {businessTasks.length > 0 && (
        <div className="border border-green-200 rounded-lg p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-green-900">Business Marketing Content</h4>
              <Badge variant="outline" className="text-green-700 border-green-300">
                {businessTasks.length} ready
              </Badge>
            </div>
            {businessTasks.length > 1 && (
              <Button
                size="sm"
                onClick={() => handleBulkApprove(businessTasks)}
                disabled={bulkApproving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Approve All ({businessTasks.length})
              </Button>
            )}
          </div>
          <p className="text-sm text-green-700 mb-3">
            🚀 Professional content designed for your business
          </p>
          <div className="space-y-2">
            {businessTasks.slice(0, 3).map((task: ContentTask) => (
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
          View All {tasksArray.length} Content Pieces
        </Button>
      )}
    </div>
  );
};
