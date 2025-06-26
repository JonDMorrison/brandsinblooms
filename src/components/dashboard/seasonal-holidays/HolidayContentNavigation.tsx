
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HolidayContentNavigationProps {
  currentIndex: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}

export const HolidayContentNavigation = ({
  currentIndex,
  totalItems,
  onPrevious,
  onNext
}: HolidayContentNavigationProps) => {
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </Button>
      
      <span className="text-sm text-muted-foreground">
        {currentIndex + 1} of {totalItems}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentIndex === totalItems - 1}
        className="flex items-center gap-2"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
};
