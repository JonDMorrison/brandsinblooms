import React from 'react';
import { Button } from '@/components/ui/button';
import { startOfMonth, addMonths, format } from 'date-fns';

interface QuickChipsProps {
  selectedMonth: Date;
  onSelect: (date: Date) => void;
  className?: string;
}

export function QuickChips({ selectedMonth, onSelect, className }: QuickChipsProps) {
  const now = new Date();
  const thisMonth = startOfMonth(now);
  const nextMonth = startOfMonth(addMonths(now, 1));
  
  // Next quarter logic - find the first month of the next fiscal quarter
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const nextQuarterStart = startOfMonth(new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1));
  
  // If we're in Q4, next quarter is Q1 of next year
  const nextQuarter = nextQuarterStart.getMonth() === 0 && nextQuarterStart.getFullYear() > now.getFullYear() 
    ? nextQuarterStart 
    : nextQuarterStart.getMonth() < now.getMonth() 
      ? startOfMonth(new Date(now.getFullYear() + 1, 0, 1)) // Next year Q1
      : nextQuarterStart;

  const chips = [
    { label: "This month", value: thisMonth },
    { label: "Next month", value: nextMonth },
    { label: "Next quarter", value: nextQuarter },
  ];

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-3">Quick picks:</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isSelected = format(selectedMonth, 'yyyy-MM') === format(chip.value, 'yyyy-MM');
          return (
            <Button
              key={chip.label}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(chip.value)}
              className="text-xs h-8 px-3"
            >
              {chip.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}