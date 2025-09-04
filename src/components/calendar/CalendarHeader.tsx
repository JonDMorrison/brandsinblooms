import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  CalendarDays, 
  Plus, 
  Megaphone, 
  Filter,
  List,
  RefreshCw,
  Star
} from 'lucide-react';
import { format } from 'date-fns';

interface CalendarHeaderProps {
  viewMode: 'month' | 'week' | 'list';
  currentDate: Date;
  selectedTasksCount: number;
  bulkCompleteLoading: boolean;
  bulkDeleteLoading: boolean;
  showPlanningPanel?: boolean;
  isRefreshing?: boolean;
  lastUpdated?: number | null;
  filters?: {
    types: string[];
    platforms: string[];
    statuses: string[];
    showPublished: boolean;
    searchQuery: string;
  };
  filterOptions?: {
    types: string[];
    platforms: string[];
    statuses: string[];
  };
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: 'month' | 'week' | 'list') => void;
  onBulkComplete: () => void;
  onBulkDelete: () => void;
  onFiltersChange?: (filters: any) => void;
  onCreateEvent?: () => void;
  onCreateCampaign?: () => void;
  onTogglePlanningPanel?: () => void;
  onShowThemesReference?: () => void;
  onRefresh?: () => void;
}

export const CalendarHeader = ({
  viewMode,
  currentDate,
  selectedTasksCount,
  bulkCompleteLoading,
  bulkDeleteLoading,
  showPlanningPanel,
  isRefreshing,
  lastUpdated,
  filters,
  filterOptions,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  onBulkComplete,
  onBulkDelete,
  onFiltersChange,
  onCreateEvent,
  onCreateCampaign,
  onTogglePlanningPanel,
  onShowThemesReference,
  onRefresh
}: CalendarHeaderProps) => {
  const getDisplayTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    } else {
      return format(currentDate, "'Week of' MMM d, yyyy");
    }
  };

  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          
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
              className={`h-8 px-3 text-sm font-medium transition-colors duration-200 ${
                viewMode === 'month' 
                  ? 'bg-white text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
              role="tab"
              aria-selected={viewMode === 'month'}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('week')}
              className={`h-8 px-3 text-sm font-medium transition-colors duration-200 ${
                viewMode === 'week' 
                  ? 'bg-white text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
              role="tab"
              aria-selected={viewMode === 'week'}
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('list')}
              className={`h-8 px-3 text-sm font-medium transition-colors duration-200 ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-700 border border-blue-200' 
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/70'
              }`}
              role="tab"
              aria-selected={viewMode === 'list'}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
          </div>

        </div>
        
        {/* Bulk Action Buttons - only show when tasks are selected */}
        {selectedTasksCount > 0 && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {filters && onFiltersChange && filterOptions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-slate-600">
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                  {(filters.types.length < filterOptions.types.length || 
                    filters.platforms.length > 0 || 
                    filters.statuses.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-4 text-xs">
                      Active
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {filterOptions.types.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={filters.types.includes(type)}
                    onCheckedChange={(checked) => {
                      const newTypes = checked 
                        ? [...filters.types, type]
                        : filters.types.filter(t => t !== type);
                      onFiltersChange({ ...filters, types: newTypes });
                    }}
                  >
                    {type.replace('_', ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {onShowThemesReference && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShowThemesReference}
              className="h-8 px-3 text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-colors duration-200"
            >
              <Star className="w-4 h-4 mr-1" />
              Weekly Themes
            </Button>
          )}

          {onTogglePlanningPanel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onTogglePlanningPanel}
              className={`h-8 px-3 ${showPlanningPanel ? 'text-blue-700 bg-blue-50' : 'text-slate-600'} hover:bg-blue-50 hover:border-blue-200 transition-colors duration-200`}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Planning
            </Button>
          )}


          {onCreateCampaign && (
            <Button
              size="sm"
              onClick={onCreateCampaign}
              className="h-8 px-3 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};