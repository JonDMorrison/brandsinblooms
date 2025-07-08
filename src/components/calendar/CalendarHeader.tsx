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
    <div className="border-b border-gray-200/50 px-6 py-4 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              aria-label="Previous period"
              className="h-8 w-8 p-0 border-gray-300 hover:border-teal-400 hover:bg-teal-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-sm font-medium min-w-[180px] text-center text-gray-700">
              {getDisplayTitle()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              aria-label="Next period"
              className="h-8 w-8 p-0 border-gray-300 hover:border-teal-400 hover:bg-teal-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="h-8 px-3 border-gray-300 hover:border-teal-400 hover:bg-teal-50 text-gray-700"
            >
              Today
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100/80 rounded-lg p-1 border border-gray-200/50" role="tablist">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('month')}
              className={`h-7 px-3 text-xs font-medium transition-all ${
                viewMode === 'month' 
                  ? 'bg-white text-teal-700 shadow-sm border border-teal-200/50' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
              }`}
              role="tab"
              aria-selected={viewMode === 'month'}
            >
              <Calendar className="w-3 h-3 mr-1.5" />
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('week')}
              className={`h-7 px-3 text-xs font-medium transition-all ${
                viewMode === 'week' 
                  ? 'bg-white text-teal-700 shadow-sm border border-teal-200/50' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
              }`}
              role="tab"
              aria-selected={viewMode === 'week'}
            >
              <CalendarDays className="w-3 h-3 mr-1.5" />
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
                className="h-8 px-3 text-teal-700 border-teal-300 hover:bg-teal-50 hover:border-teal-400"
              >
                {bulkCompleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
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
                className="h-8 px-3 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
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
    </div>
  );
};