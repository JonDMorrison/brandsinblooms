
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

  // Don't render the card if there are no tasks
  if (loading || tasksArray.length === 0) {
    return null;
  }

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="text-lg text-green-800 flex items-center gap-2">
          <Leaf className="w-5 h-5" />
          Content Ready for Review!
          <Badge className="bg-green-100 text-green-800 border-green-300">
            {tasksArray.length} pieces
          </Badge>
        </CardTitle>
        <CardDescription className="text-green-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Professional marketing content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReviewQueue onTaskUpdate={onTaskUpdate} onTaskClick={onTaskClick} />
      </CardContent>
    </Card>
  );
};
