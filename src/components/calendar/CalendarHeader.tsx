import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Calendar, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarHeaderProps {
  viewMode: 'month' | 'week';
  currentDate: Date;
  selectedTasksCount: number;
  bulkCompleteLoading: boolean;
  bulkDeleteLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: 'month' | 'week') => void;
  onBulkComplete: () => void;
  onBulkDelete: () => void;
}

export const CalendarHeader = ({
  viewMode,
  currentDate,
  selectedTasksCount,
  bulkCompleteLoading,
  bulkDeleteLoading,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  onBulkComplete,
  onBulkDelete
}: CalendarHeaderProps) => {
  const getDisplayTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    } else {
      return format(currentDate, "'Week of' MMM d, yyyy");
    }
  };

  return (
    <div className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Calendar</h2>
        
        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="text-sm font-medium min-w-[180px] text-center">
            {getDisplayTitle()}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
          >
            Today
          </Button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 border rounded-md p-1" role="tablist">
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('month')}
            className="h-7 px-2"
            role="tab"
            aria-selected={viewMode === 'month'}
          >
            <Calendar className="w-3 h-3 mr-1" />
            Month
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('week')}
            className="h-7 px-2"
            role="tab"
            aria-selected={viewMode === 'week'}
          >
            <CalendarDays className="w-3 h-3 mr-1" />
            Week
          </Button>
        </div>
      </div>
      
      {/* Bulk Actions */}
      <div className="flex gap-2">
        {selectedTasksCount > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkComplete}
              disabled={bulkCompleteLoading}
              className="text-green-600 hover:bg-green-50"
            >
              {bulkCompleteLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Complete ({selectedTasksCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              disabled={bulkDeleteLoading}
              className="text-red-600 hover:bg-red-50"
            >
              {bulkDeleteLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Delete ({selectedTasksCount})
            </Button>
          </>
        )}
      </div>
    </div>
  );
};