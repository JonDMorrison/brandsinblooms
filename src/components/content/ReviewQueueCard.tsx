
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="text-lg text-green-800 flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-800 text-sm font-medium">
            2
          </div>
          <Leaf className="w-5 h-5" />
          Step 2: Content Ready for Review!
          <Badge className="bg-green-100 text-green-800 border-green-300">
            {tasksArray.length} pieces
          </Badge>
        </CardTitle>
        <CardDescription className="text-green-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Professional marketing content ready for your review and approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            <span className="ml-2 text-green-700">Refreshing content...</span>
          </div>
        ) : (
          <ReviewQueue onTaskUpdate={onTaskUpdate} onTaskClick={onTaskClick} />
        )}
      </CardContent>
    </Card>
  );
};
