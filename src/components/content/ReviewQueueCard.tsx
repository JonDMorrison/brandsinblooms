
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { Clock, Leaf } from "lucide-react";
import { ReviewQueue } from "./ReviewQueue";
import { useReviewQueue } from "./useReviewQueue";

interface ReviewQueueCardProps {
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

export const ReviewQueueCard = ({ onTaskUpdate, onTaskClick }: ReviewQueueCardProps) => {
  const { pendingTasks, loading } = useReviewQueue(onTaskUpdate);
  
  const tasksArray = Array.isArray(pendingTasks) ? pendingTasks : [];

  // Don't render the card if there are no tasks and not loading
  if (!loading && tasksArray.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50">
      <CardHeader>
        <CardTitle className="text-lg text-blue-950 flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-950 text-sm font-medium">
            2
          </div>
          <Leaf className="w-5 h-5" />
          Step 2: Content Ready for Review!
          <Badge className="bg-blue-100 text-blue-950 border-blue-300">
            {tasksArray.length} pieces
          </Badge>
        </CardTitle>
        <CardDescription className="text-blue-900 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Professional marketing content ready for your review and approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-800"></div>
            <span className="ml-2 text-blue-900">Refreshing content...</span>
          </div>
        ) : (
          <ReviewQueue onTaskUpdate={onTaskUpdate} onTaskClick={onTaskClick} />
        )}
      </CardContent>
    </Card>
  );
};
