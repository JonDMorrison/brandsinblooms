
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface ConceptTooltipProps {
  children: React.ReactNode;
  type: 'persona' | 'segment';
  className?: string;
}

export function ConceptTooltip({ children, type, className = "" }: ConceptTooltipProps) {
  const getTooltipContent = () => {
    if (type === 'persona') {
      return "A persona is a fictional profile that represents the personality, goals, and struggles of a common customer type. Used to personalize your messaging.";
    } else {
      return "A segment is a real group of contacts with shared traits — like Loyalty Members, Locals, or Workshop Attendees. Used to target the right audience.";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 ${className}`}>
            {children}
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm leading-relaxed">
            {getTooltipContent()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
