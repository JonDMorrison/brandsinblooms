import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  X,
  CheckCircle,
  XCircle,
  Clock,
  Bot,
  Calendar,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

export type SubmissionResultFilter = 'all' | 'accepted' | 'rejected';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface SubmissionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultFilter: SubmissionResultFilter;
  onResultFilterChange: (filter: SubmissionResultFilter) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
}

const resultOptions = [
  { value: 'all' as const, label: 'All Submissions', icon: null },
  { value: 'accepted' as const, label: 'Accepted', icon: <CheckCircle className="h-4 w-4 text-green-600" /> },
  { value: 'rejected' as const, label: 'Rejected (All)', icon: <XCircle className="h-4 w-4 text-destructive" /> },
];

const datePresets = [
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Last 7 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) }) },
  { label: 'Last 30 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
  { label: 'Last 90 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 90)), to: endOfDay(new Date()) }) },
];

export function SubmissionFilters({
  searchQuery,
  onSearchChange,
  resultFilter,
  onResultFilterChange,
  dateRange,
  onDateRangeChange,
  activeFiltersCount,
  onClearFilters,
}: SubmissionFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) return 'All time';
    if (dateRange.from && !dateRange.to) return `From ${format(dateRange.from, 'MMM d')}`;
    if (!dateRange.from && dateRange.to) return `Until ${format(dateRange.to, 'MMM d')}`;
    return `${format(dateRange.from!, 'MMM d')} – ${format(dateRange.to!, 'MMM d')}`;
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Main Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Email Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by email..."
            className="pl-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Date Range Filter */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[180px] justify-start">
              <Calendar className="h-4 w-4" />
              <span className="truncate">{formatDateRange()}</span>
              {(dateRange.from || dateRange.to) && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  1
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex">
              {/* Presets */}
              <div className="border-r p-3 space-y-1">
                <Label className="text-xs text-muted-foreground px-2">Quick Select</Label>
                {datePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      onDateRangeChange(preset.getValue());
                      setCalendarOpen(false);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm text-muted-foreground"
                  onClick={() => {
                    onDateRangeChange({ from: undefined, to: undefined });
                    setCalendarOpen(false);
                  }}
                >
                  All time
                </Button>
              </div>
              {/* Calendar */}
              <div className="p-3">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    onDateRangeChange({ from: range?.from, to: range?.to });
                  }}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {resultFilter === 'all' ? 'Status' : resultOptions.find(o => o.value === resultFilter)?.label}
              {resultFilter !== 'all' && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  1
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {resultOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onResultFilterChange(option.value)}
                className={resultFilter === option.value ? 'bg-muted' : ''}
              >
                <div className="flex items-center gap-2">
                  {option.icon}
                  <span>{option.label}</span>
                </div>
                {resultFilter === option.value && (
                  <CheckCircle className="h-4 w-4 ml-auto text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>
    </div>
  );
}
