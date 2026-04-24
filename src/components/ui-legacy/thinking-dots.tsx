import React from 'react';
import { cn } from '@/lib/utils';

interface ThinkingDotsProps {
  className?: string;
}

export const ThinkingDots: React.FC<ThinkingDotsProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div 
        className="w-2 h-2 rounded-full bg-primary animate-thinking-dot"
        style={{ animationDelay: '0ms' }}
      />
      <div 
        className="w-2 h-2 rounded-full bg-primary animate-thinking-dot"
        style={{ animationDelay: '150ms' }}
      />
      <div 
        className="w-2 h-2 rounded-full bg-primary animate-thinking-dot"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
};
