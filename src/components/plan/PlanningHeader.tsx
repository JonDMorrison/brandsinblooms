import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { MonthPicker } from './MonthPicker';
import { QuickChips } from './QuickChips';
import { SelectedPill } from './SelectedPill';
import { format } from 'date-fns';

interface PlanningHeaderProps {
  value: Date;
  onChange: (date: Date) => void;
  className?: string;
}

export function PlanningHeader({ value, onChange, className }: PlanningHeaderProps) {
  return (
    <Card className={`rounded-2xl border bg-white shadow-sm ${className}`}>
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Target Month</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Select the month you want to plan your marketing content for
          </p>
        </div>

        {/* Month Picker */}
        <div className="space-y-4">
          <MonthPicker 
            value={value}
            onChange={onChange}
          />
          
          {/* Quick Chips */}
          <QuickChips 
            selectedMonth={value}
            onSelect={onChange}
          />
          
          {/* Selected Pill */}
          <SelectedPill month={value} />
        </div>

        {/* Planning Period Subtitle */}
        <div className="pt-4 border-t">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Planning period</h2>
            <p className="text-xs text-muted-foreground">
              Showing content ideas and scheduled items for {format(value, 'MMMM yyyy')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}