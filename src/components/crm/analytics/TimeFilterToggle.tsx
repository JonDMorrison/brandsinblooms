import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TimeFilter = '7d' | '30d' | 'all';

interface TimeFilterToggleProps {
  value: TimeFilter;
  onChange: (value: TimeFilter) => void;
}

const filterOptions = [
  { value: '7d' as const, label: 'Past 7 Days' },
  { value: '30d' as const, label: 'Past 30 Days' },
  { value: 'all' as const, label: 'All Time' },
];

export const TimeFilterToggle = ({ value, onChange }: TimeFilterToggleProps) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {filterOptions.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(option.value)}
          className={cn(
            "text-xs",
            value === option.value && "shadow-sm"
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};