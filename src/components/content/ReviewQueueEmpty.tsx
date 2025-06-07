
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";

export const ReviewQueueEmpty = () => {
  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="text-lg text-orange-700 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Review Queue
        </CardTitle>
        <CardDescription>
          Content ready for your review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm">No content pending review</p>
        </div>
      </CardContent>
    </Card>
  );
};
