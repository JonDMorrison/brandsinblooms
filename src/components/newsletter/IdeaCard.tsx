import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChevronRight } from 'lucide-react';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';

interface IdeaCardProps {
  idea: NewsletterIdea;
  onSelect: (idea: NewsletterIdea) => void;
  className?: string;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onSelect, className }) => {
  const getBadgeVariant = (category: NewsletterIdea['category']) => {
    switch (category) {
      case 'holiday':
        return 'destructive';
      case 'seasonal':
        return 'secondary';
      case 'product':
        return 'default';
      case 'ai-generated':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getCategoryLabel = (category: NewsletterIdea['category']) => {
    switch (category) {
      case 'holiday':
        return 'Holiday';
      case 'seasonal':
        return 'Seasonal';
      case 'product':
        return 'Product';
      case 'ai-generated':
        return 'AI Generated';
      default:
        return 'General';
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer",
      "border-2 hover:border-primary/20",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <Badge variant={getBadgeVariant(idea.category)} className="text-xs">
            {idea.badge || getCategoryLabel(idea.category)}
          </Badge>
          {idea.estimatedReadTime && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />
              {idea.estimatedReadTime}
            </div>
          )}
        </div>

        <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {idea.title}
        </h3>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {idea.description}
        </p>

        {/* Preview overlay - shown on hover */}
        {idea.previewHtml && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 p-4 overflow-auto">
            <div className="text-xs text-muted-foreground mb-2">Preview:</div>
            <div 
              className="text-sm prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: idea.previewHtml }}
            />
          </div>
        )}

        <Button 
          onClick={() => onSelect(idea)}
          className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
          variant="outline"
        >
          Start with this
          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
};