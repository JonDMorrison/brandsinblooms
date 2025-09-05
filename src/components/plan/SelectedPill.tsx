import React from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface SelectedPillProps {
  month: Date;
  className?: string;
}

export function SelectedPill({ month, className }: SelectedPillProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Selected:</span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">
          <Calendar className="h-3 w-3" />
          {format(month, "MMMM yyyy")}
        </span>
      </div>
    </div>
  );
}