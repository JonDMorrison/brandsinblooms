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
    <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-xl overflow-hidden px-6 py-4 mb-6">
      {/* Gradient Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
      <div className="absolute inset-0 bg-black/5"></div>
      
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-5 -right-10 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-5 -left-10 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-2xl"></div>
      </div>
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">Calendar</h2>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              aria-label="Previous period"
              className="h-9 w-9 p-0 bg-white/70 backdrop-blur-sm border-white/30 hover:bg-white/90 hover:border-blue-200 transition-all duration-300 hover:scale-110 shadow-lg"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </Button>
            
            <div className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent min-w-[180px] text-center px-4 py-2 bg-white/50 backdrop-blur-sm rounded-xl border border-white/30">
              {getDisplayTitle()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              aria-label="Next period"
              className="h-9 w-9 p-0 bg-white/70 backdrop-blur-sm border-white/30 hover:bg-white/90 hover:border-blue-200 transition-all duration-300 hover:scale-110 shadow-lg"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="h-9 px-4 bg-white/70 backdrop-blur-sm border-white/30 hover:bg-white/90 hover:border-blue-200 text-slate-700 font-medium transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Today
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-white/50 backdrop-blur-sm rounded-xl p-1 border border-white/30 shadow-lg" role="tablist">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('month')}
              className={`h-8 px-4 text-sm font-medium transition-all duration-300 ${
                viewMode === 'month' 
                  ? 'bg-white text-blue-700 shadow-lg border border-blue-200/50' 
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
              className={`h-8 px-4 text-sm font-medium transition-all duration-300 ${
                viewMode === 'week' 
                  ? 'bg-white text-blue-700 shadow-lg border border-blue-200/50' 
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
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkComplete}
                  disabled={bulkCompleteLoading}
                  className="h-9 px-4 bg-white/70 backdrop-blur-sm border-white/30 text-emerald-700 hover:bg-white/90 hover:border-emerald-200 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  {bulkCompleteLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Complete ({selectedTasksCount})
                </Button>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-lg blur-xl group-hover:blur-lg transition-all duration-300"></div>
              </div>
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={bulkDeleteLoading}
                  className="h-9 px-4 bg-white/70 backdrop-blur-sm border-white/30 text-red-600 hover:bg-white/90 hover:border-red-200 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  {bulkDeleteLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Delete ({selectedTasksCount})
                </Button>
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-lg blur-xl group-hover:blur-lg transition-all duration-300"></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};