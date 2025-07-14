import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Clock } from "lucide-react";

interface ProgressiveLoadingCardProps {
  title: string;
  description?: string;
  expectedContent: string;
  isLoading: boolean;
  children?: React.ReactNode;
}

export const ProgressiveLoadingCard = ({ 
  title, 
  description, 
  expectedContent, 
  isLoading, 
  children 
}: ProgressiveLoadingCardProps) => {
  if (!isLoading && children) {
    return <>{children}</>;
  }

  return (
    <Card className="border-dashed border-gray-300">
      <CardHeader>
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
          <CardTitle className="text-gray-700">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
        
        <div className="space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {isLoading ? "Generating" : "Coming Soon"}
          </div>
          <div className="text-sm text-gray-700 italic">
            {expectedContent}
          </div>
        </div>

        {/* Skeleton placeholders */}
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>

        {isLoading && (
          <div className="text-xs text-blue-600 mt-4">
            This content is being generated and will appear shortly...
          </div>
        )}
      </CardContent>
    </Card>
  );
};