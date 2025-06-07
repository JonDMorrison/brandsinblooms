
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const ReadyToPostEmptyState = () => {
  return (
    <Card className="border-green-200">
      <CardHeader>
        <CardTitle className="text-lg text-black flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Ready to Post
        </CardTitle>
        <CardDescription>
          Approved content ready for publishing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No content ready to post</p>
          <p className="text-sm">Approve content to see it here</p>
        </div>
      </CardContent>
    </Card>
  );
};
