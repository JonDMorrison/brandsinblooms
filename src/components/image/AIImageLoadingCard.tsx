import React from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui-legacy/card';

interface AIImageLoadingCardProps {
  progress?: {
    completed: number;
    total: number;
  };
  message?: string;
  subtitle?: string;
}

export const AIImageLoadingCard: React.FC<AIImageLoadingCardProps> = ({
  progress,
  message = 'Generating Images',
  subtitle = 'This may take 8-12 seconds per image'
}) => {
  return (
    <Card className="max-w-md w-full mx-4">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
            <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{message}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          
          {progress && progress.total > 0 && (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">
                  {progress.completed} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${(progress.completed / progress.total) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
