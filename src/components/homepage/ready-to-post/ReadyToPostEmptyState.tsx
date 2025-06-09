
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, Lightbulb } from "lucide-react";

export const ReadyToPostEmptyState = () => {
  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="text-lg text-green-800 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Ready to Post
        </CardTitle>
        <CardDescription className="text-green-700">
          Your generated content appears here ready for publishing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-4 mb-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <span>Create Campaign</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-orange-600" />
              </div>
              <span>AI Generates Content</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-green-600" />
              </div>
              <span>Ready to Post</span>
            </div>
          </div>
          
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40 text-green-600" />
          <h3 className="font-semibold text-green-800 mb-2">No Content Ready Yet</h3>
          <p className="text-sm text-green-700 max-w-md mx-auto">
            Create a campaign to automatically generate content that will appear here ready for publishing to your social media platforms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
