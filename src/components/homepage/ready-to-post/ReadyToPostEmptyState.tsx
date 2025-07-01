
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const ReadyToPostEmptyState = () => {
  return (
    <Card className="bg-gray-50 border-2 border-dashed border-gray-200 transition-all duration-150 hover:border-gray-300 hover:bg-gray-100/50 card-interactive">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-brand-navy font-semibold tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-teal" />
          Ready to Post
        </CardTitle>
        <CardDescription className="text-gray-600 leading-relaxed">
          Your generated content appears here ready for publishing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Calendar className="w-8 h-8 text-brand-teal" />
          </div>
          <h3 className="font-semibold text-brand-navy mb-2 tracking-tight">No Content Ready Yet</h3>
          <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            Create a campaign to automatically generate content that will appear here ready for publishing to your social media platforms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
