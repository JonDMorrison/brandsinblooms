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
    <div className="relative bg-white border border-slate-200 rounded-2xl shadow-lg px-6 py-4 mb-6" style={{ contain: 'layout style paint' }}>
      
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">Calendar</h2>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              aria-label="Previous period"
              className="h-9 w-9 p-0 hover:bg-slate-50 transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            
            <div className="text-lg font-bold text-slate-800 min-w-[180px] text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
              {getDisplayTitle()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              aria-label="Next period"
              className="h-9 w-9 p-0 hover:bg-slate-50 transition-colors duration-200"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="h-9 px-4 hover:bg-slate-50 text-slate-700 font-medium transition-colors duration-200"
            >
              Today
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200" role="tablist">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('month')}
              className={`h-8 px-4 text-sm font-medium transition-colors duration-200 ${
                viewMode === 'month' 
                  ? 'bg-white text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
              role="tab"
              aria-selected={viewMode === 'month'}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('week')}
              className={`h-8 px-4 text-sm font-medium transition-colors duration-200 ${
                viewMode === 'week' 
                  ? 'bg-white text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
              role="tab"
              aria-selected={viewMode === 'week'}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Week
            </Button>
          </div>
        </div>
        
        {/* Bulk Actions */}
        <div className="flex gap-3">
          {selectedTasksCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkComplete}
                disabled={bulkCompleteLoading}
                className="h-9 px-4 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors duration-200"
              >
                {bulkCompleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
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
                className="h-9 px-4 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors duration-200"
              >
                {bulkDeleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
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