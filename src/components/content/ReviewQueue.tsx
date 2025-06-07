
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { ReviewQueueItem } from "./ReviewQueueItem";
import { ReviewQueueLoading } from "./ReviewQueueLoading";
import { ReviewQueueError } from "./ReviewQueueError";
import { ReviewQueueEmpty } from "./ReviewQueueEmpty";
import { useReviewQueue } from "./useReviewQueue";

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

  if (loading) {
    return <ReviewQueueLoading />;
  }

  if (error) {
    return <ReviewQueueError error={error} onRetry={handleRetry} />;
  }

  if (pendingTasks.length === 0) {
    return <ReviewQueueEmpty />;
  }

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Review Queue
          <Badge className="bg-orange-100 text-orange-800">
            {pendingTasks.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingTasks.slice(0, 3).map((task) => (
          <ReviewQueueItem
            key={task.id}
            task={task}
            onApprove={handleApprove}
            onClick={onTaskClick || (() => {})}
            isApproving={approvingTasks.has(task.id)}
          />
        ))}
        
        {pendingTasks.length > 3 && (
          <Button variant="outline" className="w-full">
            View All {pendingTasks.length} Items
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
