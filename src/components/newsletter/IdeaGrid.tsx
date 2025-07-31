import React from 'react';
import { IdeaCard } from './IdeaCard';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';

interface IdeaGridProps {
  ideas: NewsletterIdea[];
  onSelectIdea: (idea: NewsletterIdea) => void;
  loading?: boolean;
  className?: string;
}

const IdeaCardSkeleton = () => (
  <div className="border-2 border-dashed border-muted rounded-lg p-6 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="h-5 w-16 bg-muted rounded"></div>
      <div className="h-4 w-12 bg-muted rounded"></div>
    </div>
    <div className="h-6 w-3/4 bg-muted rounded mb-2"></div>
    <div className="space-y-2 mb-4">
      <div className="h-4 w-full bg-muted rounded"></div>
      <div className="h-4 w-2/3 bg-muted rounded"></div>
    </div>
    <div className="h-10 w-full bg-muted rounded"></div>
  </div>
);

export const IdeaGrid: React.FC<IdeaGridProps> = ({ 
  ideas, 
  onSelectIdea, 
  loading = false, 
  className 
}) => {
  if (loading) {
    return (
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
        className
      )}>
        {Array.from({ length: 8 }).map((_, index) => (
          <IdeaCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📧</div>
        <h3 className="text-lg font-medium mb-2">No ideas available</h3>
        <p className="text-sm text-muted-foreground">
          Try describing what kind of newsletter you'd like to create
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
      className
    )}>
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onSelect={onSelectIdea}
        />
      ))}
    </div>
  );
};