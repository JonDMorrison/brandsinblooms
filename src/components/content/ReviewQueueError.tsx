
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ReviewQueueErrorProps {
  error: string;
  onRetry: () => void;
}

export const ReviewQueueError = ({ error, onRetry }: ReviewQueueErrorProps) => {
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Review Queue - Error
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6 text-red-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
          <p className="font-medium">Failed to load review queue</p>
          <p className="text-sm">{error}</p>
          <Button 
            variant="outline" 
            className="mt-3"
            onClick={onRetry}
          >
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
