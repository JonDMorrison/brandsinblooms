import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, FileText } from 'lucide-react';

interface BuilderEmptyStateProps {
  onBrowseTemplates: () => void;
  onStartFromScratch: () => void;
  className?: string;
}

export const BuilderEmptyState: React.FC<BuilderEmptyStateProps> = ({
  onBrowseTemplates,
  onStartFromScratch,
  className
}) => {
  return (
    <Card className={`bg-gradient-to-br from-background to-muted/20 border-2 border-dashed border-border/50 ${className}`}>
      <CardContent className="p-12 text-center">
        <div className="space-y-6">
          <div className="text-6xl mb-4">🌿</div>
          <div>
            <h3 className="text-2xl font-semibold mb-3 text-foreground">
              Let's Grow Your First Campaign!
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
              Start with a pre-built template or build your email one block at a time. 
              Either way, we've made it easy.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              onClick={onBrowseTemplates}
              size="lg"
              className="gap-2 min-w-48"
            >
              <Sparkles className="w-5 h-5" />
              Browse Starter Templates
            </Button>
            <Button 
              variant="outline"
              onClick={onStartFromScratch}
              size="lg"
              className="gap-2 min-w-48"
            >
              <FileText className="w-5 h-5" />
              Start From Scratch
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};