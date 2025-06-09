
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const ReadyToPostEmptyState = () => {
  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="text-lg text-black flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Ready to Post
        </CardTitle>
        <CardDescription className="text-black">
          Your generated content appears here ready for publishing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">          
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40 text-black" />
          <h3 className="font-semibold text-black mb-2">No Content Ready Yet</h3>
          <p className="text-sm text-black max-w-md mx-auto">
            Create a campaign to automatically generate content that will appear here ready for publishing to your social media platforms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
